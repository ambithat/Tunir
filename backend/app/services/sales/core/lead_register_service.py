from datetime import date
from typing import List, Optional, Union, Any
from fastapi import HTTPException, status

from app.repositories.sales.lead_register_repository import LeadRegisterRepository
from app.models.sales.lead_register import LeadRegister, ProductRegister
from app.models.sales.proposal_sent import ProposalSent
from app.schemas.sales.lead_register_schema import (
    LeadRegisterCreate,
    LeadRegisterUpdate,
    ProductRegisterCreate,
    ProductRegisterUpdate,
)
from app.schemas.sales.proposal_sent_schema import ProposalSentCreate, ProposalSentResponse


class LeadRegisterService:
    """Service layer for LeadRegister and ProductRegister operations."""

    def __init__(self, repo: LeadRegisterRepository):
        self.repo = repo

    # ── LeadRegister ──────────────────────────────────────────────────────────────

    async def create_lead(self, payload: LeadRegisterCreate, current_user: Optional[object] = None) -> Union[LeadRegister, List[LeadRegister]]:
        try:
            lead = LeadRegister(
                lead_owner_id=payload.lead_owner_id,
                lead_source=payload.lead_source,
                company=payload.company,
                contact_name=payload.contact_name,
                designation=payload.designation,
                phone_no=payload.phone_no,
                email=payload.email,
                country=payload.country,
                is_active=payload.is_active,
            )
            products_data = [p.model_dump() for p in (payload.products or [])]
            proposals_data = [p.model_dump() for p in (payload.proposals or [])]
            created_leads = await self.repo.create_lead(
                lead,
                products_data,
                proposals_data=proposals_data,
                phone_no_2=payload.phone_no_2,
                region=payload.region,
                current_user=current_user
            )
            if len(created_leads) == 1:
                return created_leads[0]
            return created_leads
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create lead: {str(e)}",
            )

    async def get_lead_by_id(self, lead_id: str, leader_id: Optional[str] = None, is_executive: bool = False) -> LeadRegister:
        lead = await self.repo.get_lead_by_id(lead_id, leader_id=leader_id, is_executive=is_executive)
        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lead '{lead_id}' not found.",
            )
        return lead

    async def get_all_leads(
        self, limit: int = 50, cursor: Optional[str] = None, leader_id: Optional[str] = None, 
        is_executive: bool = False, is_active: Optional[bool] = None, search: Optional[str] = None,
        status_id: Optional[int] = None, stage_id: Optional[int] = None,
        from_date: Optional[date] = None, to_date: Optional[date] = None
    ) -> dict:
        try:
            return await self.repo.get_all_leads(
                limit=limit, cursor=cursor, leader_id=leader_id, is_executive=is_executive, 
                is_active_filter=is_active, search=search, status_id=status_id, stage_id=stage_id,
                from_date=from_date, to_date=to_date
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch leads: {str(e)}",
            )

    async def update_lead(
        self, lead_id: str, payload: LeadRegisterUpdate, leader_id: Optional[str] = None, is_executive: bool = False, current_user: Optional[object] = None
    ) -> LeadRegister:
        await self.get_lead_by_id(lead_id, leader_id=leader_id, is_executive=is_executive)
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return await self.get_lead_by_id(lead_id, leader_id=leader_id, is_executive=is_executive)
        try:
            return await self.repo.update_lead(lead_id, update_data, current_user=current_user)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update lead: {str(e)}",
            )

    async def delete_lead(self, lead_id: str, is_executive: bool = False, leader_id: Optional[str] = None, current_user: Optional[object] = None) -> bool:
        await self.get_lead_by_id(lead_id, leader_id=leader_id, is_executive=is_executive)
        try:
            return await self.repo.delete_lead(lead_id, is_executive=is_executive, current_user=current_user)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete lead: {str(e)}",
            )

    # ── ProductRegister ───────────────────────────────────────────────────────────

    async def add_product_to_lead(
        self, lead_id: int, payload: ProductRegisterCreate, leader_id: Optional[int] = None, is_executive: bool = False
    ) -> ProductRegister:
        await self.get_lead_by_id(lead_id, leader_id=leader_id, is_executive=is_executive)
        try:
            return await self.repo.create_product(
                lead_id, payload.model_dump()
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to add product: {str(e)}",
            )

    async def get_products_for_lead(self, lead_id: int, leader_id: Optional[int] = None, is_executive: bool = False) -> List[ProductRegister]:
        await self.get_lead_by_id(lead_id, leader_id=leader_id, is_executive=is_executive)
        try:
            return await self.repo.get_products_by_lead(lead_id)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch products: {str(e)}",
            )

    async def update_product(
        self, lead_id: int, product_register_id: int, payload: ProductRegisterUpdate, leader_id: Optional[int] = None, is_executive: bool = False
    ) -> ProductRegister:
        await self.get_lead_by_id(lead_id, leader_id=leader_id, is_executive=is_executive)
        product = await self.repo.get_product_by_id(product_register_id)
        if not product or product.lead_id != lead_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {product_register_id} not found for lead '{lead_id}'.",
            )
        update_data = payload.model_dump(exclude_unset=True)
        try:
            return await self.repo.update_product(
                product_register_id, update_data
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update product: {str(e)}",
            )

    async def update_product_by_id(self, product_register_id: str, update_data: dict) -> Optional[ProductRegister]:
        product = await self.repo.get_product_by_id(product_register_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product register record '{product_register_id}' not found."
            )
        try:
            return await self.repo.update_product(product_register_id, update_data)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update product proposal details: {str(e)}"
            )

    async def delete_product(self, lead_id: int, product_register_id: int, leader_id: Optional[int] = None, is_executive: bool = False) -> bool:
        await self.get_lead_by_id(lead_id, leader_id=leader_id, is_executive=is_executive)
        product = await self.repo.get_product_by_id(product_register_id)
        if not product or product.lead_id != lead_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {product_register_id} not found for lead '{lead_id}'.",
            )
        try:
            return await self.repo.delete_product(product_register_id)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete product: {str(e)}",
            )

    # ── ProposalSent Methods ──────────────────────────────────────────────────────

    async def create_proposal_for_lead(
        self, lead_id: str, payload: ProposalSentCreate, current_user: Optional[object] = None
    ) -> ProposalSent:
        payload.lead_id = lead_id
        return await self.repo.create_proposal(payload, current_user=current_user)

    async def get_proposals_for_lead(self, lead_id: str) -> List[ProposalSent]:
        return await self.repo.get_proposals_by_lead(lead_id)

    async def delete_proposal_from_lead(self, lead_id: str, proposal_sent_id: str) -> bool:
        success = await self.repo.delete_proposal(lead_id, proposal_sent_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal '{proposal_sent_id}' not found for lead '{lead_id}'."
            )
        return True

    async def delete_all_leads(self, current_user: Optional[Any] = None) -> int:
        user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
        user_desig = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
        is_super_admin = user_role in ["super admin", "admin"] or user_desig in ["CFO", "CEO"]
        if not is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admin / CFO can perform bulk delete all operations."
            )
        try:
            return await self.repo.delete_all_leads()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete all leads: {str(e)}",
            )

    async def bulk_delete_leads(self, lead_ids: List[str], current_user: Optional[Any] = None) -> int:
        str_ids = [str(i) for i in lead_ids]
        try:
            return await self.repo.bulk_delete_leads(str_ids)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to bulk delete leads: {str(e)}",
            )

    async def delete_all_proposals(self, current_user: Optional[Any] = None) -> int:
        user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
        user_desig = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
        is_super_admin = user_role in ["super admin", "admin"] or user_desig in ["CFO", "CEO"]
        if not is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admin / CFO can perform bulk delete all operations."
            )
        try:
            return await self.repo.delete_all_proposals()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete all proposals: {str(e)}",
            )

    async def bulk_delete_proposals(self, proposal_ids: List[str], current_user: Optional[Any] = None) -> int:
        str_ids = [str(i) for i in proposal_ids]
        try:
            return await self.repo.bulk_delete_proposals(str_ids)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to bulk delete proposals: {str(e)}",
            )

    async def delete_all_products(self, current_user: Optional[Any] = None) -> int:
        user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
        user_desig = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
        is_super_admin = user_role in ["super admin", "admin"] or user_desig in ["CFO", "CEO"]
        if not is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admin / CFO can perform bulk delete all operations."
            )
        try:
            return await self.repo.delete_all_products()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete all products: {str(e)}",
            )

    async def bulk_delete_products(self, product_ids: List[str], current_user: Optional[Any] = None) -> int:
        str_ids = [str(i) for i in product_ids]
        try:
            return await self.repo.bulk_delete_products(str_ids)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to bulk delete products: {str(e)}",
            )

    async def get_leads_dropdown(self, leader_id: Optional[str] = None, is_executive: bool = False) -> List[LeadRegister]:
        """Fetch active leads for dropdown menu selection."""
        try:
            return await self.repo.get_leads_dropdown(leader_id=leader_id, is_executive=is_executive)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch leads dropdown: {str(e)}",
            )
