from datetime import datetime
import uuid
from typing import List, Optional
from fastapi import HTTPException, status
from app.repositories.login_history_repository import LoginHistoryRepository
from app.models.login_history import LoginHistory, LoginStatus
from app.schemas.login_history_schema import LoginHistoryDataDTO, LoginHistorySchema
from app.exceptions.login_history_exception import LoginHistoryException

class LoginHistoryService:
    def __init__(self, repo: LoginHistoryRepository):
        self.login_history_repo = repo

    async def get_active_user_by_ip(self, ip_address: str) -> Optional[str]:
        return await self.login_history_repo.get_active_user_by_ip(ip_address)

    async def create_login_history(self, 
                                   user_id: uuid.UUID, 
                                   status: LoginStatus, 
                                   ip_address: str = "127.0.0.1", 
                                   device_info: str = None):
        try:
            print(user_id)
            print(status)
            print(ip_address)
            print(device_info)
            data = LoginHistory(
                user_id=user_id,
                status=status,
                ip_address=ip_address,
                device_info=device_info,
                timestamp=datetime.utcnow()
            )
            
            login_history_id = await self.login_history_repo.create(data)
            if not login_history_id:
                raise LoginHistoryException("Failed to create login history record.")
            
            return {"message": "Login history created successfully", "id": login_history_id}
        
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating login history: {str(e)}")

    async def get_login_history_by_id(self, id: int):
        try:
            history_list = await self.login_history_repo.get_by_id(id=id)
            if not history_list:
                raise HTTPException(status_code=404, detail="Login history record not found")

            history = history_list[0]
            return {
                "message": "Login history fetched successfully",
                "data": LoginHistoryDataDTO.model_validate(history)
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def get_all_login_history(self):
        try:
            # 1. Fetch all history from DB
            history_data = await self.login_history_repo.get_all() or []
            
            # 2. Get unique user IDs to fetch emails in ONE bulk call
            user_ids = list(set([h.user_id for h in history_data if h.user_id]))
            
            # 3. Create a lookup mapping {user_id: email}
            user_emails = await user_service.get_emails_bulk(user_ids)
            
            # 4. Mix email into the final data
            final_data = []
            for h in history_data:
                # Use model_validate with a dictionary to include the email
                data_dict = {
                    "id": h.id,
                    "timestamp": h.timestamp,
                    "ip_address": h.ip_address,
                    "device_info": h.device_info or "Unknown",
                    "status": str(h.status.value) if hasattr(h.status, 'value') else str(h.status),
                    "email": user_emails.get(h.user_id, "Unknown User")
                }
                final_data.append(LoginHistoryDataDTO.model_validate(data_dict))

            return {
                "message": "All login history fetched successfully",
                "data": final_data
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def get_login_history_by_date(self, start_date_str: str, end_date_str: str):
        try:
            from zoneinfo import ZoneInfo
            kolkata_tz = ZoneInfo("Asia/Kolkata")
            
            def parse_date_str(date_str: str, is_end: bool) -> datetime:
                date_str = date_str.strip()
                # Try YYYY-MM-DD format
                try:
                    dt = datetime.strptime(date_str, "%Y-%m-%d")
                    if is_end:
                        dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
                    return dt.replace(tzinfo=kolkata_tz)
                except ValueError:
                    pass
                
                # Fallback to ISO format
                try:
                    dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=kolkata_tz)
                    return dt
                except ValueError:
                    raise ValueError(f"Invalid date format: {date_str}")
            
            start_date = parse_date_str(start_date_str, is_end=False)
            end_date = parse_date_str(end_date_str, is_end=True)
            
            history_data = await self.login_history_repo.get_user_by_timestamp(start_date, end_date)
            return {
                "message": "Login history for date range fetched successfully",
                "data": [LoginHistoryDataDTO.model_validate(h) for h in history_data or []]
            }
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


    async def get_all_login_history_count(self):
        try:
            history_count = await self.login_history_repo.get_all_login_history_count()
            return history_count
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


    async def delete_login_history(self, id: int):
        try:
            deleted_id = await self.login_history_repo.delete_by_id(id)
            return {"message": f"Login history record {deleted_id} deleted successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def delete_all_login_history(self):
        try:
            await self.login_history_repo.delete_all()
            return {"message": "All login history records cleared successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def delete_bulk_history(self, ids: List[int]):
        try:
            deleted_ids = await self.login_history_repo.delete_bulk(ids)
            return {"message": f"Bulk deletion of {len(deleted_ids)} records successful"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def record_heartbeat(
        self,
        user_id: str,
        session_id: Optional[str] = None,
        active_seconds: int = 30,
        device_info: Optional[str] = None,
        ip_address: Optional[str] = None,
        action: Optional[str] = None
    ):
        try:
            success = await self.login_history_repo.record_heartbeat(
                session_id=session_id, user_id=user_id, seconds=active_seconds,
                device_info=device_info, ip_address=ip_address, action=action
            )
            return {"status": "success", "recorded_seconds": active_seconds, "updated": success}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Heartbeat recording failed: {str(e)}")

    async def get_user_screen_time(self, user_id: str, target_date: Optional[datetime] = None):
        try:
            return await self.login_history_repo.get_user_screen_time_summary(user_id=user_id, target_date=target_date)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to calculate screen time: {str(e)}")

    async def record_logout(self, user_id: Optional[str] = None, session_id: Optional[str] = None, logout_reason: str = "EXPLICIT_LOGOUT"):
        try:
            return await self.login_history_repo.record_logout(user_id=user_id, session_id=session_id, logout_reason=logout_reason)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to record logout: {str(e)}")

    