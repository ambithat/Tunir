from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.repositories.sales.lead_register_repository import LeadRegisterRepository
from app.services.sales.lead_register_service import LeadRegisterService


def get_lead_register_repository(db: AsyncSession = Depends(get_db)) -> LeadRegisterRepository:
    return LeadRegisterRepository(db)


def get_lead_register_service(
    repo: LeadRegisterRepository = Depends(get_lead_register_repository),
) -> LeadRegisterService:
    return LeadRegisterService(repo)
