from fastapi import HTTPException, status
from typing import Optional, Any, List

from app.repositories.sales.contact_repository import ContactRepository
from app.schemas.sales.contact_schema import ContactCreateSchema, ContactUpdateSchema
from app.models.sales.contact import Contact


class ContactService:
    """Service layer for contact operations."""

    def __init__(self, contact_repository: ContactRepository):
        self.repo = contact_repository

    async def create_contact(self, payload: ContactCreateSchema) -> Contact:
        existing_email = await self.repo.get_contact_by_email(payload.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Contact with email '{payload.email}' already exists.",
            )

        contact = Contact(
            created_by=payload.created_by,
            company=payload.company,
            contact_name=payload.contact_name,
            designation=payload.designation,
            phone_no_1=payload.phone_no_1,
            phone_no_2=payload.phone_no_2,
            email=payload.email,
            country=payload.country,
            region=payload.region,
            is_active=payload.is_active,
        )
        return await self.repo.create_contact(contact)

    async def get_contact_by_id(self, contact_id: str, is_executive: bool = False) -> Contact:
        contact = await self.repo.get_contact_by_id(contact_id, is_executive=is_executive)
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contact with ID {contact_id} not found.",
            )
        return contact

    async def get_all_contacts(
        self, limit: int = 50, cursor: Optional[str] = None, leader_id: Optional[str] = None, is_executive: bool = False, is_active_filter: Optional[bool] = None, is_active: Optional[bool] = None, search: Optional[str] = None
    ) -> dict:
        active_val = is_active_filter if is_active_filter is not None else is_active
        return await self.repo.get_all_contacts(limit=limit, cursor=cursor, leader_id=leader_id, is_executive=is_executive, is_active_filter=active_val, search=search)

    async def get_contacts_dropdown(self, leader_id: Optional[str] = None, is_executive: bool = False):
        return await self.repo.get_contacts_dropdown(leader_id=leader_id, is_executive=is_executive)

    async def update_contact(self, contact_id: str, payload: ContactUpdateSchema, is_executive: bool = False) -> Contact:
        await self.get_contact_by_id(contact_id, is_executive=is_executive)
        update_data = payload.model_dump(exclude_unset=True)

        if "email" in update_data and update_data["email"] is not None:
            existing_email = await self.repo.get_contact_by_email(update_data["email"])
            if existing_email and existing_email.contact_id != contact_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Contact with email '{update_data['email']}' already exists.",
                )

        updated_contact = await self.repo.update_contact(contact_id, update_data)
        return updated_contact

    async def delete_contact(self, contact_id: str, is_executive: bool = False) -> bool:
        await self.get_contact_by_id(contact_id, is_executive=is_executive)
        return await self.repo.delete_contact(contact_id, is_executive=is_executive)

    async def delete_all_contacts(self, current_user: Optional[Any] = None) -> int:
        user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
        user_desig = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
        is_super_admin = user_role in ["super admin", "admin"] or user_desig in ["CFO", "CEO"]
        if not is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admin / CFO can perform bulk delete all operations."
            )
        try:
            return await self.repo.delete_all_contacts()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete all contacts: {str(e)}",
            )

    async def bulk_delete_contacts(self, contact_ids: List[Any], current_user: Optional[Any] = None) -> int:
        try:
            return await self.repo.bulk_delete_contacts(contact_ids)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to bulk delete contacts: {str(e)}",
            )
