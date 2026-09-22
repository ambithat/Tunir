from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.repositories.sales.weekly_pdf_register_repository import WeeklyPdfRegisterRepository
from app.services.sales.weekly_pdf_register_service import WeeklyPdfRegisterService


async def get_weekly_pdf_register_repository(session: AsyncSession = Depends(get_db)) -> WeeklyPdfRegisterRepository:
    return WeeklyPdfRegisterRepository(session)


async def get_weekly_pdf_register_service(
    repo: WeeklyPdfRegisterRepository = Depends(get_weekly_pdf_register_repository)
) -> WeeklyPdfRegisterService:
    return WeeklyPdfRegisterService(repo)
