import uuid
from datetime import datetime
from typing import Optional,List
from app.models.auth import Auth
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select,delete, func
from sqlalchemy.exc import IntegrityError,SQLAlchemyError
from fastapi import status,HTTPException


class AuthRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, obj_in: Auth) -> bool:
        try:
            self.session.add(obj_in)
            await self.session.flush()
            await self.session.refresh(obj_in)
            return True

        except IntegrityError as e:
            await self.session.rollback()
            raise RuntimeError(f"Error occurred while creating the token: {repr(e)}")

        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error: {repr(e)}")

    async def get_by_refresh_token(self, refresh_token: str) -> Optional[Auth]:
        try:
            stmt = select(Auth).where(Auth.refresh_token == refresh_token)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Error while fetching the user data: {repr(e)}")

    async def delete_by_refresh_token(self, refresh_token: str) -> bool:
        try:
            stmt = delete(Auth).where(Auth.refresh_token == refresh_token)
            await self.session.execute(stmt)
            await self.session.flush()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            return False

    async def get_valid_token(self, refresh_token_hash: bytes) -> Optional[Auth]:
        try:
            stmt = select(Auth).where(Auth.refresh_token_hash == refresh_token_hash)
            result = await self.session.execute(stmt)
            token_entry = result.scalar_one_or_none()
            if token_entry and token_entry.refresh_token_expiry > datetime.utcnow():
                return token_entry
            return None
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Error occurred while fetching the user data: {repr(e)}")

    async def count_user_sessions(self, employee_id: str) -> int:  # employee_id (str)
        try:
            stmt = select(func.count()).select_from(Auth).where(Auth.emp_id == employee_id)
            result = await self.session.execute(stmt)
            return result.scalar()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Error while fetching session details: {repr(e)}")

    async def delete_oldest_session(self, employee_id: str, max_session: int) -> bool:  # employee_id (str)
        try:
            stmt = (
                select(Auth)
                .where(Auth.emp_id == employee_id)
                .order_by(Auth.issued_at.desc())
                .offset(max_session)
            )
            outdated_sessions = (await self.session.execute(stmt)).scalars().all()

            if not outdated_sessions:
                return False

            session_ids = [s.auth_id for s in outdated_sessions]

            delete_stmt = delete(Auth).where(Auth.auth_id.in_(session_ids))
            await self.session.execute(delete_stmt)
            await self.session.commit()

            return True
        except Exception as e:
            await self.session.rollback()
            raise RuntimeError(f"Error while deleting old sessions: {repr(e)}")

    async def delete_token(self, employee_id: str) -> Optional[str]:  # employee_id (str)
        try:
            stmt = delete(Auth).where(Auth.emp_id == employee_id)
            await self.session.execute(stmt)
            await self.session.flush()
            return employee_id
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Error occurred while deleting token: {repr(e)}")

    async def delete_expired_token(self) -> int:
        try:
            stmt = delete(Auth).where(Auth.refresh_token_expiry < datetime.utcnow())
            result = await self.session.execute(stmt)
            await self.session.flush()
            return result.rowcount or 0
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Error occurred while deleting tokens: {repr(e)}")






























# class AuthRepository:
#     def __init__(self,session:AsyncSession):
#         self.session = session

#     async def create(self, obj_in: Auth) -> bool:
#         try:
#             print(obj_in, "OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO")

#             self.session.add(obj_in)
#             await self.session.flush()          # Assign PK
#             await self.session.refresh(obj_in)  # Refresh the object, not the None value

#             return True

#         except IntegrityError as e:
#             print(e)
#             raise HTTPException(
#                 status_code=status.HTTP_400_BAD_REQUEST,
#                 detail=f"Error ocuured while creating the token : {repr(e)}"
#             )

#         except SQLAlchemyError as e:
#             print(e, "sqlllll")
#             raise HTTPException(
#                 status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                 detail=f"Database error : {repr(e)}"
#             )

#     async def get_by_user_id(self,refresh_token:str) -> List[Auth]:
#         try:
#             print("get by user _id here ")
#             stmt = select(Auth).where(
#                             Auth.refresh_token == refresh_token
#                         )
#             # result = await self.session.get(Auth,user_id)
#             result = await self.session.execute(stmt)
#             print(result,"RESULT HEREEEEEEEEEEEEEEEEEEEEEEE")
#             return result.scalar_one_or_none() if result else None
#         except SQLAlchemyError as e:
#             print(e)
#             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                                 detail=f"Error while fetching the user data : {repr(e)}")
  

 
    
#     async def get_valid_token(self,refersh_token_hash:bytes) -> Optional[Auth]:
#         try:
#             stmt = select(Auth).where(Auth.refresh_token_hash == refersh_token_hash)
#             result = await self.session.execute(stmt)
#             token_entry = result.scalar_one_or_none()
#             return token_entry if token_entry.refresh_token_expiry > datetime.utcnow() else None
#         except SQLAlchemyError as e:
#             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                                 detail=f"Error occured while fetching the user data : {repr(e)}") 
    
#     async def count_user_sessions(self, user_id: uuid.UUID) -> int:
#         try:
#             stmt = select(func.count()).select_from(Auth).where(
#                 Auth.user_id == user_id
#             )

#             # 2. Execute the query
#             result = await self.session.execute(stmt)

#             # 3. Extract the single scalar value (the count)
#             return result.scalar()
        
#         except SQLAlchemyError as e:
#             print(e)
#             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                                 detail=f"Error while fetching the session details and error is {e}")
        
#     async def delete_oldest_session(self, user_id: uuid.UUID, max_session: int):
#         try:
#             # Get all sessions ordered -> newest first
#             stmt = (
#                 select(Auth)
#                 .where(Auth.user_id == user_id)
#                 .order_by(Auth.issued_at.desc())
#                 .offset(max_session)
#             )

#             # Fetch sessions to delete (oldest beyond limit)
#             outdated_sessions = (await self.session.execute(stmt)).scalars().all()

#             if not outdated_sessions:
#                 return False

#             # Extract UUIDs
#             session_ids = [s.auth_id for s in outdated_sessions]
#             print(session_ids,"session id here ")

#             # Delete them
#             delete_stmt = delete(Auth).where(Auth.auth_id.in_(session_ids))
#             await self.session.execute(delete_stmt)
#             await self.session.commit()

#             return True

#         except Exception as e:
#             print("Error:", e)
#             raise HTTPException(
#                 status_code=500,
#                 detail=f"Error while deleting old sessions: {e}"
#             )

        
#     async def delete_token(self, user_id:uuid.UUID) -> Optional[uuid.UUID] :
#         try:
#             stmt = delete(Auth).where(Auth.user_id == user_id)
#             await self.session.execute(stmt)
#             await  self.session.flush()
#             return user_id
#         except SQLAlchemyError as e:
#             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                                 detail=f"Error occured while deleting token : {repr(e)}")
    
#     async def delete_expired_token(self) -> int:
#         try:
#             stmt = delete(Auth).where(Auth.refresh_token_expiry < datetime.utcnow())
#             result = await self.session.execute(stmt)
#             await self.session.flush()
#             return result.rowcount or 0
#         except SQLAlchemyError as e:
#             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                                 detail=f"Error occured while deleting the tokens : {repr(e)}")