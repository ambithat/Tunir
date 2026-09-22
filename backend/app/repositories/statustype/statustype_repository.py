from typing import List, Optional, Type, TypeVar, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.statustype.statustype import (
    LeaderStageStatusType,
    ActivityTypeStatusType,
    ProductStatusType,
    LeadProductStatusType,
    DailyActivityOutcomeStatusType,
    DailyActivityStatusType
)

T = TypeVar("T")

class StatusTypeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _create(self, model: Type[T], data: dict) -> T:
        instance = model(**data)
        self.session.add(instance)
        await self.session.flush()
        return instance

    async def _get_all(self, model: Type[T]) -> List[T]:
        stmt = select(model)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _update(self, model: Type[T], id: int, data: dict) -> Optional[T]:
        stmt = select(model).where(model.id == id)
        result = await self.session.execute(stmt)
        instance = result.scalar_one_or_none()
        if instance:
            for key, value in data.items():
                setattr(instance, key, value)
            await self.session.flush()
        return instance

    async def _delete(self, model: Type[T], id: int) -> bool:
        stmt = select(model).where(model.id == id)
        result = await self.session.execute(stmt)
        instance = result.scalar_one_or_none()
        if instance:
            await self.session.delete(instance)
            await self.session.flush()
            return True
        return False

    # LeaderStageStatusType
    async def create_leader_stage(self, data: dict) -> LeaderStageStatusType:
        return await self._create(LeaderStageStatusType, data)

    async def get_leader_stage_dropdown(self) -> List[LeaderStageStatusType]:
        return await self._get_all(LeaderStageStatusType)

    async def update_leader_stage(self, id: int, data: dict) -> Optional[LeaderStageStatusType]:
        return await self._update(LeaderStageStatusType, id, data)

    async def delete_leader_stage(self, id: int) -> bool:
        return await self._delete(LeaderStageStatusType, id)

    # ActivityTypeStatusType
    async def create_activity_type(self, data: dict) -> ActivityTypeStatusType:
        return await self._create(ActivityTypeStatusType, data)

    async def get_activity_type_dropdown(self) -> List[ActivityTypeStatusType]:
        return await self._get_all(ActivityTypeStatusType)

    async def update_activity_type(self, id: int, data: dict) -> Optional[ActivityTypeStatusType]:
        return await self._update(ActivityTypeStatusType, id, data)

    async def delete_activity_type(self, id: int) -> bool:
        return await self._delete(ActivityTypeStatusType, id)

    # ProductStatusType
    async def create_product(self, data: dict) -> ProductStatusType:
        return await self._create(ProductStatusType, data)

    async def get_product_dropdown(self) -> List[ProductStatusType]:
        return await self._get_all(ProductStatusType)

    async def update_product(self, id: int, data: dict) -> Optional[ProductStatusType]:
        return await self._update(ProductStatusType, id, data)

    async def delete_product(self, id: int) -> bool:
        return await self._delete(ProductStatusType, id)

    # LeadProductStatusType
    async def create_lead_product(self, data: dict) -> LeadProductStatusType:
        return await self._create(LeadProductStatusType, data)

    async def get_lead_product_dropdown(self) -> List[LeadProductStatusType]:
        return await self._get_all(LeadProductStatusType)

    async def update_lead_product(self, id: int, data: dict) -> Optional[LeadProductStatusType]:
        return await self._update(LeadProductStatusType, id, data)

    async def delete_lead_product(self, id: int) -> bool:
        return await self._delete(LeadProductStatusType, id)

    # DailyActivityOutcomeStatusType
    async def create_daily_activity_outcome(self, data: dict) -> DailyActivityOutcomeStatusType:
        return await self._create(DailyActivityOutcomeStatusType, data)

    async def get_daily_activity_outcome_dropdown(self) -> List[DailyActivityOutcomeStatusType]:
        return await self._get_all(DailyActivityOutcomeStatusType)

    async def update_daily_activity_outcome(self, id: int, data: dict) -> Optional[DailyActivityOutcomeStatusType]:
        return await self._update(DailyActivityOutcomeStatusType, id, data)

    async def delete_daily_activity_outcome(self, id: int) -> bool:
        return await self._delete(DailyActivityOutcomeStatusType, id)

    # DailyActivityStatusType
    async def create_daily_activity_status(self, data: dict) -> DailyActivityStatusType:
        return await self._create(DailyActivityStatusType, data)

    async def get_daily_activity_status_dropdown(self) -> List[DailyActivityStatusType]:
        return await self._get_all(DailyActivityStatusType)

    async def update_daily_activity_status(self, id: int, data: dict) -> Optional[DailyActivityStatusType]:
        return await self._update(DailyActivityStatusType, id, data)

    async def delete_daily_activity_status(self, id: int) -> bool:
        return await self._delete(DailyActivityStatusType, id)
