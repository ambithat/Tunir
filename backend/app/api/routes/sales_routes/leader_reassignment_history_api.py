from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.models.sales.leader import Leader
from app.dependency.auth_dependency import verify_cfo_access
from app.dependency.sales.leader_dependency import get_leader_service
from app.services.sales.leader_service import LeaderService
from app.schemas.sales.leader_schema import (
    LeaderReassignmentHistoryCreateSchema,
    LeaderReassignmentHistoryUpdateSchema,
    LeaderReassignmentHistoryResponseSchema,
    GranularProductReassignmentSchema,
    GranularProductReassignmentResponseSchema,
)

reassignment_history_router = APIRouter(
    prefix="/api/v1/leader-reassignment-history",
    tags=["Leader Reassignment History API"]
)


@reassignment_history_router.post("/reassign-products", status_code=status.HTTP_200_OK, response_model=GranularProductReassignmentResponseSchema)
async def reassign_products_granularly_in_history(
    payload: GranularProductReassignmentSchema,
    service: LeaderService = Depends(get_leader_service),
    current_user: Leader = Depends(verify_cfo_access),
):
    """Reassign products level-by-level (e.g. EBM -> Saxena, Meglan -> Neel, STAR AI -> Kaushik) and create reassignment history audit record."""
    result = await service.reassign_products_granularly(
        source_leader_id=payload.source_leader_id,
        product_assignments=[item.model_dump() for item in payload.product_assignments],
        default_target_leader_id=payload.default_target_leader_id,
        reassigned_by=current_user.emp_id,
        deactivate_source=payload.deactivate_source
    )
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


@reassignment_history_router.post("", status_code=status.HTTP_201_CREATED, response_model=LeaderReassignmentHistoryResponseSchema)
async def create_reassignment_history(
    payload: LeaderReassignmentHistoryCreateSchema,
    service: LeaderService = Depends(get_leader_service),
    _cfo = Depends(verify_cfo_access),
):
    """Create a new leader reassignment history audit record."""
    result = await service.create_reassignment_history(payload)
    return JSONResponse(
        content=jsonable_encoder(result),
        status_code=status.HTTP_201_CREATED,
    )


@reassignment_history_router.get("", status_code=status.HTTP_200_OK)
async def list_reassignment_history(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Search by leader ID or name"),
    service: LeaderService = Depends(get_leader_service),
    _cfo = Depends(verify_cfo_access),
):
    """List leader reassignment history audit logs with pagination and search."""
    result = await service.repo.get_reassignment_history(limit=limit, offset=offset, search=search)
    return JSONResponse(content=jsonable_encoder(result), status_code=status.HTTP_200_OK)


@reassignment_history_router.get("/{history_id}", status_code=status.HTTP_200_OK, response_model=LeaderReassignmentHistoryResponseSchema)
async def get_reassignment_history(
    history_id: int,
    service: LeaderService = Depends(get_leader_service),
    _cfo = Depends(verify_cfo_access),
):
    """Fetch a leader reassignment history record by ID."""
    result = await service.get_reassignment_history_by_id(history_id)
    return JSONResponse(content=jsonable_encoder(result), status_code=status.HTTP_200_OK)


@reassignment_history_router.put("/{history_id}", status_code=status.HTTP_200_OK, response_model=LeaderReassignmentHistoryResponseSchema)
@reassignment_history_router.patch("/{history_id}", status_code=status.HTTP_200_OK, response_model=LeaderReassignmentHistoryResponseSchema)
async def update_reassignment_history(
    history_id: int,
    payload: LeaderReassignmentHistoryUpdateSchema,
    service: LeaderService = Depends(get_leader_service),
    _cfo = Depends(verify_cfo_access),
):
    """Update a leader reassignment history record."""
    result = await service.update_reassignment_history(history_id, payload)
    return JSONResponse(content=jsonable_encoder(result), status_code=status.HTTP_200_OK)


@reassignment_history_router.delete("/{history_id}", status_code=status.HTTP_200_OK)
async def delete_reassignment_history(
    history_id: int,
    service: LeaderService = Depends(get_leader_service),
    _cfo = Depends(verify_cfo_access),
):
    """Delete a leader reassignment history record."""
    await service.delete_reassignment_history(history_id)
    return JSONResponse(
        content={"message": f"Reassignment history record {history_id} deleted successfully"},
        status_code=status.HTTP_200_OK,
    )
