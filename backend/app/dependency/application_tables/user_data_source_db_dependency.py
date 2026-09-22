from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.application_tables.user_db_source_repository import UserDbSourceRepository
# from app.services.application_tables.user_db_source_service import UserDBSourceService  # application_tables ignored
from app.db.base import get_db
from fastapi import Depends


async def get_user_db_source_repository(session:AsyncSession = Depends(get_db)):
    return UserDbSourceRepository(session=session)

async def get_user_db_source_service(repo:UserDbSourceRepository = Depends(get_user_db_source_repository)):
    # application_tables ignored — returning None stub
    # return UserDBSourceService(repo=repo)
    return None


