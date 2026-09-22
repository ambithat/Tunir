



from app.services.admin_setting_service import AdminSettingsService
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends


async def get_admin_settings_service():

    return AdminSettingsService()





    



