from datetime import datetime
import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from fastapi import HTTPException, status
from app.models.login_history import LoginHistory
from app.repositories.base_repository import AbstractRepository
from sqlalchemy.sql import func




class LoginHistoryRepository(AbstractRepository[LoginHistory]):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, obj_in: LoginHistory) -> int:
        try:
            self.session.add(obj_in)
            await self.session.flush()
            await self.session.refresh(obj_in)
            await self.session.commit()
            return obj_in.id
        except IntegrityError as e:
            await self.session.rollback()
            raise RuntimeError(f"Integrity error while creating LoginHistory: {repr(e)}")
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error: {repr(e)}")

    async def get_by_id(self, id: int) -> Optional[List[LoginHistory]]:
        try:
            login_history = await self.session.get(LoginHistory, id)
            return [login_history] if login_history else None
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching LoginHistory by id: {repr(e)}")

    async def get_all(self) -> List[LoginHistory]:
        try:
            stmt = select(LoginHistory)
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching all LoginHistory: {repr(e)}")

    async def get_user_by_timestamp(self, start_date: datetime, end_date: datetime) -> List[LoginHistory]:
        try:
            stmt = select(LoginHistory).where(LoginHistory.timestamp.between(start_date, end_date))
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching LoginHistory by timestamp: {repr(e)}")

    async def get_active_user_by_ip(self, ip_address: str) -> Optional[str]:
        """Find active logged-in user_id by IP address fallback."""
        try:
            stmt = (
                select(LoginHistory.user_id)
                .where(
                    LoginHistory.logout_timestamp.is_(None),
                    LoginHistory.user_id.isnot(None)
                )
            )
            if ip_address and ip_address not in ("127.0.0.1", "localhost"):
                stmt = stmt.where(LoginHistory.ip_address == ip_address)
            stmt = stmt.order_by(LoginHistory.id.desc()).limit(1)
            res = await self.session.execute(stmt)
            return res.scalar_one_or_none()
        except Exception:
            return None

    async def get_all_login_history_count(self):
        try:
            stmt = select(func.count(LoginHistory.id))
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching all login history count: {repr(e)}")

    async def delete_by_id(self, obj_id: int) -> int:
        try:
            stmt = delete(LoginHistory).where(LoginHistory.id == obj_id)
            await self.session.execute(stmt)
            await self.session.flush()
            await self.session.commit()
            return obj_id
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while deleting LoginHistory by id: {repr(e)}")

    async def delete_bulk(self, obj_ids: List[int]) -> List[int]:
        """Bulk delete login history records by a list of IDs."""
        try:
            stmt = delete(LoginHistory).where(LoginHistory.id.in_(obj_ids))
            await self.session.execute(stmt)
            await self.session.flush()
            await self.session.commit()
            return obj_ids
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while bulk deleting LoginHistory: {repr(e)}")

    async def delete_all(self) -> bool:
        try:
            delete_stmt = delete(LoginHistory)
            await self.session.execute(delete_stmt)
            await self.session.flush()
            await self.session.commit()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while deleting all LoginHistory: {repr(e)}")

    @staticmethod
    def parse_user_agent(user_agent: Optional[str]) -> tuple[str, str]:
        """Extract clean Browser name and OS name from User-Agent string."""
        if not user_agent:
            return "Unknown Browser", "Unknown OS"

        ua = user_agent.lower()

        # Parse OS
        if "windows" in ua:
            os_name = "Windows"
        elif "macintosh" in ua or "mac os" in ua or "macintel" in ua:
            os_name = "macOS"
        elif "android" in ua:
            os_name = "Android"
        elif "iphone" in ua or "ipad" in ua or "ipod" in ua:
            os_name = "iOS"
        elif "linux" in ua or "x11" in ua:
            os_name = "Linux"
        else:
            os_name = "Unknown OS"

        # Parse Browser
        if "edg/" in ua or "edge" in ua:
            browser_name = "Edge"
        elif "chrome/" in ua and "chromium" not in ua and "edg" not in ua:
            browser_name = "Chrome"
        elif "firefox/" in ua:
            browser_name = "Firefox"
        elif "safari/" in ua and "chrome" not in ua:
            browser_name = "Safari"
        elif "opera" in ua or "opr/" in ua:
            browser_name = "Opera"
        else:
            browser_name = "Chrome" if "applewebkit" in ua else "Unknown Browser"

        return browser_name, os_name

    async def record_login(
        self,
        user_id: Optional[str],
        status: str = "SUCCESS",
        email_attempted: Optional[str] = None,
        ip_address: Optional[str] = "127.0.0.1",
        device_info: Optional[str] = None,
        browser: Optional[str] = None,
        os: Optional[str] = None,
        session_id: Optional[str] = None,
        failure_reason: Optional[str] = None,
    ) -> LoginHistory:
        try:
            from zoneinfo import ZoneInfo
            ist_tz = ZoneInfo("Asia/Kolkata")
            status_str = status.upper()
            now = datetime.now(ist_tz)

            parsed_browser, parsed_os = self.parse_user_agent(device_info)
            final_browser = browser or parsed_browser
            final_os = os or parsed_os
            
            entry = LoginHistory(
                user_id=user_id,
                email_attempted=email_attempted,
                timestamp=now,
                ip_address=ip_address or "127.0.0.1",
                device_info=device_info,
                browser=final_browser,
                os=final_os,
                status=status_str,
                failure_reason=failure_reason,
                session_id=session_id,
                active_seconds=0,
                last_active_at=now if status_str == "SUCCESS" else None
            )
            self.session.add(entry)
            await self.session.flush()
            await self.session.commit()
            return entry
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while recording login: {repr(e)}")

    async def record_logout(
        self,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        logout_reason: str = "EXPLICIT_LOGOUT"
    ) -> bool:
        try:
            from zoneinfo import ZoneInfo
            ist_tz = ZoneInfo("Asia/Kolkata")
            now = datetime.now(ist_tz)
            stmt = update(LoginHistory).where(
                LoginHistory.logout_timestamp.is_(None)
            )
            if session_id:
                stmt = stmt.where(LoginHistory.session_id == session_id)
            elif user_id:
                stmt = stmt.where(LoginHistory.user_id == user_id)
            else:
                return False

            status_val = "LOGOUT" if logout_reason in ["EXPLICIT_LOGOUT", "TAB_CLOSED"] else "REVOKED"

            stmt = stmt.values(
                logout_timestamp=now,
                logout_reason=logout_reason,
                status=status_val
            )
            await self.session.execute(stmt)
            await self.session.commit()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while recording logout: {repr(e)}")

    async def record_heartbeat(
        self,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        seconds: int = 30,
        device_info: Optional[str] = None,
        ip_address: Optional[str] = "127.0.0.1",
        action: Optional[str] = None
    ) -> bool:
        try:
            from zoneinfo import ZoneInfo
            from datetime import timedelta
            ist_tz = ZoneInfo("Asia/Kolkata")
            now = datetime.now(ist_tz)

            # Auto-close stale open sessions older than 2 minutes of inactivity
            stale_cutoff = now - timedelta(minutes=2)
            stale_stmt = update(LoginHistory).where(
                LoginHistory.logout_timestamp.is_(None),
                LoginHistory.last_active_at < stale_cutoff
            ).values(
                logout_timestamp=LoginHistory.last_active_at,
                logout_reason="TAB_CLOSED",
                status="LOGOUT"
            )
            await self.session.execute(stale_stmt)

            if action == "tab_closed":
                close_stmt = update(LoginHistory).where(
                    LoginHistory.logout_timestamp.is_(None),
                    LoginHistory.user_id == user_id
                ).values(
                    logout_timestamp=now,
                    logout_reason="TAB_CLOSED",
                    status="LOGOUT"
                )
                await self.session.execute(close_stmt)
                await self.session.commit()
                return True

            stmt = select(LoginHistory).where(
                LoginHistory.logout_timestamp.is_(None)
            )
            parsed_browser, parsed_os = self.parse_user_agent(device_info)
            if session_id:
                stmt = stmt.where(LoginHistory.session_id == session_id)
            elif user_id:
                stmt = stmt.where(LoginHistory.user_id == user_id)
                if parsed_browser:
                    stmt = stmt.where(LoginHistory.browser == parsed_browser)
            else:
                return False

            res = await self.session.execute(stmt)
            active_record = res.scalars().first()

            if active_record:
                # Check time gap since last heartbeat
                last_seen = active_record.last_active_at or active_record.timestamp
                if last_seen and (now - last_seen).total_seconds() > 45:
                    # Tab was closed/sleeping for > 45s, finalize previous session!
                    active_record.logout_timestamp = last_seen
                    active_record.logout_reason = "TAB_CLOSED"
                    active_record.status = "LOGOUT"
                    active_record = None  # Force creation of a new session below

            if not active_record:
                # User returned (e.g., Ctrl+Shift+T or restored tab with active cookies)
                parsed_browser, parsed_os = self.parse_user_agent(device_info)
                new_session = LoginHistory(
                    user_id=user_id,
                    timestamp=now,
                    ip_address=ip_address or "127.0.0.1",
                    device_info=device_info or "Restored Session",
                    browser=parsed_browser,
                    os=parsed_os,
                    status="SUCCESS",
                    active_seconds=seconds,
                    last_active_at=now,
                    session_id=session_id
                )
                self.session.add(new_session)
                await self.session.commit()
                return True

            active_record.active_seconds += seconds
            active_record.last_active_at = now
            await self.session.commit()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while recording heartbeat: {repr(e)}")

    async def get_user_screen_time_summary(
        self,
        user_id: str,
        target_date: Optional[datetime] = None
    ) -> dict:
        try:
            from datetime import time
            from zoneinfo import ZoneInfo
            from app.models.sales.leader import Leader
            
            ist_tz = ZoneInfo("Asia/Kolkata")
            ref_date = target_date or datetime.now(ist_tz)
            start_dt = datetime.combine(ref_date.date(), time.min).replace(tzinfo=ist_tz)
            end_dt = datetime.combine(ref_date.date(), time.max).replace(tzinfo=ist_tz)

            stmt = select(LoginHistory).where(
                LoginHistory.user_id == user_id,
                LoginHistory.timestamp >= start_dt,
                LoginHistory.timestamp <= end_dt
            )
            res = await self.session.execute(stmt)
            records = res.scalars().all()

            # Leader info
            leader_res = await self.session.execute(select(Leader).where(Leader.emp_id == user_id))
            leader = leader_res.scalar_one_or_none()

            total_seconds = sum(r.active_seconds for r in records)
            first_login = min((r.timestamp for r in records), default=None)
            last_seen = max((r.last_active_at or r.timestamp for r in records), default=None)

            hours = total_seconds // 3600
            mins = (total_seconds % 3600) // 60
            human_dur = f"{hours}h {mins}m" if hours > 0 else f"{mins} mins"

            device_map = {}
            for r in records:
                d_key = f"{r.device_info or 'Unknown'}-{r.browser or 'Unknown'}-{r.os or 'Unknown'}"
                if d_key not in device_map:
                    device_map[d_key] = {
                        "device_info": r.device_info,
                        "browser": r.browser,
                        "os": r.os,
                        "total_active_seconds": 0
                    }
                device_map[d_key]["total_active_seconds"] += r.active_seconds

            device_breakdown = []
            for d in device_map.values():
                dh = d["total_active_seconds"] // 3600
                dm = (d["total_active_seconds"] % 3600) // 60
                d["human_readable_duration"] = f"{dh}h {dm}m" if dh > 0 else f"{dm} mins"
                device_breakdown.append(d)

            return {
                "user_id": user_id,
                "full_name": leader.full_name if leader else "Unknown",
                "email": leader.email if leader else "",
                "date": ref_date.strftime("%Y-%m-%d"),
                "total_active_seconds": total_seconds,
                "human_readable_duration": human_dur,
                "first_login_at": first_login,
                "last_seen_at": last_seen,
                "session_count": len(records),
                "device_breakdown": device_breakdown
            }
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching screen time summary: {repr(e)}")
