from datetime import datetime , timezone
from app.models.application_tables.api_key import ApiKey, KeyStatus
from sqlalchemy import select,update,delete,func
from sqlalchemy.exc import SQLAlchemyError,IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


class ApiKeyRepository:
    def __init__(self,session:AsyncSession):
        self.session = session

    async def create_api_key(self,obj:ApiKey):
        try:
            print(self.session,"RRRRRRRRRRRRR6465")
            print(obj)
            self.session.add(obj)
            # print(1)
            await self.session.flush()
            print(2)
            await self.session.refresh(obj)
            print(3)
            return True
        except IntegrityError as ie:
            await self.session.rollback()
            raise RuntimeError(f"Database IntegrityError {repr(ie)}")
        except SQLAlchemyError as se:
            await self.session.rollback()
            raise RuntimeError(f"Database  error {repr(se)}")
    
    async def update_status(self,api_key:str,param:dict):
        try:
            print(param)
            stmt = update(ApiKey).where(ApiKey.api_key == api_key).values(**param).execution_options(synchronize_session="fetch")
            await self.session.execute(stmt)
            await self.session.flush()
            await self.session.commit()
            return True
        except SQLAlchemyError as se:
            print(f"DKDKK {se}")
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(se)}")
    
    async def update_status_on_unlock(self,time_stamp:datetime,param:dict):
        try:
            stmt = (
                update(ApiKey)
                .values(**param)
                .where(ApiKey.status == KeyStatus.RATE_LIMITED)
                .where(ApiKey.next_available_at <= time_stamp)

            )
            await self.session.execute(stmt)
            await self.session.flush()
            await self.session.commit()
            return True
        except SQLAlchemyError as se:
            await self.session.rollback()
            print(f"Error occured while unlocking the status {se}")
            raise RuntimeError(f"Database error {repr(se)}")

        
    async def get_active_api_key(self):
        try:
            sub_query = (
                select(func.min(ApiKey.priority))
                .where(ApiKey.status == KeyStatus.ACTIVE)
            ).scalar_subquery()
            stmt = (
                select(ApiKey)
                .where(ApiKey.status == KeyStatus.ACTIVE)
                .where(ApiKey.priority == sub_query)
                .limit(1)
            )
            api_key_res = await self.session.execute(stmt)
            api_key = api_key_res.scalars().first()
            return api_key
        
        except SQLAlchemyError as se:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(se)}")
        
    async def get_all(self):
        try:
            stmt = (select(ApiKey))
            result_obj = await self.session.execute(stmt)
            api_keys_result = result_obj.scalars().all()
            return api_keys_result
        except SQLAlchemyError as se:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(se)}")
        

    # async def get_retry_api_key(self):
    #     try:
    #         stmt = (
    #             select(ApiKey)
    #             .where(ApiKey.status == KeyStatus.ACTIVE)
    #             .order_by(ApiKey.priority.asc() ,ApiKey.last_used_at.asc().nullsfirst())
    #             .limit(1)
    #         )

    #         result_obj = await self.session.execute(stmt)
    #         result = result_obj.scalars().first()
    #         if result :
    #             return result,None
        
    #         stmt = select(ApiKey).where(ApiKey.status == KeyStatus.RATE_LIMITED)
    #         rate_res = await self.session.execute(stmt)
    #         rate_limited_keys = rate_res.scalars.all()

    #         return None,rate_limited_keys

    #     except SQLAlchemyError as se:
    #         await self.session.rollback()
    #         raise RuntimeError(f"Database error {repr(se)}")


    async def get_retry_api_key(self):
        try:
            stmt = (
                select(ApiKey)
                .where(ApiKey.status == KeyStatus.ACTIVE)
                .order_by(
                    ApiKey.priority.asc(),
                    ApiKey.last_used_at.asc().nulls_first()  #  nulls_first() on the column
                )
                .limit(1)
            )

            result_obj = await self.session.execute(stmt)
            result = result_obj.scalars().first()
            if result:
                return result, None

            stmt = select(ApiKey).where(ApiKey.status == KeyStatus.RATE_LIMITED)
            rate_res = await self.session.execute(stmt)
            rate_limited_keys = rate_res.scalars().all()  #  added ()

            return None, rate_limited_keys

        except SQLAlchemyError as se:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(se)}")   
    async def get_all_api_keys(self):
        try:
            stmt = select(ApiKey)
            api_key_res = await self.session.execute(stmt)
            api_key_result = api_key_res.scalars().all()
            return api_key_result
        except SQLAlchemyError as se:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(se)}")

    async def get_by_api_key(self, api_key: str):
        try:
            stmt = select(ApiKey).where(ApiKey.api_key == api_key)
            res = await self.session.execute(stmt)
            return res.scalars().first()
        except SQLAlchemyError as se:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(se)}")
    
    async def delete_by_api_key(self,api_key:str):
        try:
            stmt = (
                delete(ApiKey)
                .where(ApiKey.api_key == api_key)
            )
            await self.session.execute(stmt)
            await self.session.flush()
            return True
        except SQLAlchemyError as se:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(se)}")
    
    async def delete_api_key(self):
        try:
            stmt = (
                delete(ApiKey)
            )
            await self.session.execute(stmt)
            await self.session.flush()
            # await self.session.commit()
            return True
        except SQLAlchemyError as se:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(se)}")
        

        
 
