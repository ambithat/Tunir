from asyncpg import UniqueViolationError
from fastapi import HTTPException,status
from sqlalchemy.orm import DeclarativeBase,declared_attr

 
class Base(DeclarativeBase):
    pass
    
    # @declared_attr
    # def __tablename__(cls):
    #     return cls.__name__.lower()

    # async def save(self,db_session:AsyncSession)  :
    #     try:
    #         db_session.add(self)
    #         await db_session.flush()
    #         await db_session.refresh(self)
    #     except SQLAlchemyError as ex:
    #         raise HTTPException(
    #             status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=repr(ex)
    #         ) from ex
    
    # async def delete(self,db_session:AsyncSession):
    #     try:
    #         await db_session.delete(self)
    #         return True
    #     except SQLAlchemyError as ex:
    #         raise HTTPException(
    #             status_code=status.HTTP_422_UNPROCESSABLE_CONTENT ,detail=repr(ex)
    #             ) from ex
    
    # async def update(self,db_session:AsyncSession,**kwargs):
    #     try:
    #         for k,v in kwargs.items():
    #             setattr(self,k,v)
    #         db_session.add(self)
    #         await db_session.flush()
    #         await db_session.refresh(self)
    #     except HTTPException as ex:
    #         raise HTTPException(
    #             status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=repr(ex)
    #         ) from ex
    # async def save_or_update(self,db_session:AsyncSession):
    #     try:
    #         db_session.add(self)
    #         await db_session.flush()
    #         return True
    #     except IntegrityError as ex:
    #         if isinstance(ex.orig,UniqueViolationError):
    #             return await db_session.merge(self)
    #         else:
    #             raise HTTPException(
    #                     status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
    #                     detail=repr(ex)
    #                 ) from ex
        