import uuid
import ipaddress
from typing import Optional
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo
from app.models.auth import Auth
from app.repositories.auth_repository import AuthRepository
from app.security.token_utils import verify_refresh_token, create_access_token
from fastapi import status,HTTPException,Request
from fastapi.responses import JSONResponse
from app.config import settings as global_setting

from user_agents import parse
from app.utils.sse_manager import sse_manager

from app.core.logging_config import setup_logging, get_logger
setup_logging()
logger = get_logger("app.main")
class AuthService:
    '''
    
    class Auth(Base):
    auth_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.user_id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True
    )

    refresh_token_hash: Mapped[bytes] = mapped_column(
        LargeBinary,
        nullable=False,
        unique=True
    )

    refresh_token_expiry: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    issued_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("CURRENT_TIMESTAMP")
    )

    device_info: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True)



    '''
    def __init__(self,repo:AuthRepository):
        self.auth_repo = repo

    async def create_token(self,
                           emp_id:str,  # emp_id (str)
                           refresh_token:str,
                           refresh_token_hash:bytes,
                           refresh_token_expiry:datetime,
                           device_info:str,
                           ip_address:str
                           ):
        try:
            # Clean up expired sessions first
            await self.auth_repo.delete_expired_token()

            # Enforce max sessions limit based on active SSE stream connections
            active_sse_count = sse_manager.get_active_count(emp_id)
            if active_sse_count >= global_setting.MAX_SESSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Maximum session limit of {global_setting.MAX_SESSIONS} active device(s) reached. Please logout from existing devices or call the logout-all-devices API before logging in."
                )

            user_data = Auth(
                emp_id=emp_id,
                refresh_token=refresh_token,
                refresh_token_hash = refresh_token_hash,
                refresh_token_expiry = refresh_token_expiry,
                device_info = device_info,
                ip_address = ip_address
            )
            print(user_data,"User data here .............")
            result = await self.auth_repo.create(user_data)
            logger.debug("Auth session created for emp_id: %s", emp_id)
            if not result:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Not able to create access token try again ")

            return "User token created successfully"
        
        except RuntimeError as re:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(re))
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        
        except Exception as e:
            raise Exception(str(e))

    def is_ip_in_similar_range(self,stored_ip: str, current_ip: str) -> bool:
        """Check if IPs are in same /24 subnet (same local network)"""
        try:
            stored = ipaddress.IPv4Address(stored_ip)
            current = ipaddress.IPv4Address(current_ip)
            
            # Check if first 3 octets match (e.g., 192.168.1.x)
            stored_network = ipaddress.IPv4Network(f"{stored_ip}/24", strict=False)
            return current in stored_network
        except:
            return False
        
    
    async def refresh_access_token(self,
                                   request:Request,
                                   leader_service
                                ):
        
        
        try:
            refresh_token = request.cookies.get("refresh_token") or request.headers.get("X-Refresh-Token")
            
            if not refresh_token:
                raise HTTPException(
                    status_code=401,
                    detail="Refresh token not found in cookie or header"
                )
            client_ip = request.client.host if request.client else "unknown"
            client_agent = request.headers.get("user-agent")
            user = await self.auth_repo.get_by_refresh_token(
                refresh_token=str(refresh_token)
            )
            if user:
                if not user.refresh_token_hash:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Refresh Token not found"
                    )
                session_count = await self.auth_repo.count_user_sessions(employee_id=user.emp_id)
                if session_count > global_setting.MAX_SESSIONS:
                    result = await self.auth_repo.delete_oldest_session(employee_id=user.emp_id,
                                                                         max_session=global_setting.MAX_SESSIONS)
                    if result:
                        try:
                            ist_time = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m-%d %H:%M:%S %Z")
                            logger.info(
                                f"Old session deleted for emp_id={user.emp_id}, "
                                f"session_count={session_count}, time={ist_time}, "
                                f"ip={client_ip}, agent={client_agent}"
                            )
                        except Exception as e:
                            logger.debug("Failed to log session deletion: %s", e)

                # Device & IP validation
                stored_ua = parse(user.device_info) if user.device_info else None
                current_ua = parse(client_agent) if client_agent else None

                if stored_ua and current_ua:
                    logger.debug("UA check — stored_os=%s current_os=%s stored_browser=%s current_browser=%s",
                                 stored_ua.os.family, current_ua.os.family,
                                 stored_ua.browser.family, current_ua.browser.family)

                    if stored_ua.os.family != current_ua.os.family:
                        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Device mismatch — OS changed")

                    if stored_ua.browser.family != current_ua.browser.family:
                        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Device mismatch — Browser changed")
                
                if user.ip_address != client_ip:
                    ip_status = self.is_ip_in_similar_range(stored_ip=user.ip_address, current_ip=client_ip)
                    if not ip_status:
                        logger.warning("[Refresh Auth] IP address changed from %s to %s", user.ip_address, client_ip)

                # Verify token
                result = verify_refresh_token(str(refresh_token), user.refresh_token_hash.decode("utf-8"))
                if not result:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Refresh Token mismatch"
                    )

                # Expiry check
                now = datetime.now(timezone.utc)
                if user.refresh_token_expiry <= now:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Refresh token expired"
                    )

                # Create new access token
                employee_id = user.emp_id
                role = await leader_service.get_user_role(employee_id=employee_id)
                user_data = await leader_service.get_user_profile_by_id(employee_id=employee_id)
                first_name = user_data["user_data"]["first_name"]
                leader_id = user_data["user_data"].get("leader_id")
                role_val = getattr(role, 'value', str(role)) if role else "USER"
                new_access_token = create_access_token(
                    employee_id=str(employee_id),
                    role=role_val,
                    name=first_name,
                    leader_id=leader_id
                )

                return {
                    "access_token": new_access_token,
                    "token_type": "bearer",
                    "expires_in": getattr(global_setting, "ACCESS_TOKEN_EXPIRE_SECONDS", 60)
                }
                    
            else:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                    detail='Invalid or expired refresh token. Please log in again.')
        except HTTPException as e:
            raise
        except RuntimeError as re:
            logger.error("[refresh_access_token] RuntimeError: %s", re)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(re))
        except ValueError as e:
            logger.error("[refresh_access_token] ValueError: %s", e)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error("[refresh_access_token] Unexpected error: %s", e)
            raise Exception(e)

    async def logout(self, request: Request) -> JSONResponse:
        try:
            refresh_token = request.cookies.get("refresh_token") or request.headers.get("X-Refresh-Token")
            if refresh_token:
                user = await self.auth_repo.get_by_refresh_token(str(refresh_token))
                if user:
                    await sse_manager.logout_user(user.emp_id)
                    try:
                        from app.repositories.login_history_repository import LoginHistoryRepository
                        lh_repo = LoginHistoryRepository(self.auth_repo.session)
                        await lh_repo.record_logout(user_id=user.emp_id, logout_reason="EXPLICIT_LOGOUT")
                    except Exception as lh_err:
                        logger.warning(f"Failed to record logout in login_history: {lh_err}")
                await self.auth_repo.delete_by_refresh_token(refresh_token)

            response = JSONResponse(
                content={"message": "Logged out successfully", "status": "success"},
                status_code=status.HTTP_200_OK,
            )

            # Clear all cookies present in request
            for cookie_name in request.cookies.keys():
                response.delete_cookie(key=cookie_name, path="/")

            # Explicitly clear standard cookies
            response.delete_cookie(key="refresh_token", path="/")
            response.delete_cookie(key="access_token", path="/")
            return response
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Logout failed: {str(e)}"
            )

    async def logout_all_devices(self, request: Request, emp_id: Optional[str] = None) -> JSONResponse:
        try:
            target_emp_id = emp_id

            if not target_emp_id:
                refresh_token = request.cookies.get("refresh_token") or request.headers.get("X-Refresh-Token")
                if refresh_token:
                    user = await self.auth_repo.get_by_refresh_token(str(refresh_token))
                    if user:
                        target_emp_id = user.emp_id

            if target_emp_id:
                await sse_manager.logout_user(target_emp_id)
                try:
                    from app.repositories.login_history_repository import LoginHistoryRepository
                    lh_repo = LoginHistoryRepository(self.auth_repo.session)
                    await lh_repo.record_logout(user_id=target_emp_id, logout_reason="EXPLICIT_LOGOUT")
                except Exception as lh_err:
                    logger.warning(f"Failed to record logout_all_devices in login_history: {lh_err}")
                await self.auth_repo.delete_token(target_emp_id)

            response = JSONResponse(
                content={"message": "Logged out from all devices successfully", "status": "success"},
                status_code=status.HTTP_200_OK,
            )

            for cookie_name in request.cookies.keys():
                response.delete_cookie(key=cookie_name, path="/")

            response.delete_cookie(key="refresh_token", path="/")
            response.delete_cookie(key="access_token", path="/")
            return response
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to logout from all devices: {str(e)}"
            )
    async def request_password_reset(self, email: str, leader_service) -> dict:
        import secrets
        from datetime import timedelta
        from sqlalchemy import insert, select
        from app.models.sales.password_reset_otp import PasswordResetOTP
        from app.services.sales.email.mail_event_service import queue_mail_event
        
        # 1. Check if user exists
        leaders = await leader_service.repo.get_all_leaders(search=email)
        leader = next((l for l in leaders["data"] if l.email == email), None)
        
        if not leader:
            # Return success to prevent email enumeration
            return {"message": "If an account with that email exists, an OTP has been sent.", "status": "success"}

        # 2. Generate 6-digit OTP
        otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=3)

        # 3. Save to database
        stmt = insert(PasswordResetOTP).values(
            email=email,
            otp_code=otp_code,
            expires_at=expires_at,
            is_used=False
        )
        await self.auth_repo.session.execute(stmt)
        await self.auth_repo.session.commit()

        # 4. Queue Email
        email_html = f"""
        <html>
            <body>
                <h2>Password Reset Request</h2>
                <p>Hello {leader.first_name},</p>
                <p>Your OTP for password reset is: <strong>{otp_code}</strong></p>
                <p>This OTP will expire in 3 minutes.</p>
                <p>If you did not request this, please ignore this email.</p>
            </body>
        </html>
        """
        from app.services.o365_service import O365Service
        creds = O365Service._fetch_credentials_sync()
        otp_sender = creds.get("otp_email_from") or os.getenv("OTP_EMAIL_FROM")
        payload = {
            "to": email,
            "subject": "Your Password Reset OTP",
            "body": email_html,
            "html": True
        }
        if otp_sender:
            payload["sender"] = otp_sender
            
        from app.services.sales.email.mail_event_service import trigger_process_pending_mail_events
        await queue_mail_event(self.auth_repo.session, event_type="send_email", payload=payload)
        await self.auth_repo.session.commit()
        
        # Trigger the background worker to process it immediately
        trigger_process_pending_mail_events(delay_seconds=1.0)

        return {"message": "If an account with that email exists, an OTP has been sent.", "status": "success"}

    async def reset_password(self, email: str, otp: str, new_password: str, leader_service) -> dict:
        from sqlalchemy import select, update
        from app.models.sales.password_reset_otp import PasswordResetOTP
        
        # 1. Find OTP
        now = datetime.now(timezone.utc)
        stmt = select(PasswordResetOTP).where(
            PasswordResetOTP.email == email,
            PasswordResetOTP.is_used == False,
            PasswordResetOTP.expires_at > now
        ).order_by(PasswordResetOTP.created_at.desc())
        
        result = await self.auth_repo.session.execute(stmt)
        otp_record = result.scalars().first()

        if not otp_record or otp_record.otp_code != otp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP."
            )

        # 2. Find user
        leaders = await leader_service.repo.get_all_leaders(search=email)
        leader = next((l for l in leaders["data"] if l.email == email), None)
        
        if not leader:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not found."
            )

        # 3. Update Password
        await leader_service.repo.update_leader(leader.leader_id, {"password": new_password})
        await leader_service.repo.session.commit()

        # 4. Mark OTP as used
        otp_record.is_used = True
        await self.auth_repo.session.commit()

        return {"message": "Password has been successfully reset.", "status": "success"}

