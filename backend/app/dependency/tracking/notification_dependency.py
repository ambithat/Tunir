from app.db.base import get_db
from app.repositories.tracking.notification_repository import NotificationRepository
from app.services.tracking.notification_service import NotificationService
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

async def get_notification_repo(db:AsyncSession = Depends(get_db)):
    return NotificationRepository(db)



async def get_notification_service(repo:NotificationRepository = Depends(get_notification_repo)):
    return NotificationService(notification_repository=repo)





    

