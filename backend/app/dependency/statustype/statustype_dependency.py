from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.repositories.statustype.statustype_repository import StatusTypeRepository
from app.services.statustype.statustype_service import StatusTypeService

async def get_statustype_repo(db: AsyncSession = Depends(get_db)):
    return StatusTypeRepository(db)

async def get_statustype_service(repo: StatusTypeRepository = Depends(get_statustype_repo)):
    return StatusTypeService(repo)
