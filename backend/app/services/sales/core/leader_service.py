from fastapi import HTTPException, status
from typing import Optional, List, Any

from app.repositories.sales.leader_repository import LeaderRepository
from app.schemas.sales.leader_schema import LeaderCreateSchema, LeaderUpdateSchema
from app.models.sales.leader import Leader


class LeaderService:
    """Service layer for leader operations."""

    def __init__(self, leader_repository: LeaderRepository):
        self.repo = leader_repository

    async def create_leader(self, payload: LeaderCreateSchema) -> Leader:
        existing_emp = await self.repo.get_leader_by_emp_id(payload.emp_id)
        if existing_emp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Leader with emp_id '{payload.emp_id}' already exists.",
            )

        existing_email = await self.repo.get_leader_by_email(payload.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Leader with email '{payload.email}' already exists.",
            )

        leader = Leader(
            emp_id=payload.emp_id,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            password=payload.password,
            designation=payload.designation,
            role=payload.role or "user",
            is_active=payload.is_active,
        )
        return await self.repo.create_leader(leader)

    async def get_leader_by_id(self, leader_id: str) -> Leader:
        leader = await self.repo.get_leader_by_id(leader_id)
        if not leader:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Leader with ID {leader_id} not found.",
            )
        return leader

    async def get_all_leaders(
        self, limit: int = 50, cursor: Optional[str] = None, search: Optional[str] = None, is_active: Optional[bool] = None
    ) -> dict:
        return await self.repo.get_all_leaders(limit=limit, cursor=cursor, search=search, is_active=is_active)

    async def get_leaders_dropdown(self):
        return await self.repo.get_leaders_dropdown()

    async def update_leader(self, leader_id: str, payload: LeaderUpdateSchema) -> Leader:
        await self.get_leader_by_id(leader_id)
        update_data = payload.model_dump(exclude_unset=True)

        if "email" in update_data:
            existing_email = await self.repo.get_leader_by_email(update_data["email"])
            if existing_email and existing_email.leader_id != leader_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Leader with email '{update_data['email']}' already exists.",
                )

        updated_leader = await self.repo.update_leader(leader_id, update_data)
        return updated_leader

    async def delete_leader(self, leader_id: str) -> bool:
        await self.get_leader_by_id(leader_id)
        return await self.repo.delete_leader(leader_id)

    async def offboard_and_reassign_leader(
        self, source_leader_id: str, target_leader_id: str, reassigned_by: Optional[str] = None, deactivate_source: bool = False
    ) -> dict:
        if source_leader_id == target_leader_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target replacement leader must be a different leader.",
            )

        source_leader = await self.get_leader_by_id(source_leader_id)
        target_leader = await self.get_leader_by_id(target_leader_id)

        if not target_leader.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target leader '{target_leader_id}' ({target_leader.full_name}) is inactive and cannot accept reassigned leads.",
            )

        stats = await self.repo.offboard_and_reassign_leader(
            source_leader_id=source_leader_id,
            target_leader_id=target_leader_id,
            reassigned_by=reassigned_by,
            deactivate_source=deactivate_source
        )

        status_msg = "deactivated" if deactivate_source else "reassigned"
        return {
            "message": f"Workload from leader '{source_leader_id}' ({source_leader.full_name}) reassigned successfully.",
            "departing_leader_id": source_leader_id,
            "target_replacement_leader_id": target_leader_id,
            "reassigned_leads_count": stats["reassigned_leads"],
            "reassigned_activities_count": stats["reassigned_activities"],
            "status": status_msg,
        }

    async def get_reassignment_history(self, limit: int = 50, offset: int = 0) -> List[Any]:
        return await self.repo.get_reassignment_history(limit=limit, offset=offset)

    async def get_user_role(self, employee_id: str) -> str:
        leader = await self.repo.get_leader_by_emp_id(employee_id)
        return (getattr(leader, "role", "user") or "user") if leader else "user"

    async def get_user_profile_by_id(self, employee_id: str) -> dict:
        leader = await self.repo.get_leader_by_emp_id(employee_id)
        full_name = leader.full_name if leader else "User"
        leader_id = leader.leader_id if leader else None
        return {"user_data": {"first_name": full_name, "leader_id": leader_id}}

    async def login_leader_by_email(
        self,
        email: str,
        password: str,
        client_host: str,
        device_info: str,
    ):
        leader = await self.repo.get_leader_by_email(email)
        if not leader:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not leader.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Leader account is inactive",
            )

        # Verify password using PostgreSQL crypt() function (with fallback to plain comparison)
        is_valid_pw = await self.repo.verify_password(password, leader.password)
        if not is_valid_pw and leader.password != password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        from app.security.token_utils import create_access_token, create_refresh_token

        role_value = getattr(leader, "role", "user") or "user"
        access_token = create_access_token(
            employee_id=leader.emp_id,
            role=role_value,
            name=leader.full_name,
            leader_id=leader.leader_id
        )
        refresh_token, refresh_token_hash, refresh_token_expiry = create_refresh_token()

        leader_result = {
            "access_token": access_token,
            "token_type": "bearer",
            "emp_id": leader.emp_id,
            "leader_id": leader.leader_id,
            "email": leader.email,
            "full_name": leader.full_name,
            "designation": leader.designation,
            "role": getattr(leader, "role", "user") or "user",
        }

        return (
            leader.emp_id,
            refresh_token,
            refresh_token_hash,
            refresh_token_expiry,
            device_info,
            client_host,
            leader_result,
        )

    async def delete_leader(self, leader_id: int) -> bool:
        await self.get_leader_by_id(leader_id)
        return await self.repo.delete_leader(leader_id)

    async def get_user_role(self, employee_id: str) -> str:
        leader = await self.repo.get_leader_by_emp_id(employee_id)
        return (getattr(leader, "role", "user") or "user") if leader else "user"

    async def get_user_profile_by_id(self, employee_id: str) -> dict:
        leader = await self.repo.get_leader_by_emp_id(employee_id)
        full_name = leader.full_name if leader else "User"
        leader_id = leader.leader_id if leader else None
        return {"user_data": {"first_name": full_name, "leader_id": leader_id}}

    # ── LeaderReassignmentHistory CRUD ───────────────────────────────────────────

    async def create_reassignment_history(self, payload: Any) -> dict:
        try:
            history_data = payload.model_dump(exclude_unset=True)
            entry = await self.repo.create_reassignment_history(history_data)
            ret = await self.repo.get_reassignment_history_by_id(entry.id)
            return ret or {}
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create reassignment history: {str(e)}"
            )

    async def get_reassignment_history_by_id(self, history_id: int) -> dict:
        entry = await self.repo.get_reassignment_history_by_id(history_id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reassignment history record with ID {history_id} not found."
            )
        return entry

    async def update_reassignment_history(self, history_id: int, payload: Any) -> dict:
        await self.get_reassignment_history_by_id(history_id)
        update_data = payload.model_dump(exclude_unset=True)
        try:
            updated = await self.repo.update_reassignment_history(history_id, update_data)
            return updated or {}
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update reassignment history: {str(e)}"
            )

    async def delete_reassignment_history(self, history_id: int) -> bool:
        await self.get_reassignment_history_by_id(history_id)
        try:
            return await self.repo.delete_reassignment_history(history_id)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete reassignment history: {str(e)}"
            )

    async def reassign_products_granularly(
        self,
        source_leader_id: Optional[str] = None,
        product_assignments: Optional[list] = None,
        default_target_leader_id: Optional[str] = None,
        reassigned_by: Optional[str] = None,
        deactivate_source: bool = False,
        payload: Optional[Any] = None,
    ) -> dict:
        if payload is not None:
            source_leader_id = source_leader_id or getattr(payload, "source_leader_id", None)
            raw_assigns = getattr(payload, "product_assignments", [])
            product_assignments = product_assignments or [item.model_dump() if hasattr(item, "model_dump") else item for item in raw_assigns]
            default_target_leader_id = default_target_leader_id or getattr(payload, "default_target_leader_id", None)
            deactivate_source = deactivate_source or getattr(payload, "deactivate_source", False)

        if not source_leader_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="source_leader_id is required for product reassignment."
            )

        source_leader = await self.repo.get_leader_by_id(source_leader_id)
        if not source_leader:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source leader '{source_leader_id}' not found."
            )

        if default_target_leader_id:
            target_leader = await self.repo.get_leader_by_id(default_target_leader_id)
            if not target_leader:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Fallback target leader '{default_target_leader_id}' not found."
                )

        assignments_list = []
        for item in (product_assignments or []):
            if hasattr(item, "model_dump"):
                assignments_list.append(item.model_dump())
            elif isinstance(item, dict):
                assignments_list.append(item)

        res = await self.repo.reassign_products_granularly(
            source_leader_id=source_leader_id,
            product_assignments=assignments_list,
            default_target_leader_id=default_target_leader_id,
            reassigned_by=reassigned_by,
            deactivate_source=deactivate_source
        )

        return {
            "message": f"Successfully reassigned {res['reassigned_products']} product(s), {res['reassigned_leads']} lead(s), and {res['reassigned_activities']} activity(ies).",
            "source_leader_id": source_leader_id,
            "reassigned_products_count": res["reassigned_products"],
            "reassigned_leads_count": res["reassigned_leads"],
            "reassigned_activities_count": res["reassigned_activities"],
            "status": "success"
        }

    async def get_leader_products(self, leader_id: str) -> list[dict]:
        leader = await self.repo.get_leader_by_id(leader_id)
        if not leader:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Leader '{leader_id}' not found."
            )
        return await self.repo.get_leader_products(leader_id)

    async def delete_all_leaders(self, current_user: Optional[Any] = None) -> int:
        user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
        user_desig = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
        is_super_admin = user_role in ["super admin", "admin"] or user_desig in ["CFO", "CEO"]
        if not is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admin / CFO can perform bulk delete all operations."
            )
        try:
            return await self.repo.delete_all_leaders()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete all leaders: {str(e)}",
            )

    async def bulk_delete_leaders(self, leader_ids: list[str], current_user: Optional[Any] = None) -> int:
        str_ids = [str(i) for i in leader_ids]
        try:
            return await self.repo.bulk_delete_leaders(str_ids)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to bulk delete leaders: {str(e)}",
            )

