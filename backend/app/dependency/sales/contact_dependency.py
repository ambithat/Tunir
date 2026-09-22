from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.repositories.sales.contact_repository import ContactRepository
from app.services.sales.contact_service import ContactService

def get_contact_repository(db: AsyncSession = Depends(get_db)) -> ContactRepository:
    return ContactRepository(db)

def get_contact_service(
    repository: ContactRepository = Depends(get_contact_repository),
) -> ContactService:
    return ContactService(repository)
