from fastapi import Depends
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.repositories.dynamic_crud_repository import DynamicCrudRepository
from app.services.dynamic_crud_service import DynamicCrudService
from sqlalchemy.ext.asyncio import AsyncSession


# async def get_dynamic_crud_repo(db: Session = Depends(get_db)):
#     """
#     Provides an instance of DynamicCrudRepository injected with the user's active DB session.
#     Note: get_db returns a session compatible with dynamic drivers.
#     """
#     return DynamicCrudRepository(db)



async def get_dynamic_crud_repo(db: AsyncSession = Depends(get_db)):
    """
    Provides an instance of DynamicCrudRepository injected with the user's active DB session.
    Note: get_db returns an AsyncSession compatible with dynamic drivers.
    """
    return DynamicCrudRepository(db)


async def get_dynamic_crud_service(repo: DynamicCrudRepository = Depends(get_dynamic_crud_repo)):
    """
    Provides an instance of DynamicCrudService.
    """
    return DynamicCrudService(repo=repo)