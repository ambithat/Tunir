import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from fastapi import HTTPException, status
from app.models.application_tables.user_data_source_db import UserDbSource
from app.repositories.base_repository import AbstractRepository
from sqlalchemy.sql import func


class UserDbSourceRepository(AbstractRepository[UserDbSource]):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, obj_in: UserDbSource) -> UserDbSource:
        try:
            from app.config import settings as global_settings
            from sqlalchemy import insert
            secret_key = global_settings.DB_ENCRYPTION_KEY
            plain_password = obj_in.password

            # Convert the Pydantic/ORM object to a dictionary for insertion
            insert_values = {
                "display_name": obj_in.display_name,
                "user_id": obj_in.user_id,
                "database_type": obj_in.database_type,
                "driver": obj_in.driver,
                "db_scheme": obj_in.db_scheme,
                "host": obj_in.host,
                "port": obj_in.port,
                "user_name": obj_in.user_name,
                "password": obj_in.password,
                "db_name": obj_in.db_name,
                "is_active": obj_in.is_active,
                "created_at": obj_in.created_at
            }

            # Filter out None values to allow SQLAlchemy/DB defaults to trigger
            insert_values = {k: v for k, v in insert_values.items() if v is not None}

            if plain_password:
                insert_values["password"] = func.encode(func.pgp_sym_encrypt(plain_password, secret_key), 'hex')
            
            stmt = insert(UserDbSource).values(**insert_values).returning(UserDbSource)
            result = await self.session.execute(stmt)
            
            created_obj = result.scalar_one()
            # Expunge the object from the session so that when we mutate the password 
            # to plain text (for immediate in-memory use), it doesn't get UPDATED in the DB
            # on the final middleware commit.
            self.session.expunge(created_obj)
            created_obj.password = plain_password
            return created_obj
        except IntegrityError as e:
            await self.session.rollback()
            raise RuntimeError(f"Integrity error while creating data source: {repr(e)}")
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error: {repr(e)}")

    async def get_by_id(self, display_name:str,user_id:uuid.UUID) -> Optional[UserDbSource]:
        try:
            from app.config import settings as global_settings
            secret_key = global_settings.DB_ENCRYPTION_KEY
            stmt = select(
                UserDbSource,
                func.pgp_sym_decrypt(func.decode(UserDbSource.password, 'hex'), secret_key).label("decrypted_password")
            ).where(UserDbSource.display_name == display_name,
                    UserDbSource.user_id == user_id)
            user_db_repo = await self.session.execute(stmt)
            res = user_db_repo.first()
            if res:
                obj = res[0]
                obj.password = res[1]
                return obj
            return None
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching data source: {repr(e)}")

    async def get_active_user_by_id(self,
                                    user_id:uuid.UUID):
        try:
            stmt = select(UserDbSource.display_name, UserDbSource.database_type, UserDbSource.driver, UserDbSource.db_scheme).where(
                UserDbSource.user_id == user_id,
                UserDbSource.is_active == True,
            )
            user_db_obj = await self.session.execute(stmt)
            return user_db_obj.one_or_none()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching data source: {repr(e)}")

    async def get_by_display_name(self,
                                  user_id:uuid.UUID,
                                  display_name:str):
        try:
            from app.config import settings as global_settings
            secret_key = global_settings.DB_ENCRYPTION_KEY
            stmt = select(
                UserDbSource,
                func.pgp_sym_decrypt(func.decode(UserDbSource.password, 'hex'), secret_key).label("decrypted_password")
            ).where(UserDbSource.user_id == user_id,
                    UserDbSource.display_name == display_name)
            user_db_obj = await self.session.execute(stmt)
            res = user_db_obj.first()
            if res:
                obj = res[0]
                obj.password = res[1]
                return obj
            return None
        except SQLAlchemyError as se:
            print(f'SOME EXPPPPPPPPPPPPPPP {se}')
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching data source: {repr(se)}")

    async def get_all(self,user_id:uuid.UUID) -> List[UserDbSource]:
        try:
            from app.config import settings as global_settings
            secret_key = global_settings.DB_ENCRYPTION_KEY
            stmt = select(
                UserDbSource,
                func.pgp_sym_decrypt(func.decode(UserDbSource.password, 'hex'), secret_key).label("decrypted_password")
            ).where(UserDbSource.user_id == user_id)
            result = await self.session.execute(stmt)
            objs = []
            for row in result.all():
                obj = row[0]
                obj.password = row[1]
                objs.append(obj)
            return objs
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching all data source: {repr(e)}")

    async def get_all_user_db_source_data(self) -> List[UserDbSource]:
        try:
            from app.config import settings as global_settings
            secret_key = global_settings.DB_ENCRYPTION_KEY
            stmt = select(
                UserDbSource,
                func.pgp_sym_decrypt(func.decode(UserDbSource.password, 'hex'), secret_key).label("decrypted_password")
            )
            result = await self.session.execute(stmt)
            objs = []
            for row in result.all():
                obj = row[0]
                obj.password = row[1]
                objs.append(obj)
            return objs
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching all data source: {repr(e)}")



    async def get_all_user_db_sources_count(self):
        try:
            stmt = select(func.count(UserDbSource._id))
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching all user db sources count: {repr(e)}")


    async def update_by_id(self,user_id:uuid.UUID, display_name: str, param: dict) -> uuid.UUID:
        try:
            from app.config import settings as global_settings
            secret_key = global_settings.DB_ENCRYPTION_KEY
            if "password" in param and param["password"]:
                param["password"] = func.encode(func.pgp_sym_encrypt(param["password"], secret_key), 'hex')

            stmt_deactivate = (
            update(UserDbSource)
            .where(UserDbSource.user_id == user_id)
            .values(is_active=False)
            )
            await self.session.execute(stmt_deactivate)
            if display_name == "STAR_AI_SQLite":
                return True
           
            stmt = (
                update(UserDbSource)
                .where(UserDbSource.user_id == user_id)
                .where(UserDbSource.display_name == display_name)
                .values(**param)
                .returning(UserDbSource.display_name) 
                .execution_options(synchronize_session="fetch")
            )
            result = await self.session.execute(stmt)
            await self.session.flush()
            updated_item = result.scalar_one_or_none()
            if not updated_item:
                # If the user tried to switch to a DB that doesn't exist, 
                # we ROLLBACK so we don't leave them with 0 active DBs (from Step 1)
                await self.session.rollback()
                return False
            return True
        except IntegrityError as ie:
            await self.session.rollback()
            raise RuntimeError(f"Integrity error : {repr(ie)}")
        except SQLAlchemyError as e:
            print(e)
            await self.session.rollback()
            raise RuntimeError(f"Database error while updating data source: {repr(e)}")

 

    async def delete_by_display_name(self,user_id:uuid.UUID, display_name: str) -> bool :
        try:
            stmt = delete(UserDbSource).where(UserDbSource.user_id ==  user_id,
                                              UserDbSource.display_name == display_name)
            await self.session.execute(stmt)
            await self.session.flush()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while deleting data source: {repr(e)}")

    async def delete_by_id(self,id:int) -> bool :
        try:
            stmt = delete(UserDbSource).where(UserDbSource._id ==  id)
            await self.session.execute(stmt)
            await self.session.flush()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while deleting data source: {repr(e)}")




    async def delete_all(self,user_id:uuid.UUID) -> bool:
        try:
            stmt = delete(UserDbSource).where(UserDbSource.user_id == user_id)
            # delete_stmt = delete(UserDbSource)
            await self.session.execute(stmt)
            await self.session.flush()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while deleting all data source: {repr(e)}")





