from app.db.base import get_db
from app.repositories.dashboard_repository import DashboardRepository
from app.repositories.tracking.notification_repository import NotificationRepository
from app.services.dashboard_service import DashboardService
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

# async def get_dashboard_repo(db: Session = Depends(get_db)):
#     return DashboardRepository(db)


async def get_dashboard_repo(db: AsyncSession = Depends(get_db)):
    return DashboardRepository(db)

async def get_notification_repo_for_dashboard(db: AsyncSession = Depends(get_db)):
    return NotificationRepository(db)

async def get_dashboard_service(
    repo: DashboardRepository = Depends(get_dashboard_repo),
    notif_repo: NotificationRepository = Depends(get_notification_repo_for_dashboard)
):
    return DashboardService(
        dashboard_repository=repo,
        notification_repository=notif_repo
    )




    

