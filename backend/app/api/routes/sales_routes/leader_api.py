from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.models.sales.leader import Leader
from app.dependency.auth_dependency import verify_cfo_access
from app.dependency.sales.leader_dependency import get_leader_service
from app.services.sales.leader_service import LeaderService
from app.schemas.sales.leader_schema import (
    LeaderCreateSchema,
    LeaderUpdateSchema,
    LeaderResponseSchema,
    LeaderDropdownSchema,
)

leader_router = APIRouter(prefix="/api/v1/leaders", tags=["Leader API"])


@leader_router.get("/dropdown", status_code=status.HTTP_200_OK, response_model=list[LeaderDropdownSchema])
async def get_leaders_dropdown(
    service: LeaderService = Depends(get_leader_service),
):
    """Get all leaders with leader_id, full_name, and is_active status for dropdown."""
    leaders = await service.get_leaders_dropdown()
    dropdown_list = [LeaderDropdownSchema.model_validate(leader) for leader in leaders]
    return JSONResponse(content=jsonable_encoder(dropdown_list), status_code=status.HTTP_200_OK)


@leader_router.post("", status_code=status.HTTP_201_CREATED, response_model=LeaderResponseSchema)
async def create_leader(
    payload: LeaderCreateSchema,
    service: LeaderService = Depends(get_leader_service),
    _cfo = Depends(verify_cfo_access),
):
    """Create a new leader record."""
    leader = await service.create_leader(payload)
    return JSONResponse(
        content=jsonable_encoder(LeaderResponseSchema.model_validate(leader)),
        status_code=status.HTTP_201_CREATED,
    )
from app.schemas.common.bulk_delete_schema import BulkDeleteRequest


@leader_router.delete("/bulk", status_code=status.HTTP_200_OK)
async def bulk_delete_leaders(
    payload: BulkDeleteRequest,
    service: LeaderService = Depends(get_leader_service),
    _cfo = Depends(verify_cfo_access),
):
    """Delete multiple selected leader records."""
    count = await service.bulk_delete_leaders(leader_ids=[str(i) for i in payload.ids])
    return JSONResponse(
        content={"message": f"Successfully deleted {count} leader records.", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@leader_router.delete("/delete-all", status_code=status.HTTP_200_OK)
async def delete_all_leaders(
    service: LeaderService = Depends(get_leader_service),
    _cfo = Depends(verify_cfo_access),
):
    """Delete all leader records (Super Admin / Executive only)."""
    count = await service.delete_all_leaders()
    return JSONResponse(
        content={"message": f"Successfully deleted all leaders ({count} records).", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@leader_router.get("/{leader_id}", status_code=status.HTTP_200_OK, response_model=LeaderResponseSchema)
async def get_leader(
    leader_id: str,
    service: LeaderService = Depends(get_leader_service),
):
    """Fetch a leader record by leader_id."""
    leader = await service.get_leader_by_id(leader_id)
    return JSONResponse(
        content=jsonable_encoder(LeaderResponseSchema.model_validate(leader)),
        status_code=status.HTTP_200_OK,
    )


@leader_router.get("/{leader_id}/products", status_code=status.HTTP_200_OK)
async def get_leader_products(
    leader_id: str,
    service: LeaderService = Depends(get_leader_service),
    _cfo = Depends(verify_cfo_access),
):
    """Fetch all registered products associated with a leader to populate UI reassignment modal dropdowns."""
    products = await service.get_leader_products(leader_id)
    return JSONResponse(content=jsonable_encoder(products), status_code=status.HTTP_200_OK)


@leader_router.get("", status_code=status.HTTP_200_OK)
async def list_leaders(
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="Keyset cursor: pass the last leader_id from previous response"),
    search: Optional[str] = Query(None, description="Search term for first_name, last_name, email, designation, phone_no, emp_id, leader_id"),
    is_active: Optional[bool] = Query(None, description="Filter leaders by active status (true/false)"),
    service: LeaderService = Depends(get_leader_service),
):
    """List leaders with keyset pagination, active status filtering, and multi-field search filtering."""
    result = await service.get_all_leaders(limit=limit, cursor=cursor, search=search, is_active=is_active)
    result["data"] = [
        LeaderResponseSchema.model_validate(item).model_dump()
        for item in result["data"]
    ]
    return JSONResponse(content=jsonable_encoder(result), status_code=status.HTTP_200_OK)


@leader_router.put("/{leader_id}", status_code=status.HTTP_200_OK, response_model=LeaderResponseSchema)
@leader_router.patch("/{leader_id}", status_code=status.HTTP_200_OK, response_model=LeaderResponseSchema)
async def update_leader(
    leader_id: str,
    payload: LeaderUpdateSchema,
    service: LeaderService = Depends(get_leader_service),
    _cfo = Depends(verify_cfo_access),
):
    """Update a leader record."""
    leader = await service.update_leader(leader_id, payload)
    return JSONResponse(
        content=jsonable_encoder(LeaderResponseSchema.model_validate(leader)),
        status_code=status.HTTP_200_OK,
    )


@leader_router.delete("/{leader_id}", status_code=status.HTTP_200_OK)
async def delete_leader(
    leader_id: str,
    service: LeaderService = Depends(get_leader_service),
    _cfo = Depends(verify_cfo_access),
):
    """Delete a leader record."""
    await service.delete_leader(leader_id)
    return JSONResponse(
        content={"message": f"Leader {leader_id} deleted successfully"},
        status_code=status.HTTP_200_OK,
    )
