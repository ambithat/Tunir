
import os
from pydantic import BaseModel
from fastapi import (Depends, FastAPI, HTTPException, WebSocketDisconnect, status, APIRouter, Query,
                     Body, Form, File, UploadFile, Request, WebSocket)
from fastapi.responses import JSONResponse
from app.core.rate_limiter_config import limiter

class LoginSchema(BaseModel):
    email: str
    password: str

from app.dependency.auth_dependency import verify_access_token_dep, get_user_auth
from app.dependency.login_history_dependency import get_login_history_service
from app.services.auth_service import AuthService
from app.services.login_history_service import LoginHistoryService
from app.utils.sse_manager import sse_manager

auth_router = APIRouter()


@auth_router.get("/api/v1/health")
async def health_check():
    return JSONResponse({"status": "ok"})


from app.dependency.sales.leader_dependency import get_leader_service
from app.services.sales.leader_service import LeaderService


def get_client_ip(request: Request) -> str:
    """Extract real client IP address behind proxy (Nginx/Vite/Node UI)."""
    forwarded = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"


@auth_router.post("/api/v1/leader/login")
@limiter.limit("10/minute")
async def login_leader_by_email(
    logindata: LoginSchema,
    request: Request,
    leader_service: LeaderService = Depends(get_leader_service),
    auth_service: AuthService = Depends(get_user_auth),
):
    print("=== LEADER LOGIN ATTEMPT ===")
    print(f"Email: {logindata.email}")
    try:
        client_host = get_client_ip(request)
        user_agent = request.headers.get("user-agent", "unknown")

        print("Authenticating leader via LeaderService...")
        leader_data = await leader_service.login_leader_by_email(
            email=logindata.email,
            password=logindata.password,
            client_host=client_host,
            device_info=user_agent,
        )
        emp_id, refresh_token, refresh_token_hash, refresh_token_expiry, device_info, client_host, user_result = leader_data
        print(f"Leader authenticated successfully! emp_id: {emp_id}")

        print("Creating auth token record in sales.auth_leader...")
        await auth_service.create_token(
            emp_id=emp_id,
            refresh_token=refresh_token,
            refresh_token_expiry=refresh_token_expiry,
            refresh_token_hash=refresh_token_hash,
            device_info=device_info,
            ip_address=client_host,
        )
        print("Auth token created successfully!")

        # Record SUCCESS in login_history table
        try:
            from app.repositories.login_history_repository import LoginHistoryRepository
            lh_repo = LoginHistoryRepository(auth_service.auth_repo.session)
            await lh_repo.record_login(
                user_id=emp_id,
                status="SUCCESS",
                email_attempted=logindata.email,
                ip_address=client_host,
                device_info=user_agent
            )
        except Exception as lh_err:
            print(f"[Auth Login] Failed to record login_history: {lh_err}")

        # Trigger today's lead action reminders check once on user login
        try:
            import asyncio
            from app.services.sales.lead_reminder_service import fetch_and_push_today_lead_action_reminders
            asyncio.create_task(fetch_and_push_today_lead_action_reminders(emp_id))
        except Exception as reminder_err:
            print(f"[Auth Login] Lead action reminders trigger warning: {reminder_err}", flush=True)

        user_result["refresh_token"] = refresh_token
        response = JSONResponse(user_result)
        # For cross-origin cookies (Frontend on Domain A, Backend on Domain B), we MUST use SameSite=None and Secure=True
        is_production = os.getenv("RAILWAY_ENVIRONMENT") is not None or os.getenv("IS_PRODUCTION", "false").lower() == "true"
        response.delete_cookie(key="refresh_token")
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=True if is_production else False,
            samesite="none" if is_production else "lax",
            max_age=15 * 24 * 60 * 60,
            path="/",
            domain=None
        )

        return response
    except HTTPException as e:
        try:
            from app.repositories.login_history_repository import LoginHistoryRepository
            lh_repo = LoginHistoryRepository(auth_service.auth_repo.session)
            await lh_repo.record_login(
                user_id=None,
                status="FAILED",
                email_attempted=logindata.email,
                ip_address=request.client.host,
                device_info=request.headers.get("user-agent", "unknown"),
                failure_reason=str(e.detail)
            )
        except Exception:
            pass
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@auth_router.post("/api/v1/auth/refresh", summary="Refresh Access Token using HTTP-only Cookie")
async def refresh_access_token(
    request: Request,
    auth_service: AuthService = Depends(get_user_auth),
    leader_service: LeaderService = Depends(get_leader_service),
):
    """
    Verify the `refresh_token` HTTP-only cookie (or `X-Refresh-Token` header)
    and issue a new JWT access token.
    """
    return await auth_service.refresh_access_token(request=request, leader_service=leader_service)


class LogoutAllSchema(BaseModel):
    email: str | None = None
    password: str | None = None


@auth_router.post("/api/v1/auth/logout", summary="Logout and clear all cookies")
async def logout(
    request: Request,
    auth_service: AuthService = Depends(get_user_auth),
):
    """
    Log out the user by deleting their session/refresh token from the database
    and clearing all HTTP cookies.
    """
    return await auth_service.logout(request=request)


@auth_router.post("/api/v1/auth/logout-all-devices", summary="Logout from all active sessions/devices")
async def logout_all_devices(
    request: Request,
    payload: LogoutAllSchema | None = None,
    auth_service: AuthService = Depends(get_user_auth),
    leader_service: LeaderService = Depends(get_leader_service),
):
    """
    Terminates all active sessions for the user across all devices.
    Can be called by providing email & password in payload, or via active refresh token.
    """
    emp_id = None
    if payload and payload.email and payload.password:
        leader_data = await leader_service.login_leader_by_email(
            email=payload.email,
            password=payload.password,
            client_host=request.client.host,
            device_info=request.headers.get("user-agent", "unknown")
        )
        emp_id = leader_data[0]

    return await auth_service.logout_all_devices(request=request, emp_id=emp_id)




from app.schemas.auth_schema import ForgotPasswordRequest, ResetPasswordRequest

@auth_router.post("/api/v1/auth/forgot-password", summary="Request a password reset OTP")
async def forgot_password(
    payload: ForgotPasswordRequest,
    auth_service: AuthService = Depends(get_user_auth),
    leader_service: LeaderService = Depends(get_leader_service),
):
    """
    Generate an OTP and send it to the user's email if the account exists.
    """
    return await auth_service.request_password_reset(email=payload.email, leader_service=leader_service)

@auth_router.post("/api/v1/auth/reset-password", summary="Reset password using OTP")
async def reset_password(
    payload: ResetPasswordRequest,
    auth_service: AuthService = Depends(get_user_auth),
    leader_service: LeaderService = Depends(get_leader_service),
):
    """
    Verify the OTP and update the user's password.
    """
    return await auth_service.reset_password(
        email=payload.email,
        otp=payload.otp,
        new_password=payload.new_password,
        leader_service=leader_service
    )
