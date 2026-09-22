from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.dependency.sales.weekly_pdf_register_dependency import get_weekly_pdf_register_service
from app.dependency.auth_dependency import verify_access_token_dep
from app.models.sales.leader import Leader
from app.services.sales.weekly_pdf_register_service import WeeklyPdfRegisterService
from app.schemas.sales.weekly_pdf_register_schema import (
    WeeklyPdfRegisterCreate,
    WeeklyPdfRegisterResponse,
)

weekly_pdf_register_router = APIRouter(prefix="/api/v1/weekly-pdfs", tags=["Weekly PDF Register"])


@weekly_pdf_register_router.post("", status_code=status.HTTP_201_CREATED, response_model=WeeklyPdfRegisterResponse)
async def create_weekly_pdf_record(
    payload: WeeklyPdfRegisterCreate,
    service: WeeklyPdfRegisterService = Depends(get_weekly_pdf_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Register a new weekly PDF report record."""
    record = await service.create_weekly_pdf_record(payload)
    return JSONResponse(
        content=jsonable_encoder(WeeklyPdfRegisterResponse.model_validate(record)),
        status_code=status.HTTP_201_CREATED,
    )


@weekly_pdf_register_router.get("", status_code=status.HTTP_200_OK, response_model=List[WeeklyPdfRegisterResponse])
async def list_all_weekly_pdfs(
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="Keyset cursor (weekly_pdf_id)"),
    service: WeeklyPdfRegisterService = Depends(get_weekly_pdf_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """List all generated weekly PDF reports stored in SeaweedFS."""
    records = await service.get_all_weekly_pdfs(limit=limit, cursor=cursor)
    return JSONResponse(
        content=jsonable_encoder([WeeklyPdfRegisterResponse.model_validate(r) for r in records]),
        status_code=status.HTTP_200_OK,
    )
from app.schemas.common.bulk_delete_schema import BulkDeleteRequest


@weekly_pdf_register_router.delete("/bulk", status_code=status.HTTP_200_OK)
async def bulk_delete_weekly_pdfs(
    payload: BulkDeleteRequest,
    service: WeeklyPdfRegisterService = Depends(get_weekly_pdf_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete multiple selected weekly PDF report records."""
    count = await service.bulk_delete_weekly_pdfs(weekly_pdf_ids=[str(i) for i in payload.ids], current_user=current_user)
    return JSONResponse(
        content={"message": f"Successfully deleted {count} weekly PDF records.", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@weekly_pdf_register_router.delete("/delete-all", status_code=status.HTTP_200_OK)
async def delete_all_weekly_pdfs(
    service: WeeklyPdfRegisterService = Depends(get_weekly_pdf_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete all weekly PDF report records (Super Admin / Executive only)."""
    count = await service.delete_all_weekly_pdfs(current_user=current_user)
    return JSONResponse(
        content={"message": f"Successfully deleted all weekly PDF records ({count} records).", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@weekly_pdf_register_router.get("/{weekly_pdf_id}", status_code=status.HTTP_200_OK, response_model=WeeklyPdfRegisterResponse)
async def get_weekly_pdf_by_id(
    weekly_pdf_id: str,
    service: WeeklyPdfRegisterService = Depends(get_weekly_pdf_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Get a single weekly PDF report record by ID."""
    record = await service.get_weekly_pdf_by_id(weekly_pdf_id)
    return JSONResponse(
        content=jsonable_encoder(WeeklyPdfRegisterResponse.model_validate(record)),
        status_code=status.HTTP_200_OK,
    )


@weekly_pdf_register_router.delete("/{weekly_pdf_id}", status_code=status.HTTP_200_OK)
async def delete_weekly_pdf(
    weekly_pdf_id: str,
    service: WeeklyPdfRegisterService = Depends(get_weekly_pdf_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete a single weekly PDF report record."""
    await service.delete_weekly_pdf(weekly_pdf_id)
    return JSONResponse(
        content={"message": f"Weekly PDF record '{weekly_pdf_id}' deleted successfully."},
        status_code=status.HTTP_200_OK,
    )
