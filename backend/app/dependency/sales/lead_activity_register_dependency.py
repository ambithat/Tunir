from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.repositories.sales.lead_activity_register_repository import LeadActivityRegisterRepository
from app.services.sales.lead_activity_register_service import LeadActivityRegisterService

async def get_lead_activity_register_service(db: AsyncSession = Depends(get_db)) -> LeadActivityRegisterService:
    repo = LeadActivityRegisterRepository(db)
    return LeadActivityRegisterService(repo)
