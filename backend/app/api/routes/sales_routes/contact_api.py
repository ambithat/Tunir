from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.dependency.sales.contact_dependency import get_contact_service
from app.dependency.auth_dependency import verify_access_token_dep
from app.models.sales.leader import Leader
from app.services.sales.contact_service import ContactService
from app.schemas.sales.contact_schema import (
    ContactCreateSchema,
    ContactUpdateSchema,
    ContactResponseSchema,
    ContactDropdownSchema,
)

contact_router = APIRouter(prefix="/api/v1/contacts", tags=["Contact API"])


@contact_router.get("/dropdown", status_code=status.HTTP_200_OK)
async def get_contacts_dropdown(
    service: ContactService = Depends(get_contact_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Get active contacts list for dropdown."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin"] or user_desig in ["CEO", "CFO"]
    leader_id = current_user.leader_id
    contacts = await service.get_contacts_dropdown(leader_id=leader_id, is_executive=is_executive)
    return JSONResponse(
        content=jsonable_encoder([ContactDropdownSchema.model_validate(c).model_dump() for c in contacts]),
        status_code=status.HTTP_200_OK
    )


@contact_router.post("", status_code=status.HTTP_201_CREATED, response_model=ContactResponseSchema)
async def create_contact(
    payload: ContactCreateSchema,
    service: ContactService = Depends(get_contact_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Create a new contact record."""
    if not payload.created_by:
        payload.created_by = current_user.leader_id or current_user.emp_id
    contact = await service.create_contact(payload)
    return JSONResponse(
        content=jsonable_encoder(ContactResponseSchema.model_validate(contact)),
        status_code=status.HTTP_201_CREATED,
    )
from app.schemas.common.bulk_delete_schema import BulkDeleteRequest


@contact_router.delete("/bulk", status_code=status.HTTP_200_OK)
async def bulk_delete_contacts(
    payload: BulkDeleteRequest,
    service: ContactService = Depends(get_contact_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete multiple selected contact records."""
    count = await service.bulk_delete_contacts(contact_ids=payload.ids, current_user=current_user)
    return JSONResponse(
        content={"message": f"Successfully deleted {count} contact records.", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@contact_router.delete("/delete-all", status_code=status.HTTP_200_OK)
async def delete_all_contacts(
    service: ContactService = Depends(get_contact_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete all contact records (Super Admin / Executive only)."""
    count = await service.delete_all_contacts(current_user=current_user)
    return JSONResponse(
        content={"message": f"Successfully deleted all contacts ({count} records).", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@contact_router.get("/{contact_id}", status_code=status.HTTP_200_OK, response_model=ContactResponseSchema)
async def get_contact(
    contact_id: str,
    service: ContactService = Depends(get_contact_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Fetch a contact record by contact_id."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin"] or user_desig in ["CEO", "CFO"]
    contact = await service.get_contact_by_id(contact_id, is_executive=is_executive)
    return JSONResponse(
        content=jsonable_encoder(ContactResponseSchema.model_validate(contact)),
        status_code=status.HTTP_200_OK,
    )


@contact_router.get("", status_code=status.HTTP_200_OK)
async def list_contacts(
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="Keyset cursor: pass the last contact_id from previous response"),
    is_active: Optional[bool] = Query(None, description="Filter by active status (executives only)"),
    search: Optional[str] = Query(None, description="Search term for company, contact_name, designation, phone_no, email, country"),
    service: ContactService = Depends(get_contact_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """List contacts with keyset pagination and multi-field search filtering."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin"] or user_desig in ["CEO", "CFO"]
    leader_id = current_user.leader_id
    result = await service.get_all_contacts(
        limit=limit, cursor=cursor, leader_id=leader_id, is_executive=is_executive, is_active_filter=is_active, search=search
    )
    result["data"] = [
        ContactResponseSchema.model_validate(item).model_dump()
        for item in result["data"]
    ]
    return JSONResponse(content=jsonable_encoder(result), status_code=status.HTTP_200_OK)


@contact_router.patch("/{contact_id}", status_code=status.HTTP_200_OK, response_model=ContactResponseSchema)
async def update_contact(
    contact_id: str,
    payload: ContactUpdateSchema,
    service: ContactService = Depends(get_contact_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Update a contact record."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin"] or user_desig in ["CEO", "CFO"]
    contact = await service.update_contact(contact_id, payload, is_executive=is_executive)
    return JSONResponse(
        content=jsonable_encoder(ContactResponseSchema.model_validate(contact)),
        status_code=status.HTTP_200_OK,
    )


@contact_router.delete("/{contact_id}", status_code=status.HTTP_200_OK)
async def delete_contact(
    contact_id: str,
    service: ContactService = Depends(get_contact_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete a contact record."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin"] or user_desig in ["CEO", "CFO"]
    await service.delete_contact(contact_id, is_executive=is_executive)
    return JSONResponse(
        content={"message": f"Contact {contact_id} deleted successfully"},
        status_code=status.HTTP_200_OK,
    )

