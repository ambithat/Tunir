
import asyncio
import json
from fastapi.encoders import jsonable_encoder

from typing import Optional
from fastapi import (Depends, FastAPI, HTTPException, WebSocketDisconnect, status, APIRouter, Query,
                     Body, Form, File, UploadFile, Request, WebSocket)
from fastapi.responses import JSONResponse, StreamingResponse
# from app.config  import settings as global_settings



from app.dependency.auth_dependency import verify_access_token_dep, verify_access_token_dep_sse
from app.dependency.tracking.notification_dependency import get_notification_service
from app.dependency.tracking.tracker_dependency import get_tracker_service, get_tracker_history_service
from app.dependency.dashboard_dependency import get_dashboard_service

from contextlib import asynccontextmanager
from app.db.base import get_db
from app.repositories.dashboard_repository import DashboardRepository
from app.repositories.tracking.notification_repository import NotificationRepository
from app.repositories.tracking.tracker_repository import TrackerRepository
from app.services.tracking.notification_service import NotificationService
from app.services.tracking.tracker_service import TrackerService, TrackerHistoryService
from app.services.dashboard_service import DashboardService
from app.services.tracking.notification_service import NotificationService
from app.exceptions.tracking.notification_exception import NotificationNotFound

from app.models.sales.leader import Leader
from app.utils.sse_manager import sse_manager

notification_router = APIRouter()


############################################   SALES NOTIFICATIONS INFO   ########################################################################################







# ── Sales Notification Endpoints ──────────────────────────────────────────

@notification_router.get("/api/v1/sales/notifications/all", summary="Fetch All Sales Notifications", dependencies=[Depends(verify_access_token_dep)])
async def get_all_sales_notifications(request: Request):
    """Fetch all sales notifications for the logged-in user."""
    employee_id: str = request.state.employee_id
    leader_obj = getattr(request.state, "user", None)
    leader_id = getattr(leader_obj, "leader_id", employee_id) or employee_id

    async_get_db = asynccontextmanager(get_db)
    async with async_get_db() as db:
        from sqlalchemy import text
        res = await db.execute(
            text("""
                SELECT notification_id, user_id, first_name, last_name, email, designation,
                       target_id, notification_type, message, is_viewed, created_at, last_refreshed_at
                FROM sales.sales_notifications_mv
                WHERE user_id = :uid OR user_id = :lid
                ORDER BY created_at DESC;
            """),
            {"uid": employee_id, "lid": leader_id}
        )
        rows = [dict(r) for r in res.mappings().all()]
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
            if r.get("last_refreshed_at"):
                r["last_refreshed_at"] = r["last_refreshed_at"].isoformat()

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "success", "count": len(rows), "data": rows}
        )


@notification_router.get("/api/v1/sales/notifications/unread", summary="Fetch All Unread Sales Notifications", dependencies=[Depends(verify_access_token_dep)])
async def get_unread_sales_notifications(request: Request):
    """Fetch all unread (is_viewed=false) sales notifications for the logged-in user."""
    employee_id: str = request.state.employee_id
    leader_obj = getattr(request.state, "user", None)
    leader_id = getattr(leader_obj, "leader_id", employee_id) or employee_id

    async_get_db = asynccontextmanager(get_db)
    async with async_get_db() as db:
        from sqlalchemy import text
        try:
            clean_res = await db.execute(
                text("""
                    UPDATE sales.sales_notifications
                    SET is_viewed = TRUE
                    WHERE is_viewed = FALSE
                      AND (
                          (
                              notification_type IN ('LEAD_CREATED', 'STAGE_UPDATE', 'LEAD_DELETED')
                              AND id NOT IN (SELECT lead_id FROM sales.lead_register WHERE is_active = TRUE)
                          )
                          OR (
                              notification_type IN ('LEAD_REMINDER', 'ACTIVITY_OVERDUE', 'ACTIVITY_OVERDUE_LOCKED')
                              AND id NOT IN (SELECT activity_id FROM sales.lead_activity_register WHERE is_active = TRUE)
                          )
                          OR (
                              id NOT IN (SELECT lead_id FROM sales.lead_register WHERE is_active = TRUE)
                              AND id NOT IN (SELECT activity_id FROM sales.lead_activity_register WHERE is_active = TRUE)
                          )
                      );
                """)
            )
            if clean_res.rowcount > 0:
                await db.commit()
                try:
                    await db.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_notifications_mv;"))
                    await db.commit()
                except Exception:
                    await db.execute(text("REFRESH MATERIALIZED VIEW sales.sales_notifications_mv;"))
                    await db.commit()
        except Exception as clean_err:
            print(f"[get_unread_sales_notifications Cleanup Warning] {clean_err}", flush=True)

        res = await db.execute(
            text("""
                SELECT notification_id, user_id, first_name, last_name, email, designation,
                       target_id, notification_type, message, is_viewed, created_at, last_refreshed_at
                FROM sales.sales_notifications_mv
                WHERE (user_id = :uid OR user_id = :lid) AND is_viewed = FALSE
                ORDER BY created_at DESC;
            """),
            {"uid": employee_id, "lid": leader_id}
        )
        rows = [dict(r) for r in res.mappings().all()]
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
            if r.get("last_refreshed_at"):
                r["last_refreshed_at"] = r["last_refreshed_at"].isoformat()

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "success", "count": len(rows), "data": rows}
        )


@notification_router.put("/api/v1/sales/notifications/view", summary="Update Sales Notification is_viewed Status", dependencies=[Depends(verify_access_token_dep)])
async def update_sales_notification_view(
    request: Request,
    notification_id: str = Query(..., description="Notification ID (e.g. NTF-0001)"),
    status_flag: bool = Query(True, description="is_viewed status flag")
):
    """Update is_viewed status for a sales notification in sales.sales_notifications table."""
    employee_id: str = request.state.employee_id
    async_get_db = asynccontextmanager(get_db)
    async with async_get_db() as db:
        from sqlalchemy import update
        from app.models.sales.sales_notification import SalesNotification
        stmt = (
            update(SalesNotification)
            .where(SalesNotification.notification_id == notification_id)
            .where(SalesNotification.user_id == employee_id)
            .values(is_viewed=status_flag)
        )
        res = await db.execute(stmt)
        await db.commit()

        if res.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sales notification '{notification_id}' not found for user '{employee_id}'."
            )

        # Refresh MV
        from app.repositories.sales.sales_dashboard_repository import SalesDashboardRepository
        repo = SalesDashboardRepository(db)
        await repo.refresh_notifications_materialized_view()

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "success",
                "message": f"Sales notification '{notification_id}' view status updated to {status_flag}.",
                "notification_id": notification_id,
                "is_viewed": status_flag
            }
        )


@notification_router.put("/api/v1/sales/notifications/mark-all-read", summary="Mark All Sales Notifications as Read", dependencies=[Depends(verify_access_token_dep)])
async def mark_all_sales_notifications_as_read(request: Request):
    """Mark all sales notifications as read (is_viewed=true) for the logged-in user."""
    employee_id: str = request.state.employee_id
    async_get_db = asynccontextmanager(get_db)
    async with async_get_db() as db:
        from sqlalchemy import update
        from app.models.sales.sales_notification import SalesNotification
        stmt = (
            update(SalesNotification)
            .where(SalesNotification.user_id == employee_id)
            .where(SalesNotification.is_viewed == False)
            .values(is_viewed=True)
        )
        res = await db.execute(stmt)
        await db.commit()

        # Refresh Materialized View
        from app.repositories.sales.sales_dashboard_repository import SalesDashboardRepository
        repo = SalesDashboardRepository(db)
        await repo.refresh_notifications_materialized_view()

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "success",
                "message": f"All sales notifications marked as read for user '{employee_id}'.",
                "updated_count": res.rowcount
            }
        )


@notification_router.post("/api/v1/notifications/logout", summary="Terminate SSE Stream for Logged-Out User", status_code=status.HTTP_200_OK)
@notification_router.post("/api/v1/sales/notifications/logout", summary="Terminate SSE Stream for Logged-Out User", status_code=status.HTTP_200_OK)
async def logout_sse_stream(
    request: Request,
    current_user: Leader = Depends(verify_access_token_dep)
):
    """
    Disconnects and closes active SSE notification streams for the logged-in user.
    Call this when the user clicks 'Logout' on the UI to prevent cross-account socket leaks.
    """
    employee_id = current_user.emp_id
    await sse_manager.logout_user(employee_id)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "success",
            "message": f"SSE connection stream closed successfully for user '{employee_id}'."
        }
    )


######################################## SSE Listern INFO ################################################

@notification_router.get("/api/v1/notifications/stream",
    dependencies=[Depends(verify_access_token_dep_sse)])
async def notifications_stream(
    request: Request
):
    employee_id: str = request.state.employee_id  # employee_id (str) from token
    queue,connections = sse_manager.connect(employee_id)
    print(connections,"connections")

    async def event_generator():
        # ── 1. Initial snapshot on connect ───────────────────────────────────
        try:
            async_get_db = asynccontextmanager(get_db)
            async with async_get_db() as db:
                from app.repositories.sales.sales_dashboard_repository import SalesDashboardRepository
                from app.services.sales.sales_dashboard_service import SalesDashboardService, json_serializer

                sales_repo = SalesDashboardRepository(db)
                sales_service = SalesDashboardService(sales_repo)

                summary_kpis = await sales_service.get_kpis()
                status_breakdown = await sales_service.get_kpis_by_status()
                stage_breakdown = await sales_service.get_kpis_by_stage()
                leader_breakdown = await sales_service.get_kpis_by_leader()
                product_info = await sales_service.get_kpis_by_product()
                stage_pipeline_dist = await sales_service.get_stage_distribution_by_pipeline()
                stage_by_product = await sales_service.get_kpis_by_stage_by_product()
                status_by_product = await sales_service.get_kpis_by_status_by_product()

                initial_data = {
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

                initial_payload = json.dumps(initial_data, default=json_serializer)
                yield f"event: sales_dashboard_kpis\ndata: {initial_payload}\n\n"

                # Terminal log on connection
                print(f"\n[SalesNotifications SSE] 🔌 Client '{employee_id}' connected to live stream.", flush=True)

        except Exception as err:
            print(f"[SSE Stream] Initial snapshot error for user {employee_id}: {err}", flush=True)
            yield ":\n\n"



        # ── 2. Main event loop ────────────────────────────────────────────────
        try:
            while True:

                #  detect browser tab close / network drop
                if await request.is_disconnected():
                    print(f"[SSE] User {employee_id} browser disconnected")
                    break

                try:
                    data: dict = await asyncio.wait_for(
                        queue.get(), timeout=15.0
                    )
                    event_type = data.get("event_type", "notification")
                    if event_type == "logout":
                        print(f"[SSE] Logout sentinel received for user {employee_id}. Closing stream.")
                        yield f"event: logout\ndata: {json.dumps({'status': 'logout', 'message': 'SSE stream closed on user logout'})}\n\n"
                        break
                    if event_type == "dashboard_bom_availability":
                        payload = data.get("data")
                        if isinstance(payload, dict):
                            bom_rows = payload.get("bom_rows", [])
                            product_summary = payload.get("product_shortage_summary", [])
                            print(f"[SSE] Dashboard BOM update for user {employee_id}: {len(bom_rows)} rows and {len(product_summary)} products")
                            for row in bom_rows:
                                print(
                                    f"[SSE] BOM update row: product_id={row.get('product_id')} "
                                    f"product_name={row.get('product_name')} "
                                    f"part_id={row.get('part_id')} "
                                    f"part_name={row.get('part_name')} "
                                    f"required_qty={row.get('required_qty')} "
                                    f"available_qty={row.get('available_qty')} "
                                    f"shortage_qty={row.get('shortage_qty')}"
                                )
                            for product in product_summary:
                                print(
                                    f"[SSE] Product shortage summary: product_id={product.get('product_id')} "
                                    f"product_name={product.get('product_name')} "
                                    f"total_shortage_qty={product.get('total_shortage_qty')}"
                                )
                        elif isinstance(payload, list):
                            print(f"[SSE] Dashboard BOM update for user {employee_id}: {len(payload)} rows")
                            for row in payload:
                                print(
                                    f"[SSE] BOM update row: product_id={row.get('product_id')} "
                                    f"product_name={row.get('product_name')} "
                                    f"part_id={row.get('part_id')} "
                                    f"part_name={row.get('part_name')} "
                                    f"required_qty={row.get('required_qty')} "
                                    f"available_qty={row.get('available_qty')} "
                                    f"shortage_qty={row.get('shortage_qty')}"
                                )
                        else:
                            print(f"[SSE] Dashboard BOM update payload: {payload}")
                    print(f"[SSE] Sending {event_type} to user {employee_id}")
                    yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

                except asyncio.TimeoutError:
                    #  heartbeat — keeps connection alive through proxies/load balancers
                    print(f"[SSE] Heartbeat for user {employee_id}")
                    print(f"SSE {queue} and {request.state.employee_id} and connections {connections}")
                    yield ":\n\n"

                except asyncio.CancelledError:
                    #  worker shutting down or request cancelled
                    print(f"[SSE] Stream cancelled for user {employee_id}")
                    break

                except Exception as e:
                    #  don't crash the worker — log and exit cleanly
                    print(f"[SSE] Stream error for user {employee_id}: {e}")
                    break

        finally:
            #  always clean up — runs even if exception occurs
            sse_manager.disconnect(employee_id, queue)
            print(f"[SSE] Stream closed for user {employee_id}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Encoding": "none",
            "X-Accel-Buffering": "no",
        },
    )
