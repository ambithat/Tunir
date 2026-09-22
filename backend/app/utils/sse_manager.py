import asyncio
import json
import asyncpg
from typing import Dict, Set, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_main_engine, get_main_session_factory
from app.models.sales.leader import Leader

from app.models.tracking.notification import Notification
from app.core.config import logger
from app.repositories.dashboard_repository import DashboardRepository
from app.repositories.tracking.tracker_repository import TrackerRepository
'''
pg_listener (1 instance, runs forever)        SSE stream (1 per user)
─────────────────────────────────────         ──────────────────────

outer while True                              while True
  │                                             │
  connect to Postgres                           wait for queue.get()
  │                                             │
  inner while True                             got data → yield to browser
    │                                           │
    wait for NOTIFY from Postgres              is_disconnected? → break
    │                                           │
    push to sse_manager queue                  finally → disconnect(user_id)
    │
  Postgres drops?
    │
  break inner
    │
  sleep 5s
    │
  reconnect ← outer while True handles this

'''

# ─── SSE MANAGER ─────────────────────────────────────────────────────────────

class SSEManager:
    def __init__(self):
        self._connections: Dict[str, Set[asyncio.Queue]] = {}

    def connect(self, user_id: str):
        queue = asyncio.Queue()
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(queue)
        print(f"[SSE] User {user_id} connected. Active queues for user: {len(self._connections[user_id])}. Total active users: {len(self._connections)}")
        return queue, self._connections

    def disconnect(self, user_id: str, queue: Optional[asyncio.Queue] = None) -> None:
        if user_id in self._connections:
            if queue and queue in self._connections[user_id]:
                self._connections[user_id].remove(queue)
            if not queue or len(self._connections[user_id]) == 0:
                self._connections.pop(user_id, None)
                asyncio.create_task(self._log_tab_closed(user_id))
        print(f"[SSE] User {user_id} disconnected. Total active users: {len(self._connections)}")

    async def _log_tab_closed(self, user_id: str):
        try:
            from app.db.base import get_main_session_factory
            from app.repositories.login_history_repository import LoginHistoryRepository
            async with get_main_session_factory()() as db:
                repo = LoginHistoryRepository(db)
                await repo.record_logout(user_id=user_id, logout_reason="TAB_CLOSED")
        except Exception as e:
            print(f"[SSE] Tab closed logging failed for user {user_id}: {e}")

    def is_connected(self, user_id: str) -> bool:
        return user_id in self._connections and len(self._connections[user_id]) > 0

    def get_active_count(self, user_id: str) -> int:
        """Returns the number of active SSE stream connections for the given user_id."""
        if user_id in self._connections:
            return len(self._connections[user_id])
        return 0

    async def push(self, user_id: str, data: dict) -> None:
        if user_id in self._connections:
            for q in list(self._connections[user_id]):
                try:
                    await q.put(data)
                except Exception as e:
                    print(f"[SSE] Push error for user {user_id}: {e}")

    async def logout_user(self, user_id: str) -> None:
        """
        Sends a logout sentinel into all active queues for the user so the
        notifications_stream generator wakes up and closes the HTTP stream from the server side.
        """
        if user_id in self._connections:
            for q in list(self._connections[user_id]):
                try:
                    await q.put({"event_type": "logout", "message": "User logged out"})
                except Exception as e:
                    print(f"[SSE] Logout sentinel push error for user {user_id}: {e}")
            self.disconnect(user_id)
            print(f"[SSE] Sent logout sentinel and disconnected user {user_id}")


# Global singleton
sse_manager = SSEManager()


# ─── GUARDS ──────────────────────────────────────────────────────────────────

async def _check_user_is_active(user_id: str) -> bool:
    """Check user is not blocked/deactivated."""
    try:
        async with AsyncSession(get_main_engine()) as session:
            stmt = select(User.is_active).where(User.employee_id == user_id)
            result = await session.execute(stmt)
            return bool(result.scalar_one_or_none())
    except Exception as e:
        print(f"[SSE] _check_user_is_active error for {user_id}: {e}")
        return False


async def _check_notification_unread(notification_id: str) -> bool:
    """Check notification has not been read yet."""
    try:
        async with AsyncSession(get_main_engine()) as session:
            stmt = select(Notification.is_viewed).where(
                Notification.notification_id == notification_id
            )
            result = await session.execute(stmt)
            return result.scalar_one_or_none() is False
    except Exception as e:
        print(f"[SSE] _check_notification_unread error for {notification_id}: {e}")
        return False


# ─── PG LISTENER ─────────────────────────────────────────────────────────────

async def start_pg_listener() -> None:
    """
    Background task — listens for Postgres NOTIFY on 'new_notification'.

    Flow:
      Postgres NOTIFY
          → notification_callback puts raw payload into local_queue
          → inner while loop picks it up
          → routes to correct SSE user queue via sse_manager.push()

    Resilience:
      - TCP keepalive   → detects network drops / firewall idle cutoff
      - SELECT 1 ping   → detects Postgres restart / server-side timeout
      - outer while True → auto-reconnects on any failure
      - asyncio.sleep(5) → prevents hammering Postgres on repeated failures
      - CancelledError   → exits cleanly on app shutdown
    """

    sa_url = get_main_engine().url
    dsn = (
        f"postgresql://{sa_url.username}:{sa_url.password}"
        f"@{sa_url.host}:{sa_url.port}/{sa_url.database}"
    )

    logger.info("[SSE] pg_listener background task started.")

    while True:  # ── outer reconnect loop ─────────────────────────────────────
        conn = None
        local_queue: asyncio.Queue = asyncio.Queue()

        def notification_callback(connection, pid, channel, payload):
            local_queue.put_nowait(payload)

        try:
            # ── connect to Postgres with raw asyncpg connection ──────────────
            # Note: this version of asyncpg does not accept keepalive kwargs here.
            conn = await asyncpg.connect(
                dsn,
                server_settings={"jit": "off"},
            )
            await conn.add_listener('new_notification', notification_callback)
            await conn.add_listener('sales_lead_update', notification_callback)
            logger.info("[SSE] pg_listener connected — Listening on 'new_notification' and 'sales_lead_update'")

            while True:  # ── inner processing loop ─────────────────────────────
                try:
                    raw_payload = await asyncio.wait_for(
                        local_queue.get(), timeout=30.0
                    )
                except asyncio.TimeoutError:
                    # ── SELECT 1 ping every 30s ───────────────────────────────
                    # TCP keepalive handles network drops
                    # SELECT 1 catches Postgres restart / server-side timeouts
                    try:
                        await conn.execute("SELECT 1")
                        print("[SSE] pg_listener keepalive ok")
                    except Exception as ping_err:
                        print(f"[SSE] keepalive FAILED ({ping_err}) — reconnecting...")
                        break  # break inner → outer loop reconnects
                    continue

                print(f"[SSE] Raw payload received: {raw_payload}")

                # ── parse payload ─────────────────────────────────────────────
                try:
                    payload: dict = json.loads(raw_payload)
                except Exception:
                    print(f"[SSE] Dropping malformed payload: {raw_payload}")
                    continue

                event_type = payload.get("event_type", "notification")

                # ── ROUTE 1: dashboard broadcast to ALL active users ──────────
                if event_type == "dashboard_metrics_trigger":
                    # When we hear the trigger, we fetch fresh stats and push to everyone.
                    # This happens once per worker per trigger.
                    print("[SSE] dashboard_metrics_trigger — Recalculating stats...")
                    try:
                        async with get_main_session_factory()() as session:
                            from app.services.tracking.tracker_service import TrackerService
                            from app.services.dashboard_service import DashboardService
                            
                            tracker_repo = TrackerRepository(session)
                            tracker_service = TrackerService(tracker_repo)
                            
                            dash_repo = DashboardRepository(session)
                            dash_service = DashboardService(dash_repo)

                            stats = await tracker_service.get_service_tracker_count_by_emp_id("1223","MANAGER")
                            
                            # Fetch fresh stats
                            stats = await dash_service.get_all_stats(tracker_service=tracker_service)
                            stats["event_type"] = "dashboard_metrics"
                            
                            # PUSH to all local clients (no extra DB guards here to keep it FAST)
                            conn_ids = list(sse_manager._connections.keys())
                            for uid in conn_ids:
                                await sse_manager.push(uid, stats)
                            print(f"[SSE] dashboard_metrics pushed to {len(conn_ids)} users.")

                    except Exception as e:
                        print(f"[SSE] dashboard recalculation failed: {e}")
                    continue

                if event_type in (
                    "dashboard_production_summary_trigger",
                    "dashboard_production_summary",
                ):
                    print(f"[SSE] {event_type} — Fetching production summary...")
                    try:
                        async with get_main_session_factory()() as session:
                            from app.services.dashboard_service import DashboardService

                            dash_service = DashboardService(DashboardRepository(session))
                            summary = await dash_service.get_production_dashboard_summary()
                            message = {
                                "event_type": "dashboard_production_summary",
                                "data": summary,
                            }
                            for uid in list(sse_manager._connections.keys()):
                                await sse_manager.push(uid, message)
                            print(f"[SSE] dashboard_production_summary pushed to {len(sse_manager._connections)} users.")
                    except Exception as e:
                        print(f"[SSE] production dashboard refresh failed: {e}")
                    continue

                if event_type in (
                    "dashboard_revenue_trigger",
                    "dashboard_revenue",
                ):
                    print(f"[SSE] {event_type} — Fetching revenue dashboard...")
                    try:
                        async with get_main_session_factory()() as session:
                            from app.services.dashboard_service import DashboardService

                            dash_repo = DashboardRepository(session)
                            await dash_repo.refresh_revenue_materialized_view()
                            dash_service = DashboardService(dash_repo)
                            revenue_data = await dash_service.get_revenue_dashboard()
                            message = {
                                "event_type": "dashboard_revenue",
                                "data": revenue_data,
                            }
                            for uid in list(sse_manager._connections.keys()):
                                await sse_manager.push(uid, message)
                            print(f"[SSE] dashboard_revenue pushed to {len(sse_manager._connections)} users.")
                    except Exception as e:
                        print(f"[SSE] revenue dashboard refresh failed: {e}")
                    continue


                if event_type == "tracker_update_trigger":
                    # When we hear the trigger, we fetch fresh stats and push to everyone.
                    # This happens once per worker per trigger.
                    print("[SSE] tracker_update_trigger — Recalculating stats...")
                    try:
                        async with get_main_session_factory()() as session:
                            from app.services.tracking.tracker_service import TrackerService
                            
                            tracker_repo = TrackerRepository(session)
                            tracker_service = TrackerService(tracker_repo)
                            
                       

                            stats = await tracker_service.get_service_tracker_count_by_emp_id("1223","MANAGER")
                            
                            # Fetch fresh stats
                            stats["event_type"] = "tracker_update_trigger"
                            
                            # PUSH to all local clients (no extra DB guards here to keep it FAST)
                            conn_ids = list(sse_manager._connections.keys())
                            for uid in conn_ids:
                                await sse_manager.push(uid, stats)
                            print(f"[SSE] tracker_update_trigger pushed to {len(conn_ids)} users.")

                    except Exception as e:
                        print(f"[SSE] tracker_update_trigger recalculation failed: {e}")
                    continue


                if event_type == "dashboard_metrics":
                    # Fallback for old style (or items that managed to fit in pg_notify)
                    for uid in list(sse_manager._connections.keys()):
                        try:
                            # Still remove the expensive _check_user_is_active for broadcast
                            await sse_manager.push(uid, payload)
                        except Exception:
                            pass
                    continue

                # ── ROUTE 1b: BOM dashboard broadcast to ALL active users ───
                # Refresh triggers do not have a target user, so they must be
                # handled before the targeted-notification routing below.
                if event_type in (
                    "dashboard_bom_availability_trigger",
                    "dashboard_bom_availability",
                ):
                    print(f"[SSE] {event_type} — Fetching BOM availability...")
                    try:
                        async with get_main_session_factory()() as session:
                            from app.services.dashboard_service import DashboardService

                            dashboard_service = DashboardService(DashboardRepository(session))
                            bom_dashboard = await dashboard_service.get_bom_inventory_dashboard()
                            message = {
                                "event_type": "dashboard_bom_availability",
                                "data": bom_dashboard,
                            }
                            for uid in list(sse_manager._connections.keys()):
                                await sse_manager.push(uid, message)
                            print(
                                "[SSE] dashboard_bom_availability pushed to "
                                f"{len(sse_manager._connections)} users."
                            )
                    except Exception as exc:
                        print(f"[SSE] BOM dashboard refresh failed: {exc}")
                    continue

                # ── ROUTE 2: targeted notification to specific user ───────────
                target_user_id = payload.get("approver_id") or payload.get("user_id")
                notification_id = payload.get("notification_id")

                if not target_user_id:
                    print("[SSE] No target_user_id in payload — skipping")
                    continue

                # Guard 1 — is user connected right now?
                if not sse_manager.is_connected(target_user_id):
                    print(f"[SSE] User {target_user_id} not connected — skipping")
                    continue

                # Guard 2 — is user active in the system?
                if not await _check_user_is_active(target_user_id):
                    print(f"[SSE] User {target_user_id} not active — skipping")
                    continue

                # Guard 3 — is notification unread?
                if event_type == "notification" and notification_id:
                    if not await _check_notification_unread(notification_id):
                        print(f"[SSE] Notification {notification_id} already read — skipping")
                        continue

                # all guards passed — push to user
                await sse_manager.push(target_user_id, payload)
                print(f"[SSE] Pushed {event_type} to user {target_user_id}")

        except asyncio.CancelledError:
            # app is shutting down — exit cleanly, don't reconnect
            print("[SSE] pg_listener cancelled (app shutdown)")
            break

        except Exception as e:
            logger.error(f"[SSE] pg_listener unexpected crash: {e}", exc_info=True)
            # wait before reconnecting with small jitter to avoid thundering herd on workers=2
            import random
            await asyncio.sleep(5 + random.uniform(0, 3))

        finally:
            if conn and not conn.is_closed():
                try:
                    await conn.remove_listener('new_notification', notification_callback)
                    await conn.close()
                except Exception as close_err:
                    print(f"[SSE] error closing pg_listener conn: {close_err}")
            print("[SSE] pg_listener connection closed.")

        # wait before reconnecting — prevents hammering Postgres
        print("[SSE] pg_listener reconnecting in 5s...")
        await asyncio.sleep(5)




####################################### WITH ASYNC AND WITHOUT RETRY LOGIC #######################################


# import asyncio
# import json
# import asyncpg
# import uuid
# from typing import Dict, List
# from sqlalchemy import text, select
# from sqlalchemy.ext.asyncio import AsyncSession

# from app.db.base import async_engine

# from app.models.notification import Notification

# _LOGOUT_SENTINEL = {"type": "logout"}

# # ─── SSE MANAGER: Handles the in-memory connection registry ────────────────
# class SSEManager:
#     def __init__(self):
#         # Maps user_id (str) -> asyncio.Queue
#         self._connections: Dict[str, asyncio.Queue] = {}

#     def connect(self, user_id: str) -> asyncio.Queue:
#         queue = asyncio.Queue()
#         self._connections[user_id] = queue
#         print(f"[SSE] User {user_id} connected. Total active: {len(self._connections)}")
#         return queue

#     def disconnect(self, user_id: str) -> None:
#         self._connections.pop(user_id, None)
#         print(f"[SSE] User {user_id} disconnected. Total active: {len(self._connections)}")

#     def is_connected(self, user_id: str) -> bool:
#         return user_id in self._connections

#     async def push(self, user_id: str, data: dict) -> None:
#         if user_id in self._connections:
#             await self._connections[user_id].put(data)

# # Global singleton
# sse_manager = SSEManager()

# # ─── GUARDS: Permission and Status Checks ────────────────────────────────────

# async def _check_user_is_active(user_id: str) -> bool:
#     """Guard 2: Ensure user hasn't been blocked/deactivated."""
#     try:
#         async with AsyncSession(async_engine) as session:
#             stmt = select(User.is_active).where(User.user_id == user_id)
#             result = await session.execute(stmt)
#             return bool(result.scalar_one_or_none())
#     except Exception:
#         return False

# async def _check_notification_unread(notification_id: str) -> bool:
#     """Guard 3: Ensure we don't push notifications the user already read."""
#     try:
#         async with AsyncSession(async_engine) as session:
#             stmt = select(Notification.is_viewed).where(
#                 Notification.notification_id == notification_id
#             )
#             result = await session.execute(stmt)
#             # Returns True if unread (is_viewed is False)
#             return result.scalar_one_or_none() is False
#     except Exception:
#         return False

# # ─── PG LISTENER: The 'Radio Station' listening to Postgres ─────────────────

# async def start_pg_listener() -> None:
#     """
#     Background task that listens for 'new_notification' from Postgres.
#     Routes data to users based on event_type.
#     """
#     sa_url = async_engine.url
#     dsn = (
#         f"postgresql://{sa_url.username}:{sa_url.password}"
#         f"@{sa_url.host}:{sa_url.port}/{sa_url.database}"
#     )

#     local_queue = asyncio.Queue()

#     # Callback used by asyncpg when a NOTIFY arrives
#     def notification_callback(connection, pid, channel, payload):
#         local_queue.put_nowait(payload)

#     # Establish raw connection to Postgres for LISTEN
#     conn: asyncpg.Connection = await asyncpg.connect(dsn)
#     print("[SSE] pg_listener started – Listening on 'new_notification'")

#     try:
#         await conn.add_listener('new_notification', notification_callback)

#         while True:
#             try:
#                 # Wait for data from the local queue (bridged from Postgres)
#                 raw_payload = await asyncio.wait_for(local_queue.get(), timeout=30.0)
#                 print(raw_payload,"RAW PAYLOAD RECEIVED FROM PG LISTENER")
#             except asyncio.TimeoutError:
#                 continue

#             try:
#                 payload: dict = json.loads(raw_payload)
#             except Exception:
#                 print(f"[SSE] Dropping malformed payload: {raw_payload}")
#                 continue

#             event_type = payload.get("event_type", "notification")

#             # ─── ROUTE 1: DASHBOARD BROADCAST ────────────────────────────────
#             # This happens when items are inserted/updated in procurement_table
#             if event_type == "dashboard_metrics":
#                 active_users = list(sse_manager._connections.keys())
#                 for uid in active_users:
#                     # Dashboard data is public, but we still verify the user is active
#                     if await _check_user_is_active(uid):
#                         await sse_manager.push(uid, payload)
#                 continue

#             # ─── ROUTE 2: TARGETED NOTIFICATION ──────────────────────────────
#             # This is for specific user alerts (e.g., 'Your request was approved')
#             target_user_id = payload.get("user_id")
#             notification_id = payload.get("notification_id")

#             # Guard 1: Is the user actually online right now?
#             if not sse_manager.is_connected(target_user_id):
#                 print(1)
#                 continue

#             # Guard 2: Is the user active in the system?
#             if not await _check_user_is_active(target_user_id):
#                 print(2)
#                 continue

#             # Guard 3: Is this a notification? Check if it is unread.
#             if event_type == "notification" and notification_id:
#                 print(4)
#                 if not await _check_notification_unread(notification_id):
#                     print(5)
#                     continue

#             # Pass all guards? Push it!
#             print(f"5q44444444444444444444444444444444444444444")
#             await sse_manager.push(target_user_id, payload)

#     except Exception as e:
#         print(f"[SSE] pg_listener encountered a CRITICAL error: {e}")
#         raise
#     finally:
#         await conn.remove_listener('new_notification', notification_callback)
#         await conn.close()
#         print("[SSE] pg_listener connection closed.")

        
#################### SYNC CONNCETION



# import asyncio
# import json
# import asyncpg
# from typing import Dict
# from sqlalchemy import text, select
# from sqlalchemy.ext.asyncio import AsyncSession

# from app.db.base import async_engine          # reuse the already-configured engine

# from app.models.notification import Notification  # adjust import path

# _LOGOUT_SENTINEL = {"type": "logout"}

# # ─── Global registry: user_id (str) → asyncio.Queue ──────────────────────────
# class SSEManager:
#     def __init__(self):

#         # { "uuid-string": asyncio.Queue }
#         self._connections: Dict[str, asyncio.Queue] = {}

#     # ── connect / disconnect ──────────────────────────────────────────────────
#     def connect(self, user_id: str) -> asyncio.Queue:
#         """Register a user's SSE socket and hand back their personal queue."""
#         queue: asyncio.Queue = asyncio.Queue()
#         self._connections[user_id] = queue
#         print(f"[SSE] user {user_id} connected  | active: {list(self._connections.keys())}")
#         return queue

#     def disconnect(self, user_id: str) -> None:
#         """Remove the user from active connections (called when the HTTP stream closes)."""
#         self._connections.pop(user_id, None)
#         print(f"[SSE] user {user_id} disconnected | active: {list(self._connections.keys())}")

#     # ── queries ───────────────────────────────────────────────────────────────
#     def is_connected(self, user_id: str) -> bool:
#         """Check 1 – Is the user's SSE socket currently open?"""
#         return user_id in self._connections

#     # ── delivery ──────────────────────────────────────────────────────────────
#     async def push(self, user_id: str, data: dict) -> None:
#         """Put a payload into the user's queue so the SSE generator can yield it."""
#         if user_id in self._connections:
#             await self._connections[user_id].put(data)

#     async def logout_user(self, user_id: str) -> None:
#         """
#         Called from the logout endpoint.
#         Sends a logout sentinel into the user's queue so the
#         event_generator wakes up and closes the stream gracefully.
#         """
#         if user_id in self._connections:
#             await self._connections[user_id].put(_LOGOUT_SENTINEL)
#             print(f"[SSE] logout sentinel sent to user {user_id}")
#         # disconnect() will be called by the generator's finally block
# # Singleton used across the whole app
# sse_manager = SSEManager()


# # ─── 3 guards before delivery ────────────────────────────────────────────────
# async def _check_user_is_active(user_id: str) -> bool:
#     """Check 2 – Is is_active = true in the users table?"""
#     async with AsyncSession(async_engine) as session:
#         stmt = select(User.is_active).where(User.user_id == user_id)
#         result = await session.execute(stmt)
#         is_active = result.scalar_one_or_none()
#         return bool(is_active)


# async def _check_notification_unread(notification_id: str) -> bool:
#     """Check 3 – Is is_viewed = false for this notification?"""
#     async with AsyncSession(async_engine) as session:
#         stmt = select(Notification.is_viewed).where(
#             Notification.notification_id == notification_id
#         )
#         result = await session.execute(stmt)
#         is_viewed = result.scalar_one_or_none()
#         # We want is_viewed == False (i.e., unread)
#         return is_viewed is False


# # ─── Background LISTEN task ──────────────────────────────────────────────────
# # async def start_pg_listener() -> None:
# #     """
# #     Long-running coroutine (launch once on app startup via lifespan/on_startup).
# #     Opens ONE raw asyncpg connection, LISTENs on 'new_notification',
# #     and dispatches every NOTIFY to the right user after running the 3 guards.
# #     """
# #     # Build a plain asyncpg DSN from the already-configured SQLAlchemy engine URL
# #     # async_engine.url  →  postgresql+asyncpg://user:pw@host:port/db
# #     # asyncpg.connect() →  postgresql://user:pw@host:port/db
# #     sa_url = async_engine.url
# #     dsn = (
# #         f"postgresql://{sa_url.username}:{sa_url.password}"
# #         f"@{sa_url.host}:{sa_url.port}/{sa_url.database}"
# #     )

# #     conn: asyncpg.Connection = await asyncpg.connect(dsn)
# #     print("[SSE] pg_listener started – listening on 'new_notification'")

# #     try:
# #         await conn.execute("LISTEN new_notification;")

# #         while True:
# #             # wait up to 30 s; if nothing arrives, loop again (keeps the task alive)
# #             try:
# #                 msg = await asyncio.wait_for(
# #                     conn.wait_for_notify(),
# #                     timeout=30.0,
# #                 )
# #             except asyncio.TimeoutError:
# #                 # no notification in 30 s – just keep listening
# #                 continue

# #             # ── Parse payload ──────────────────────────────────────────────
# #             try:
# #                 payload: dict = json.loads(msg.payload)
# #             except Exception:
# #                 print(f"[SSE] bad payload: {msg.payload}")
# #                 continue

# #             target_user_id: str = payload.get("user_id", "")
# #             notification_id: str = payload.get("notification_id", "")

# #             print(f"[SSE] NOTIFY received → user={target_user_id} notif={notification_id}")

# #             # ── Guard 1: Is the user's socket open? ───────────────────────
# #             if not sse_manager.is_connected(target_user_id):
# #                 print(f"[SSE] user {target_user_id} is OFFLINE – notification stored for later fetch")
# #                 continue

# #             # ── Guard 2: Is the user active in the DB? ────────────────────
# #             if not await _check_user_is_active(target_user_id):
# #                 print(f"[SSE] user {target_user_id} is_active=false – skipping push")
# #                 continue

# #             # ── Guard 3: Is the notification still unread? ────────────────
# #             if not await _check_notification_unread(notification_id):
# #                 print(f"[SSE] notification {notification_id} already read – skipping push")
# #                 continue

# #             # ── All guards passed → push to the user's SSE queue ─────────
# #             await sse_manager.push(target_user_id, payload)
# #             print(f"[SSE] event pushed to user {target_user_id}")

# #     except Exception as e:
# #         print(f"[SSE] pg_listener crashed: {e}")
# #         raise
# #     finally:
# #         await conn.close()
# #         print("[SSE] pg_listener connection closed")


# async def start_pg_listener() -> None:
#     """
#     Corrected version using asyncpg.add_listener logic.
#     """
#     sa_url = async_engine.url
#     dsn = (
#         f"postgresql://{sa_url.username}:{sa_url.password}"
#         f"@{sa_url.host}:{sa_url.port}/{sa_url.database}"
#     )

#     # 1. Create a local queue to hold notifications as they arrive
#     local_queue = asyncio.Queue()

#     # 2. Define the callback that asyncpg calls when it hears a NOTIFY
#     def notification_callback(connection, pid, channel, payload):
#         # We put the string payload into our local queue to be processed by the loop
#         local_queue.put_nowait(payload)

#     conn: asyncpg.Connection = await asyncpg.connect(dsn)
#     print("[SSE] pg_listener started – listening on 'new_notification'")

#     try:
#         # 3. Register the listener on the specific channel
#         await conn.add_listener('new_notification', notification_callback)

#         while True:
#             # 4. Wait for a notification to appear in our local queue
#             try:
#                 # We wait for the string payload put there by the callback
#                 raw_payload = await asyncio.wait_for(
#                     local_queue.get(),
#                     timeout=30.0,
#                 )
#             except asyncio.TimeoutError:
#                 # No notification in 30s, keep the loop alive
#                 continue

#             # ── Parse payload ──────────────────────────────────────────────
#             try:
#                 payload: dict = json.loads(raw_payload)
#             except Exception:
#                 print(f"[SSE] bad payload: {raw_payload}")
#                 continue

#             target_user_id: str = payload.get("user_id", "")
#             notification_id: str = payload.get("notification_id", "")

#             print(f"[SSE] NOTIFY received → user={target_user_id} notif={notification_id}")

#             # ── Guard 1: Is the user's socket open? ───────────────────────
#             if not sse_manager.is_connected(target_user_id):
#                 print(f"[SSE] user {target_user_id} is OFFLINE")
#                 continue

#             # ── Guard 2: Is the user active in the DB? ────────────────────
#             if not await _check_user_is_active(target_user_id):
#                 print(f"[SSE] user {target_user_id} is_active=false")
#                 continue

#             # ── Guard 3: Is the notification still unread? ────────────────
#             if not await _check_notification_unread(notification_id):
#                 print(f"[SSE] notification {notification_id} already read")
#                 continue

#             # ── All guards passed → push to the user's SSE queue ─────────
#             await sse_manager.push(target_user_id, payload)
#             print(f"[SSE] event pushed to user {target_user_id}")

#     except Exception as e:
#         print(f"[SSE] pg_listener crashed: {e}")
#         raise
#     finally:
#         # Cleanup: remove listener before closing
#         await conn.remove_listener('new_notification', notification_callback)
#         await conn.close()
#         print("[SSE] pg_listener connection closed")
