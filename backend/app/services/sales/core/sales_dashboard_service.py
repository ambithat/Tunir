import json
import sys
import asyncio
import asyncpg
from typing import Optional, List, Dict, Any
from decimal import Decimal
from datetime import date, datetime

from app.repositories.sales.sales_dashboard_repository import SalesDashboardRepository
from app.utils.sse_manager import sse_manager
from app.db.base import get_main_engine, get_main_session_factory
from app.core.config import logger


def json_serializer(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


class SalesDashboardService:
    def __init__(self, repository: SalesDashboardRepository):
        self.repository = repository

    async def get_kpis(self, lead_owner_id: Optional[int] = None) -> Dict[str, Any]:
        '''
        Calculates overall summary KPI metrics.
        '''
        return await self.repository.get_kpis_summary(lead_owner_id=lead_owner_id)

    async def get_kpis_by_status(self) -> Dict[str, int]:
        '''
        Calculates lead counts grouped by status as a key-value dictionary.
        '''
        return await self.repository.get_kpis_by_status()

    async def get_kpis_by_stage(self) -> Dict[str, int]:
        '''
        Calculates lead counts grouped by stage as a key-value dictionary.
        '''
        return await self.repository.get_kpis_by_stage()

    async def get_kpis_by_stage_by_product(self) -> Dict[str, Dict[str, int]]:
        '''
        Calculates product count distribution per stage: { stage_name: { product_name: count } }.
        '''
        return await self.repository.get_kpis_by_stage_by_product()

    async def get_kpis_by_status_by_product(self) -> Dict[str, Dict[str, int]]:
        '''
        Calculates product count distribution per status: { status_name: { product_name: count } }.
        '''
        return await self.repository.get_kpis_by_status_by_product()

    async def get_kpis_by_leader(self) -> List[Dict[str, Any]]:
        '''
        Calculates KPI breakdown per leader/owner for the 'More Info' view.
        '''
        return await self.repository.get_kpis_by_leader()

    async def get_lead_details(self, lead_owner_id: Optional[int] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        '''
        Fetches complete joined table details from repository with optional search filter.
        '''
        records = await self.repository.get_lead_details(lead_owner_id=lead_owner_id, search=search)
        results = []
        for r in records:
            results.append({
                "lead_id": r.lead_id,
                "company": r.company,
                "contact_name": r.contact_name,
                "designation": r.designation,
                "phone_no": r.phone_no,
                "email": r.email,
                "country": r.country,
                "lead_source": r.lead_source,
                "project_value": float(r.project_value) if r.project_value is not None else None,
                "expected_closure": r.expected_closure.isoformat() if r.expected_closure else None,
                "lead_is_active": r.lead_is_active,
                "lead_created_date": r.lead_created_date.isoformat() if r.lead_created_date else None,
                "lead_owner_id": r.lead_owner_id,
                "lead_owner_name": r.lead_owner_name,
                "lead_owner_email": r.lead_owner_email,
                "product_register_id": r.product_register_id,
                "product_id": r.product_id,
                "product_name": r.product_name,
                "quantity": r.quantity,
                "status_id": r.status_id,
                "status_name": r.status_name,
                "stage_id": r.stage_id,
                "stage_name": r.stage_name,
                "probability": float(r.probability) if r.probability is not None else None,
                "won": r.won,
                "pipeline": float(r.pipeline) if r.pipeline is not None else None,
                "risk_matrix": r.risk_matrix,
                "product_is_active": r.product_is_active,
                "product_created_at": r.product_created_at.isoformat() if r.product_created_at else None,
                "last_refreshed_at": r.last_refreshed_at.isoformat() if r.last_refreshed_at else None
            })
        return results

    async def refresh_materialized_views(self) -> None:
        '''
        Triggers concurrent refresh of sales_lead_details_mv via repository.
        '''
        try:
            await self.repository.refresh_materialized_view()
            print(f"[SalesDashboard] 🔄 Concurrently refreshed sales_lead_details_mv at {datetime.now()}", flush=True)
            logger.info("[SalesDashboardService] Concurrently refreshed sales_lead_details_mv.")
        except Exception as e:
            print(f"[SalesDashboard Error] ❌ Refresh materialized view error: {e}", flush=True)
            logger.error(f"[SalesDashboardService] Refresh materialized view error: {e}")
            raise e

    async def notify_sales_lead_update(self, payload: str = "lead_updated") -> None:
        '''
        Triggers pg_notify on sales_lead_update channel via repository.
        '''
        await self.repository.notify_sales_lead_update(payload=payload)


    async def get_kpis_by_product(self) -> Dict[str, Any]:
        '''
        Calculates product counts and won/lost counts from repository.
        '''
        return await self.repository.get_kpis_by_product()

    async def get_stage_distribution_by_pipeline(self) -> List[Dict[str, Any]]:
        '''
        Calculates product-wise stage distribution by pipeline amount from repository.
        '''
        return await self.repository.get_stage_distribution_by_pipeline()

    async def broadcast_kpi_update(self, user_id: str = "global") -> None:
        '''
        Pushes updated KPI payload into SSEManager for ALL active connected SSE clients.
        '''
        summary_kpis = await self.get_kpis()
        status_breakdown = await self.get_kpis_by_status()
        stage_breakdown = await self.get_kpis_by_stage()
        leader_breakdown = await self.get_kpis_by_leader()
        product_info = await self.get_kpis_by_product()
        stage_pipeline_dist = await self.get_stage_distribution_by_pipeline()
        stage_by_product = await self.get_kpis_by_stage_by_product()
        status_by_product = await self.get_kpis_by_status_by_product()
        
        payload = {
            "event": "sales_dashboard_kpis",
            "data": {
                "summary": summary_kpis,
                "by_status": status_breakdown,
                "by_stage": stage_breakdown,
                "by_leader": leader_breakdown,
                "by_product": product_info["by_product"],
                "by_stage_by_product": stage_by_product,
                "by_status_by_product": status_by_product,
                "won_count_by_product": product_info.get("won_count_by_product", {}),
                "lost_count_by_product": product_info.get("lost_count_by_product", {}),
                "total_won_count": product_info["won_count"],
                "total_lost_count": product_info["lost_count"],
                "stage_distribution_by_pipeline": stage_pipeline_dist
            }
        }


        
        output_str = "\n" + "=" * 70 + "\n"
        output_str += "  📡 [SSE DATA BROADCAST TO TERMINAL]\n"
        output_str += "=" * 70 + "\n"
        output_str += json.dumps(payload, indent=2, default=json_serializer) + "\n"
        output_str += "=" * 70 + "\n"
        
        print(output_str, flush=True)
        sys.stdout.flush()

        active_users = list(sse_manager._connections.keys())
        if active_users:
            print(f"[SSE Broadcast] 📡 Pushing update to {len(active_users)} active connected users: {active_users}", flush=True)
            for uid in active_users:
                await sse_manager.push(uid, payload)
        else:
            await sse_manager.push(user_id, payload)


# ─── LISTEN & CRON BACKGROUND TASKS ───────────────────────────────────────────

async def start_sales_lead_pg_listener() -> None:
    '''
    Background listener for PostgreSQL pg_notify on channel 'sales_lead_update'.
    Triggers concurrent materialized view refresh and broadcasts SSE updates.
    '''
    sa_url = get_main_engine().url
    dsn = (
        f"postgresql://{sa_url.username}:{sa_url.password}"
        f"@{sa_url.host}:{sa_url.port}/{sa_url.database}"
    )

    print("[SalesDashboard] 🚀 Starting pg_listen background listener on channel 'sales_lead_update'...", flush=True)
    logger.info("[SalesDashboard] Starting pg_listen background listener on 'sales_lead_update'...")

    while True:
        try:
            conn = await asyncpg.connect(dsn)
            queue: asyncio.Queue = asyncio.Queue()

            def handle_notify(connection, pid, channel, payload):
                queue.put_nowait(payload)

            await conn.add_listener("sales_lead_update", handle_notify)
            await conn.add_listener("sales_notification_update", handle_notify)
            print("[SalesDashboard] ✅ pg_listen connected and active on channels 'sales_lead_update' and 'sales_notification_update'", flush=True)
            logger.info("[SalesDashboard] pg_listen connected on 'sales_lead_update' & 'sales_notification_update'")

            # Print initial snapshot data to terminal on listener connect
            try:
                session_factory = get_main_session_factory()
                async with session_factory() as session:
                    repo = SalesDashboardRepository(session)
                    service = SalesDashboardService(repo)
                    await service.broadcast_kpi_update("global")
            except Exception as init_err:
                print(f"[SalesDashboard] Initial data print warning: {init_err}", flush=True)

            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=30.0)
                    print(f"\n[pg_notify] 🔔 Received PostgreSQL trigger notification: {payload}", flush=True)
                    logger.info(f"[SalesDashboard] Received pg_notify: {payload}")
                    
                    try:
                        payload_dict = json.loads(payload)
                    except Exception:
                        payload_dict = {}

                    # Refresh Materialized Views concurrently & Broadcast SSE
                    session_factory = get_main_session_factory()
                    async with session_factory() as session:
                        repo = SalesDashboardRepository(session)
                        service = SalesDashboardService(repo)

                        if payload_dict.get("table") == "sales_notifications" or "notification_id" in payload:
                            await repo.refresh_notifications_materialized_view()
                            user_id = payload_dict.get("user_id")
                            msg = payload_dict.get("message", "")

                            # Ensure leader_id is present in payload_dict
                            if not payload_dict.get("leader_id") and user_id:
                                from app.repositories.sales.leader_repository import LeaderRepository
                                l_repo = LeaderRepository(session)
                                leader_obj = await l_repo.get_leader_by_emp_id(user_id)
                                if leader_obj:
                                    payload_dict["leader_id"] = leader_obj.leader_id

                            # Fetch notification_type from DB if not in pg_notify payload
                            if not payload_dict.get("notification_type") and payload_dict.get("notification_id"):
                                try:
                                    from app.models.sales.sales_notification import SalesNotification
                                    from sqlalchemy import select
                                    n_stmt = select(SalesNotification.notification_type).where(
                                        SalesNotification.notification_id == payload_dict.get("notification_id")
                                    )
                                    n_res = await session.execute(n_stmt)
                                    notif_type = n_res.scalar_one_or_none()
                                    if notif_type:
                                        payload_dict["notification_type"] = notif_type
                                except Exception as n_err:
                                    print(f"[SalesDashboard] Could not fetch notification_type: {n_err}")

                            notif_type = payload_dict.get("notification_type") or "STAGE_UPDATE"
                            payload_dict["notification_type"] = notif_type

                            # Terminal print for background trigger
                            trg_str = "\n" + "🔔" * 35 + "\n"
                            trg_str += f"  [POSTGRES NOTIFY TRIGGER FIRED — {notif_type} FOR RECIPIENT USER: '{user_id}']\n"
                            trg_str += "-" * 70 + "\n"
                            trg_str += f"  📌 Notif ID : {payload_dict.get('notification_id', 'N/A')}\n"
                            trg_str += f"     Type     : {notif_type}\n"
                            trg_str += f"     User ID  : {user_id}\n"
                            trg_str += f"     Leader ID: {payload_dict.get('leader_id', 'N/A')}\n"
                            trg_str += f"     Message  : {msg}\n"
                            trg_str += "-" * 70 + "\n"
                            trg_str += "🔔" * 35 + "\n"
                            print(trg_str, flush=True)

                            if user_id:
                                notif_event = {
                                    "event_type": "sales_notification",
                                    "event": "sales_notification",
                                    "notification_type": notif_type,
                                    "data": payload_dict
                                }
                                await sse_manager.push(user_id, notif_event)
                                print(f"[SalesNotification SSE] 📡 Pushed live popup notification (Leader ID: {payload_dict.get('leader_id')}) to user '{user_id}'", flush=True)
                        else:
                            await service.refresh_materialized_views()
                            await service.broadcast_kpi_update("global")

                except asyncio.TimeoutError:
                    await conn.execute("SELECT 1")
                except Exception as inner_err:
                    print(f"[SalesDashboard Error] ❌ Listener inner loop error: {inner_err}", flush=True)
                    logger.error(f"[SalesDashboard] Listener inner loop error: {inner_err}")
                    break
        except asyncio.CancelledError:
            print("[SalesDashboard] 🛑 pg_listen background listener stopped.", flush=True)
            logger.info("[SalesDashboard] pg_listen listener stopped.")
            break
        except Exception as e:
            print(f"[SalesDashboard Error] ❌ pg_listen connection error: {e}. Reconnecting in 5s...", flush=True)
            logger.error(f"[SalesDashboard] pg_listen connection error: {e}. Reconnecting in 5s...")
            await asyncio.sleep(5)


async def start_sales_dashboard_cron(interval_seconds: int = 300) -> None:
    '''
    Cron background scheduler task.
    Periodically refreshes sales materialized view every interval_seconds (default 5 minutes).
    '''
    print(f"[SalesDashboard Cron] ⏱️ Starting periodic cron scheduler (interval: {interval_seconds}s)...", flush=True)
    logger.info(f"[SalesDashboard] Starting periodic cron scheduler (interval: {interval_seconds}s)...")
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            print(f"\n[SalesDashboard Cron] ⏰ 5-minute timer triggered! Refreshing sales materialized view at {datetime.now()}...", flush=True)
            session_factory = get_main_session_factory()
            async with session_factory() as session:
                repo = SalesDashboardRepository(session)
                service = SalesDashboardService(repo)
                await service.refresh_materialized_views()
                await repo.refresh_notifications_materialized_view()
                await service.broadcast_kpi_update("global")

                # Check and push today's lead action reminders to SSE connected leaders
                from app.services.sales.lead_reminder_service import fetch_and_push_today_lead_action_reminders
                await fetch_and_push_today_lead_action_reminders()

                # Process pending and failed mail events (retries)
                try:
                    from app.services.sales.mail_event_service import process_pending_mail_events
                    await process_pending_mail_events()
                except Exception as mail_err:
                    logger.warning(f"[SalesDashboard Cron] Mail events processor warning: {mail_err}")

                print(f"[SalesDashboard Cron] ✅ 5-min materialized view refresh and broadcast completed at {datetime.now()}\n", flush=True)
                logger.info("[SalesDashboard Cron] Periodic materialized view refresh completed.")
        except asyncio.CancelledError:
            print("[SalesDashboard Cron] 🛑 Scheduler stopped.", flush=True)
            logger.info("[SalesDashboard Cron] Scheduler stopped.")
            break
        except Exception as e:
            print(f"[SalesDashboard Cron Error] ❌ Periodic refresh error: {e}", flush=True)
            logger.error(f"[SalesDashboard Cron] Periodic refresh error: {e}")
