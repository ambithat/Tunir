
from fastapi import HTTPException
# from app.services.application_tables.user_db_source_service import UserDBSourceService  # application_tables ignored
from app.services.login_history_service import LoginHistoryService

class AdminSettingsService:
    def __init__(self):
        pass
    async def get_admin_settings_count_data(self,
                                            get_user_db:UserDBSourceService,
                                            login_history_service:LoginHistoryService):
        try:
            total_db_count = await get_user_db.get_all_user_db_sources_count()
            total_login_history_count = await login_history_service.get_all_login_history_count()
            return {
                "total_db_count":total_db_count,
                "total_login_history_count":total_login_history_count,
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))