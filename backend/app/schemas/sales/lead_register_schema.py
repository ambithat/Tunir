from pydantic import BaseModel, Field, AliasChoices
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal

from app.schemas.sales.proposal_sent_schema import ProposalSentCreate, ProposalSentResponse


# ─── ProductRegister Schemas ────────────────────────────────────────────────────

class ProductRegisterCreate(BaseModel):
    product_id: Optional[int] = None
    quantity: int = Field(1, ge=1)
    status_id: Optional[int] = None
    stage_id: Optional[int] = None
    project_value: Optional[float] = Field(None, ge=0, le=9999999999999.99)
    expected_closure: Optional[date] = Field(None, validation_alias=AliasChoices('expected_closure', 'closure_date', 'expected_closure_date'))
    lost_reason: Optional[str] = None
    is_active: bool = True

    class Config:
        populate_by_name = True

class ProductRegisterResponse(BaseModel):
    product_register_id: str
    lead_id: str
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    quantity: int
    status_id: Optional[int] = None
    status_name: Optional[str] = None
    stage_id: Optional[int] = None
    stage_name: Optional[str] = None
    probability: Optional[float] = None
    won: Optional[float] = 0.0
    project_value: Optional[float] = None
    expected_closure: Optional[date] = None
    pipeline: Optional[float] = None
    risk_matrix: Optional[str] = None
    lost_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool

    class Config:
        from_attributes = True

class ProductRegisterUpdate(BaseModel):
    product_register_id: Optional[str] = None
    product_id: Optional[int] = None
    quantity: Optional[int] = None
    status_id: Optional[int] = None
    stage_id: Optional[int] = None
    project_value: Optional[float] = Field(None, ge=0, le=9999999999999.99)
    expected_closure: Optional[date] = Field(None, validation_alias=AliasChoices('expected_closure', 'closure_date', 'expected_closure_date'))
    lost_reason: Optional[str] = None
    is_active: Optional[bool] = None

    class Config:
        populate_by_name = True


# ─── LeadRegister Schemas ────────────────────────────────────────────────────────

class LeadRegisterCreate(BaseModel):
    lead_owner_id: Optional[str] = None
    lead_source: Optional[str] = None
    company: str
    contact_name: Optional[str] = None
    designation: Optional[str] = None
    phone_no: Optional[str] = None
    phone_no_2: Optional[str] = Field(None, validation_alias=AliasChoices('phone_no2', 'phone_no_2', 'secondary_phone_no'))
    email: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    is_active: bool = True
    products: Optional[List[ProductRegisterCreate]] = None
    proposals: Optional[List[ProposalSentCreate]] = None

    class Config:
        populate_by_name = True

class LeadRegisterResponse(BaseModel):
    lead_id: str
    created_date: datetime
    updated_at: Optional[datetime] = None
    lead_owner_id: Optional[str] = None
    lead_owner_name: Optional[str] = None
    lead_source: Optional[str] = None
    company: str
    contact_name: Optional[str] = None
    designation: Optional[str] = None
    phone_no: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    is_active: bool
    products: List[ProductRegisterResponse] = []
    proposals: List[ProposalSentResponse] = []

    class Config:
        from_attributes = True

class LeadRegisterUpdate(BaseModel):
    lead_owner_id: Optional[str] = None
    lead_source: Optional[str] = None
    company: Optional[str] = None
    contact_name: Optional[str] = None
    designation: Optional[str] = None
    phone_no: Optional[str] = None
    phone_no_2: Optional[str] = Field(None, validation_alias=AliasChoices('phone_no2', 'phone_no_2', 'secondary_phone_no'))
    email: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    is_active: Optional[bool] = None
    products: Optional[List[ProductRegisterUpdate]] = None
    proposals: Optional[List[ProposalSentCreate]] = None

    class Config:
        populate_by_name = True


class LeadDropdownSchema(BaseModel):
    lead_id: str
    company: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    lead_owner_id: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True
        populate_by_name = True
