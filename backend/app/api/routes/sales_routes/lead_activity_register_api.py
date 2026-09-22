from datetime import date
from typing import Optional, List, Any, Union
from pydantic import BaseModel
from fastapi import APIRouter, Depends, status, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.dependency.sales.lead_activity_register_dependency import get_lead_activity_register_service
from app.services.sales.lead_activity_register_service import LeadActivityRegisterService
from app.schemas.sales.lead_activity_register_schema import (
    LeadActivityRegisterCreate,
    LeadActivityRegisterUpdate,
    LeadActivityRegisterResponse,
)
from app.dependency.sales.lead_register_dependency import get_lead_register_service
from app.services.sales.lead_register_service import LeadRegisterService
from app.dependency.auth_dependency import verify_access_token_dep
from app.models.sales.leader import Leader

from app.schemas.common.bulk_delete_schema import BulkDeleteRequest
from app.services.sales.email.mail_event_service import process_pending_mail_events

from app.dependency.sales.leader_dependency import get_leader_service
from app.services.sales.leader_service import LeaderService
from app.schemas.sales.leader_schema import LeaderDropdownSchema
from app.schemas.sales.lead_register_schema import LeadDropdownSchema

lead_activity_register_router = APIRouter(prefix="/api/v1/leads/{lead_id}/activities", tags=["Lead Activity Register"])
activity_router = APIRouter(prefix="/api/v1/activities", tags=["Lead Activity Register"])


@activity_router.get("/dropdowns", status_code=status.HTTP_200_OK)
async def get_activity_dropdown_options(
    leader_service: LeaderService = Depends(get_leader_service),
    lead_service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Get both leader_id dropdown and lead_id dropdown options for lead activity forms."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    
    leaders = await leader_service.get_leaders_dropdown()
    leads = await lead_service.get_leads_dropdown(leader_id=current_user.leader_id, is_executive=is_executive)
    
    return JSONResponse(
        content=jsonable_encoder({
            "leaders": [LeaderDropdownSchema.model_validate(l).model_dump() for l in leaders],
            "leads": [LeadDropdownSchema.model_validate(ld).model_dump() for ld in leads],
        }),
        status_code=status.HTTP_200_OK
    )


@lead_activity_register_router.post("", status_code=status.HTTP_201_CREATED, response_model=LeadActivityRegisterResponse)
async def create_activity(
    lead_id: str,
    payload: LeadActivityRegisterCreate,
    background_tasks: BackgroundTasks,
    service: LeadActivityRegisterService = Depends(get_lead_activity_register_service),
    lead_service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Create a new activity for a lead."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin"] or user_desig in ["CEO", "CFO"]
    await lead_service.get_lead_by_id(lead_id, leader_id=current_user.leader_id, is_executive=is_executive)
    
    activity = await service.create_activity(lead_id, payload, current_user=current_user)
    
    # Process pending mail events instantly in FastAPI background task post-response
    background_tasks.add_task(process_pending_mail_events)

    return JSONResponse(
        content=jsonable_encoder(LeadActivityRegisterResponse.model_validate(activity)),
        status_code=status.HTTP_201_CREATED,
    )

@lead_activity_register_router.get("", status_code=status.HTTP_200_OK)
async def list_activities(
    lead_id: str,
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="Keyset cursor for pagination (activity_id)"),
    is_active: Optional[bool] = Query(None, description="Filter by active status (executives only)"),
    service: LeadActivityRegisterService = Depends(get_lead_activity_register_service),
    lead_service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):

    """List all activities for a given lead with keyset pagination."""
    # Ensure lead exists
    await lead_service.get_lead_by_id(lead_id)
    
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin"] or user_desig in ["CEO", "CFO"]
    result = await service.get_activities_by_lead(
        lead_id=lead_id, limit=limit, cursor=cursor,
        leader_id=current_user.leader_id, is_executive=is_executive, is_active=is_active
    )
    
    result["data"] = [
        LeadActivityRegisterResponse.model_validate(a).model_dump()
        for a in result["data"]
    ]
    
    return JSONResponse(
        content=jsonable_encoder(result),
        status_code=status.HTTP_200_OK,
    )

@activity_router.get("", status_code=status.HTTP_200_OK)
async def list_all_activities(
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="Keyset cursor for pagination (activity_id)"),
    is_active: Optional[bool] = Query(None, description="Filter by active status (executives only)"),
    search: Optional[str] = Query(None, description="JSON array of filter objects e.g. [{'action_status': 'Pending'}, {'activity_type': 'Call'}] or global text search"),
    from_date: Optional[date] = Query(None, description="Filter activities on or after activity_date (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="Filter activities on or before activity_date (YYYY-MM-DD)"),
    service: LeadActivityRegisterService = Depends(get_lead_activity_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """List all activities across all leads with keyset pagination and dynamic array-based search."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin"] or user_desig in ["CEO", "CFO"]
    result = await service.get_all_activities(
        limit=limit, cursor=cursor,
        leader_id=current_user.leader_id, is_executive=is_executive, is_active=is_active,
        search=search,
        from_date=from_date, to_date=to_date
    )
    
    result["data"] = [
        LeadActivityRegisterResponse.model_validate(a).model_dump()
        for a in result["data"]
    ]
    
    return JSONResponse(
        content=jsonable_encoder(result),
        status_code=status.HTTP_200_OK,
    )

@activity_router.delete("/bulk", status_code=status.HTTP_200_OK)
@lead_activity_register_router.delete("/bulk", status_code=status.HTTP_200_OK)
async def bulk_delete_activities(
    payload: BulkDeleteRequest,
    background_tasks: BackgroundTasks,
    service: LeadActivityRegisterService = Depends(get_lead_activity_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete multiple selected activity records."""
    count = await service.bulk_delete_activities(activity_ids=[str(i) for i in payload.ids], current_user=current_user)
    background_tasks.add_task(process_pending_mail_events)
    return JSONResponse(
        content={"message": f"Successfully deleted {count} activity records.", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@activity_router.delete("/delete-all", status_code=status.HTTP_200_OK)
@lead_activity_register_router.delete("/delete-all", status_code=status.HTTP_200_OK)
async def delete_all_activities(
    background_tasks: BackgroundTasks,
    service: LeadActivityRegisterService = Depends(get_lead_activity_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete all activity register records (Super Admin / Executive only)."""
    count = await service.delete_all_activities(current_user=current_user)
    background_tasks.add_task(process_pending_mail_events)
    return JSONResponse(
        content={"message": f"Successfully deleted all activities ({count} records).", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@activity_router.get("/{activity_id}", status_code=status.HTTP_200_OK, response_model=LeadActivityRegisterResponse)
async def get_activity(
    activity_id: str,
    service: LeadActivityRegisterService = Depends(get_lead_activity_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Get a specific activity by ID."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin"] or user_desig in ["CEO", "CFO"]
    activity = await service.get_activity_by_id(activity_id, leader_id=current_user.leader_id, is_executive=is_executive)
    return JSONResponse(
        content=jsonable_encoder(LeadActivityRegisterResponse.model_validate(activity)),
        status_code=status.HTTP_200_OK,
    )

@activity_router.patch("/{activity_id}", status_code=status.HTTP_200_OK, response_model=LeadActivityRegisterResponse)
async def update_activity(
    activity_id: str,
    payload: LeadActivityRegisterUpdate,
    background_tasks: BackgroundTasks,
    service: LeadActivityRegisterService = Depends(get_lead_activity_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Update an activity."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin"] or user_desig in ["CEO", "CFO"]
    activity = await service.update_activity(
        activity_id, payload, leader_id=current_user.leader_id, is_executive=is_executive, current_user=current_user
    )
    background_tasks.add_task(process_pending_mail_events)
    return JSONResponse(
        content=jsonable_encoder(LeadActivityRegisterResponse.model_validate(activity)),
        status_code=status.HTTP_200_OK,
    )



@activity_router.delete("/{activity_id}", status_code=status.HTTP_200_OK)
async def delete_activity(
    activity_id: str,
    background_tasks: BackgroundTasks,
    service: LeadActivityRegisterService = Depends(get_lead_activity_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete an activity."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin"] or user_desig in ["CEO", "CFO"]
    await service.delete_activity(activity_id, is_executive=is_executive, leader_id=current_user.leader_id, current_user=current_user)
    background_tasks.add_task(process_pending_mail_events)
    return JSONResponse(
        content={"message": f"Activity '{activity_id}' deleted successfully."},
        status_code=status.HTTP_200_OK,
    )
