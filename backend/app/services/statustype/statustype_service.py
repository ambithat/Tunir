from typing import List
from fastapi import HTTPException, status
from app.repositories.statustype.statustype_repository import StatusTypeRepository

class StatusTypeService:
    def __init__(self, repository: StatusTypeRepository):
        self.repository = repository

    async def create_leader_stage(self, data: dict):
        try:
            return await self.repository.create_leader_stage(data)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_leader_stage_dropdown(self):
        try:
            return await self.repository.get_leader_stage_dropdown()
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def update_leader_stage(self, id: int, data: dict):
        try:
            result = await self.repository.update_leader_stage(id, data)
            if not result:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leader stage not found")
            return result
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def delete_leader_stage(self, id: int):
        try:
            success = await self.repository.delete_leader_stage(id)
            if not success:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leader stage not found")
            return {"message": "Leader stage deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def create_activity_type(self, data: dict):
        try:
            return await self.repository.create_activity_type(data)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_activity_type_dropdown(self):
        try:
            return await self.repository.get_activity_type_dropdown()
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def update_activity_type(self, id: int, data: dict):
        try:
            result = await self.repository.update_activity_type(id, data)
            if not result:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity type not found")
            return result
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def delete_activity_type(self, id: int):
        try:
            success = await self.repository.delete_activity_type(id)
            if not success:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity type not found")
            return {"message": "Activity type deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def create_product(self, data: dict):
        try:
            return await self.repository.create_product(data)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_product_dropdown(self):
        try:
            return await self.repository.get_product_dropdown()
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def update_product(self, id: int, data: dict):
        try:
            result = await self.repository.update_product(id, data)
            if not result:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
            return result
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def delete_product(self, id: int):
        try:
            success = await self.repository.delete_product(id)
            if not success:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
            return {"message": "Product deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def create_lead_product(self, data: dict):
        try:
            return await self.repository.create_lead_product(data)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_lead_product_dropdown(self):
        try:
            return await self.repository.get_lead_product_dropdown()
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def update_lead_product(self, id: int, data: dict):
        try:
            result = await self.repository.update_lead_product(id, data)
            if not result:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead product status not found")
            return result
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def delete_lead_product(self, id: int):
        try:
            success = await self.repository.delete_lead_product(id)
            if not success:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead product status not found")
            return {"message": "Lead product status deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def create_daily_activity_outcome(self, data: dict):
        try:
            return await self.repository.create_daily_activity_outcome(data)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_daily_activity_outcome_dropdown(self):
        try:
            return await self.repository.get_daily_activity_outcome_dropdown()
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def update_daily_activity_outcome(self, id: int, data: dict):
        try:
            result = await self.repository.update_daily_activity_outcome(id, data)
            if not result:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily activity outcome not found")
            return result
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def delete_daily_activity_outcome(self, id: int):
        try:
            success = await self.repository.delete_daily_activity_outcome(id)
            if not success:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily activity outcome not found")
            return {"message": "Daily activity outcome deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def create_daily_activity_status(self, data: dict):
        try:
            return await self.repository.create_daily_activity_status(data)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_daily_activity_status_dropdown(self):
        try:
            return await self.repository.get_daily_activity_status_dropdown()
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def update_daily_activity_status(self, id: int, data: dict):
        try:
            result = await self.repository.update_daily_activity_status(id, data)
            if not result:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily activity status not found")
            return result
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def delete_daily_activity_status(self, id: int):
        try:
            success = await self.repository.delete_daily_activity_status(id)
            if not success:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily activity status not found")
            return {"message": "Daily activity status deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
