


from app.db.base import get_db

from app.repositories.login_history_repository import LoginHistoryRepository
from app.services.login_history_service import LoginHistoryService
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

async def get_login_history_repo(db:AsyncSession = Depends(get_db)):
    return LoginHistoryRepository(db)



async def get_login_history_service(repo:LoginHistoryRepository = Depends(get_login_history_repo)):
    return LoginHistoryService(repo=repo)





    



 