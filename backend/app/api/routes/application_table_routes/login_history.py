


from fastapi import (Depends, FastAPI, HTTPException, WebSocketDisconnect, status, APIRouter, Query,
                     Body, Form, File, UploadFile, Request, WebSocket)
# from app.config  import settings as global_settings



from datetime import datetime
from typing import Optional
from app.schemas.login_history_schema import HeartbeatRequest, ScreenTimeSummaryResponse

from app.dependency.auth_dependency import verify_access_token_dep
from app.dependency.login_history_dependency import get_login_history_service
from app.services.login_history_service import LoginHistoryService

login_history_router = APIRouter()


################################ LOGIN HISTORY API ###########################################

@login_history_router.get("/api/v1/login/history/all")
async def get_all_login_history(
    login_history_service: LoginHistoryService = Depends(get_login_history_service),
):
    try:
        return await login_history_service.get_all_login_history()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@login_history_router.delete("/api/v1/login/history/delete/{id}")
async def delete_login_history(
    id:int,
    login_history_service: LoginHistoryService = Depends(get_login_history_service)
):
    try:
        print(id,"login id here")
        return await login_history_service.delete_login_history(id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@login_history_router.delete("/api/v1/login/history/delete/all")
async def delete_all_login_history(
    login_history_service: LoginHistoryService = Depends(get_login_history_service)
):
    try:
        print("delete all login history")
        return await login_history_service.delete_all_login_history()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from app.db.base import get_db
from sqlalchemy.ext.asyncio import AsyncSession


async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)):
    """Optional user dependency for heartbeat & sendBeacon calls."""
    try:
        return await verify_access_token_dep(request, None, db)
    except Exception:
        return None


def get_client_ip(request: Request) -> str:
    """Extract real client IP address behind proxy (Nginx/Vite/Node UI)."""
    forwarded = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"


@login_history_router.post("/api/v1/auth/heartbeat", status_code=status.HTTP_200_OK)
async def record_heartbeat(
    request: Request,
    payload: Optional[HeartbeatRequest] = None,
    active_seconds: int = Query(30, description="Active screen seconds since last ping"),
    login_history_service: LoginHistoryService = Depends(get_login_history_service),
    current_user = Depends(get_optional_user)
):
    """Heartbeat ping called every 30-60s by frontend tabs to track active screen time."""
    target_user_id = current_user.emp_id if current_user else (
        payload.user_id if payload and payload.user_id else (
            request.query_params.get("user_id") or request.headers.get("user_id") or request.headers.get("x-user-id")
        )
    )

    client_host = get_client_ip(request)

    if not target_user_id:
        target_user_id = await login_history_service.get_active_user_by_ip(client_host)

    if not target_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token or user_id for heartbeat ping"
        )

    seconds_to_add = payload.active_seconds if payload and payload.active_seconds > 0 else active_seconds
    session_id = payload.session_id if payload else None
    client_host = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "unknown")
    action = payload.action if payload else None

    return await login_history_service.record_heartbeat(
        user_id=target_user_id,
        session_id=session_id,
        active_seconds=seconds_to_add,
        device_info=user_agent,
        ip_address=client_host,
        action=action
    )

@login_history_router.get("/api/v1/login/history/screen-time", status_code=status.HTTP_200_OK, response_model=ScreenTimeSummaryResponse)
async def get_screen_time_summary(
    date_str: Optional[str] = Query(None, alias="date", description="Target date (YYYY-MM-DD). Defaults to today."),
    user_id: Optional[str] = Query(None, description="Target user emp_id (Super Admin only). Defaults to current user."),
    login_history_service: LoginHistoryService = Depends(get_login_history_service),
    current_user = Depends(verify_access_token_dep)
):
    """Fetch daily active screen time summary and per-device breakdown for a user."""
    target_user_id = current_user.emp_id
    role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    if user_id and role == "super admin":
        target_user_id = user_id

    target_date = None
    if date_str:
        try:
            target_date = datetime.strptime(date_str.strip(), "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    return await login_history_service.get_user_screen_time(user_id=target_user_id, target_date=target_date)



