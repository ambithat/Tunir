import uuid
from datetime import date
from typing import List, Optional, Any
from fastapi import HTTPException, status

from app.repositories.sales.lead_activity_register_repository import LeadActivityRegisterRepository
from app.models.sales.lead_activity_register import LeadActivityRegister
from app.schemas.sales.lead_activity_register_schema import (
    LeadActivityRegisterCreate,
    LeadActivityRegisterUpdate,
)

class LeadActivityRegisterService:
    """Service layer for LeadActivityRegister operations."""

    def __init__(self, repo: LeadActivityRegisterRepository):
        self.repo = repo

    def _generate_activity_id(self) -> str:
        """Generate a unique string ID for Lead Activity."""
        # e.g. ACT-1234ABCD
        return f"ACT-{uuid.uuid4().hex[:8].upper()}"

    async def create_activity(
        self, lead_id: str, payload: LeadActivityRegisterCreate, current_user: Optional[Any] = None
    ) -> LeadActivityRegister:
        try:
            owner_id = payload.lead_owner_id or (getattr(current_user, "emp_id", None) if current_user else None)
            meeting_plan_val = getattr(payload, "meeting_plan", None) or getattr(payload, "summary", None)
            status_id_val = payload.action_status_id if payload.action_status_id is not None else 4

            na_val = payload.next_action
            na_type_val = payload.next_action_type_id
            nmp_val = payload.next_meeting_plan

            final_type_id = None
            if na_type_val is not None:
                final_type_id = na_type_val
            elif na_val is not None:
                if isinstance(na_val, int):
                    final_type_id = na_val
                elif isinstance(na_val, str) and na_val.isdigit():
                    final_type_id = int(na_val)

            final_meeting_plan = nmp_val
            if not final_meeting_plan and isinstance(na_val, str) and not na_val.isdigit():
                final_meeting_plan = na_val

            activity = LeadActivityRegister(
                activity_id=self._generate_activity_id(),
                lead_id=lead_id,
                lead_owner_id=owner_id,
                activity_date=payload.activity_date,
                activity_type_id=payload.activity_type_id,
                meeting_plan=meeting_plan_val,
                meeting_action_remarks=payload.meeting_action_remarks,
                next_meeting_plan=final_meeting_plan,
                next_action_date=payload.next_action_date,
                next_action_type_id=final_type_id,
                outcome_id=payload.outcome_id,
                action_status_id=status_id_val,
            )
            return await self.repo.create_activity(activity, current_user=current_user)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create activity: {str(e)}",
            )

    async def get_activity_by_id(self, activity_id: str, leader_id: Optional[str] = None, is_executive: bool = False) -> LeadActivityRegister:
        activity = await self.repo.get_activity_by_id(activity_id, leader_id=leader_id, is_executive=is_executive)
        if not activity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Activity '{activity_id}' not found.",
            )
        return activity

    async def get_activities_by_lead(
        self, lead_id: str, limit: int = 50, cursor: Optional[str] = None, 
        leader_id: Optional[str] = None, is_executive: bool = False, is_active: Optional[bool] = None
    ) -> dict:
        try:
            return await self.repo.get_activities_by_lead(
                lead_id=lead_id, limit=limit, cursor=cursor, 
                leader_id=leader_id, is_executive=is_executive, is_active_filter=is_active
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch activities: {str(e)}",
            )

    async def get_all_activities(
        self, limit: int = 50, cursor: Optional[str] = None, 
        leader_id: Optional[str] = None, is_executive: bool = False, is_active: Optional[bool] = None,
        search: Optional[str] = None,
        from_date: Optional[date] = None, to_date: Optional[date] = None
    ) -> dict:
        try:
            return await self.repo.get_all_activities(
                limit=limit, cursor=cursor, 
                leader_id=leader_id, is_executive=is_executive, is_active_filter=is_active,
                search=search,
                from_date=from_date, to_date=to_date
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch activities: {str(e)}",
            )

    async def update_activity(
        self, activity_id: str, payload: LeadActivityRegisterUpdate, leader_id: Optional[str] = None, is_executive: bool = False, current_user: Optional[Any] = None
    ) -> LeadActivityRegister:
        existing = await self.get_activity_by_id(activity_id, leader_id=leader_id, is_executive=is_executive)
        update_data = payload.model_dump(exclude_unset=True)

        user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
        user_desig = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
        is_super_admin = user_role in ["super admin", "admin"] or user_desig in ["CFO", "CEO"]
        status_name = (getattr(existing.action_status_type, "status", "") or "").strip().lower() if getattr(existing, "action_status_type", None) else ""

        # ── Completed Lock Check ────────────────────────────────────────────────────
        # Once an activity status is Completed (action_status_id == 2 or status name 'completed'),
        # standard users are NOT allowed to update or edit it.
        if (existing.action_status_id == 2 or status_name in ["completed", "complete"]) and not is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Once an activity status is Completed, users are not allowed to update or edit it."
            )

        # ── 24-Hour Overdue Lock Check ──────────────────────────────────────────────
        # If activity is Pending/Overdue (action_status_id in [4, 8] or status_name == 'overdue'):
        # It becomes non-editable for standard users after 24h. Only CFO / Super Admin can edit,
        # and overdue_reason MUST be provided.
        is_pending_or_overdue = (getattr(existing, "action_status_id", None) in [4, 8] or status_name in ["pending", "overdue"]) and getattr(existing, "activity_date", None)
        if is_pending_or_overdue:
            from datetime import datetime, time, timedelta
            act_event_start = datetime.combine(existing.activity_date, time(11, 0))
            is_locked = (getattr(existing, "action_status_id", None) == 8 or datetime.now() >= act_event_start + timedelta(hours=24))
            if is_locked:
                if not is_super_admin:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="This activity is Overdue (locked after 24 hours). Only Super Admin / CFO can edit overdue activities."
                    )
                if not update_data.get("overdue_reason") or not str(update_data.get("overdue_reason")).strip():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="An 'overdue_reason' is required when updating an overdue activity."
                    )

        if not update_data:
            return existing
        try:
            updated_activity = await self.repo.update_activity(activity_id, update_data, current_user=current_user)
            if not updated_activity:
                updated_activity = await self.repo.get_activity_by_id(activity_id, is_executive=True)

            # ── Automatic Activity Chaining ──────────────────────────────────────────
            # If outcome is Won or Lost (e.g. outcome_id in [9, 10] or outcome name contains 'won'/'lost'),
            # no need to create a new activity register!
            outcome_id_val = update_data.get("outcome_id") or getattr(updated_activity, "outcome_id", None)
            outcome_name = (getattr(updated_activity.outcome_status, "outcome", "") or "").strip().lower() if getattr(updated_activity, "outcome_status", None) else ""
            is_won_or_lost = (outcome_id_val in [9, 10]) or any(w in outcome_name for w in ["won", "lost"])

            if not is_won_or_lost:
                next_meeting_plan_val = update_data.get("next_meeting_plan") or getattr(updated_activity, "next_meeting_plan", None)
                next_act_type = update_data.get("next_action_type_id")
                next_action_text = next_meeting_plan_val or update_data.get("next_action") or getattr(updated_activity, "next_action", None)
                next_action_dt = update_data.get("next_action_date") or getattr(updated_activity, "next_action_date", None)
                
                chain_type = next_act_type
                if chain_type is None and update_data.get("next_action"):
                    raw_na = update_data.get("next_action")
                    if isinstance(raw_na, int):
                        chain_type = raw_na
                    elif isinstance(raw_na, str) and raw_na.isdigit():
                        chain_type = int(raw_na)
                
                if chain_type is None:
                    chain_type = getattr(updated_activity, "activity_type_id", None)

                if (next_action_dt or next_meeting_plan_val or chain_type) and (next_action_text or next_action_dt):
                    from datetime import date
                    chain_date = next_action_dt if next_action_dt else date.today()
                    chain_summary = next_meeting_plan_val or next_action_text or "Followup Plan"

                    next_activity = LeadActivityRegister(
                        activity_id=self._generate_activity_id(),
                        lead_id=updated_activity.lead_id,
                        lead_owner_id=updated_activity.lead_owner_id,
                        activity_date=chain_date,
                        activity_type_id=chain_type,
                        meeting_plan=chain_summary,
                        action_status_id=4,  # Pending status by default
                    )
                    await self.repo.create_activity(next_activity, current_user=current_user)

            return updated_activity
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update activity: {str(e)}",
            )

    async def delete_activity(self, activity_id: str, is_executive: bool = False, leader_id: Optional[str] = None, current_user: Optional[Any] = None) -> bool:
        existing = await self.get_activity_by_id(activity_id, leader_id=leader_id, is_executive=is_executive)
        user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
        user_desig = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
        is_super_admin = user_role in ["super admin", "admin"] or user_desig in ["CFO", "CEO"]
        status_name = (getattr(existing.action_status_type, "status", "") or "").strip().lower() if getattr(existing, "action_status_type", None) else ""

        # ── Completed Lock Check ────────────────────────────────────────────────────
        # Once an activity status is Completed, standard users are NOT allowed to delete it.
        if (existing.action_status_id == 2 or status_name in ["completed", "complete"]) and not is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Once an activity status is Completed, users are not allowed to delete it."
            )
        try:
            return await self.repo.delete_activity(activity_id, is_executive=is_executive)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete activity: {str(e)}",
            )

    async def delete_all_activities(self, current_user: Optional[Any] = None) -> int:
        user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
        user_desig = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
        is_super_admin = user_role in ["super admin", "admin"] or user_desig in ["CFO", "CEO"]
        if not is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admin / CFO can perform bulk delete all operations."
            )
        try:
            return await self.repo.delete_all_activities()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete all activities: {str(e)}",
            )

    async def bulk_delete_activities(self, activity_ids: List[str], current_user: Optional[Any] = None) -> int:
        str_ids = [str(i) for i in activity_ids]
        try:
            return await self.repo.bulk_delete_activities(str_ids)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to bulk delete activities: {str(e)}",
            )
