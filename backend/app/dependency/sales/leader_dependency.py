from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.repositories.sales.leader_repository import LeaderRepository
from app.services.sales.leader_service import LeaderService


def get_leader_repository(db: AsyncSession = Depends(get_db)) -> LeaderRepository:
    return LeaderRepository(db)


def get_leader_service(
    repository: LeaderRepository = Depends(get_leader_repository),
) -> LeaderService:
    return LeaderService(repository)
