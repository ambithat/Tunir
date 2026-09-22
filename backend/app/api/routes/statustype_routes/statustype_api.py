from fastapi import APIRouter, Depends
from typing import List
from app.dependency.auth_dependency import verify_cfo_access
from app.dependency.statustype.statustype_dependency import get_statustype_service
from app.services.statustype.statustype_service import StatusTypeService
from app.schemas.statustype import statustype_schema

statustype_router = APIRouter(prefix="/statustype", tags=["StatusType"])

# LeaderStageStatusType
@statustype_router.post("/leader-stage", response_model=statustype_schema.LeaderStageStatusTypeResponse)
async def create_leader_stage(
    data: statustype_schema.LeaderStageStatusTypeCreate,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.create_leader_stage(data.model_dump())

@statustype_router.get("/leader-stage/dropdown", response_model=List[statustype_schema.LeaderStageStatusTypeDropdown])
async def get_leader_stage_dropdown(service: StatusTypeService = Depends(get_statustype_service)):
    return await service.get_leader_stage_dropdown()

@statustype_router.put("/leader-stage/{id}", response_model=statustype_schema.LeaderStageStatusTypeResponse)
async def update_leader_stage(
    id: int,
    data: statustype_schema.LeaderStageStatusTypeUpdate,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.update_leader_stage(id, data.model_dump(exclude_unset=True))

@statustype_router.delete("/leader-stage/{id}")
async def delete_leader_stage(
    id: int,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.delete_leader_stage(id)

# ActivityTypeStatusType
@statustype_router.post("/activity-type", response_model=statustype_schema.ActivityTypeStatusTypeResponse)
async def create_activity_type(
    data: statustype_schema.ActivityTypeStatusTypeCreate,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.create_activity_type(data.model_dump())

@statustype_router.get("/activity-type/dropdown", response_model=List[statustype_schema.ActivityTypeStatusTypeDropdown])
async def get_activity_type_dropdown(service: StatusTypeService = Depends(get_statustype_service)):
    return await service.get_activity_type_dropdown()

@statustype_router.put("/activity-type/{id}", response_model=statustype_schema.ActivityTypeStatusTypeResponse)
async def update_activity_type(
    id: int,
    data: statustype_schema.ActivityTypeStatusTypeUpdate,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.update_activity_type(id, data.model_dump(exclude_unset=True))

@statustype_router.delete("/activity-type/{id}")
async def delete_activity_type(
    id: int,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.delete_activity_type(id)

# ProductStatusType
@statustype_router.post("/product", response_model=statustype_schema.ProductStatusTypeResponse)
async def create_product(
    data: statustype_schema.ProductStatusTypeCreate,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.create_product(data.model_dump())

@statustype_router.get("/product/dropdown", response_model=List[statustype_schema.ProductStatusTypeDropdown])
async def get_product_dropdown(service: StatusTypeService = Depends(get_statustype_service)):
    return await service.get_product_dropdown()

@statustype_router.put("/product/{id}", response_model=statustype_schema.ProductStatusTypeResponse)
async def update_product(
    id: int,
    data: statustype_schema.ProductStatusTypeUpdate,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.update_product(id, data.model_dump(exclude_unset=True))

@statustype_router.delete("/product/{id}")
async def delete_product(
    id: int,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.delete_product(id)

# LeadProductStatusType
@statustype_router.post("/lead-product", response_model=statustype_schema.LeadProductStatusTypeResponse)
async def create_lead_product(
    data: statustype_schema.LeadProductStatusTypeCreate,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.create_lead_product(data.model_dump())

@statustype_router.get("/lead-product/dropdown", response_model=List[statustype_schema.LeadProductStatusTypeDropdown])
async def get_lead_product_dropdown(service: StatusTypeService = Depends(get_statustype_service)):
    return await service.get_lead_product_dropdown()

@statustype_router.put("/lead-product/{id}", response_model=statustype_schema.LeadProductStatusTypeResponse)
async def update_lead_product(
    id: int,
    data: statustype_schema.LeadProductStatusTypeUpdate,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.update_lead_product(id, data.model_dump(exclude_unset=True))

@statustype_router.delete("/lead-product/{id}")
async def delete_lead_product(
    id: int,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.delete_lead_product(id)

# DailyActivityOutcomeStatusType
@statustype_router.post("/daily-activity-outcome", response_model=statustype_schema.DailyActivityOutcomeStatusTypeResponse)
async def create_daily_activity_outcome(
    data: statustype_schema.DailyActivityOutcomeStatusTypeCreate,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.create_daily_activity_outcome(data.model_dump())

@statustype_router.get("/daily-activity-outcome/dropdown", response_model=List[statustype_schema.DailyActivityOutcomeStatusTypeDropdown])
async def get_daily_activity_outcome_dropdown(service: StatusTypeService = Depends(get_statustype_service)):
    return await service.get_daily_activity_outcome_dropdown()

@statustype_router.put("/daily-activity-outcome/{id}", response_model=statustype_schema.DailyActivityOutcomeStatusTypeResponse)
async def update_daily_activity_outcome(
    id: int,
    data: statustype_schema.DailyActivityOutcomeStatusTypeUpdate,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.update_daily_activity_outcome(id, data.model_dump(exclude_unset=True))

@statustype_router.delete("/daily-activity-outcome/{id}")
async def delete_daily_activity_outcome(
    id: int,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.delete_daily_activity_outcome(id)

# DailyActivityStatusType
@statustype_router.post("/daily-activity-status", response_model=statustype_schema.DailyActivityStatusTypeResponse)
async def create_daily_activity_status(
    data: statustype_schema.DailyActivityStatusTypeCreate,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.create_daily_activity_status(data.model_dump())

@statustype_router.get("/daily-activity-status/dropdown", response_model=List[statustype_schema.DailyActivityStatusTypeDropdown])
async def get_daily_activity_status_dropdown(service: StatusTypeService = Depends(get_statustype_service)):
    return await service.get_daily_activity_status_dropdown()

@statustype_router.put("/daily-activity-status/{id}", response_model=statustype_schema.DailyActivityStatusTypeResponse)
async def update_daily_activity_status(
    id: int,
    data: statustype_schema.DailyActivityStatusTypeUpdate,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.update_daily_activity_status(id, data.model_dump(exclude_unset=True))

@statustype_router.delete("/daily-activity-status/{id}")
async def delete_daily_activity_status(
    id: int,
    service: StatusTypeService = Depends(get_statustype_service),
    _cfo = Depends(verify_cfo_access)
):
    return await service.delete_daily_activity_status(id)
