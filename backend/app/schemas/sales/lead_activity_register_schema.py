from pydantic import BaseModel, Field, AliasChoices
from typing import Optional, List
from datetime import datetime, date
from app.schemas.sales.lead_register_schema import ProductRegisterResponse


class LeadRegisterMiniResponse(BaseModel):
    lead_id: str
    company: str
    contact_name: Optional[str] = None
    designation: Optional[str] = None
    phone_no: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    lead_source: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class LeadActivityRegisterCreate(BaseModel):
    lead_owner_id: Optional[str] = None
    activity_date: date
    activity_type_id: Optional[int] = None
    meeting_plan: Optional[str] = Field(None, validation_alias=AliasChoices('meeting_plan', 'summary'))
    meeting_action_remarks: Optional[str] = None
    next_action: Optional[str] = None
    next_action_date: Optional[date] = None
    next_action_type_id: Optional[int] = Field(None, validation_alias=AliasChoices('next_action_type_id', 'next_action_type', 'next_activity_type'))
    next_meeting_plan: Optional[str] = Field(None, validation_alias=AliasChoices('next_meeting_plan', 'next_summary', 'next_plan'))
    outcome_id: Optional[int] = None
    action_status_id: Optional[int] = Field(4, description="Defaults to 4 (Pending)")
    overdue_reason: Optional[str] = None

    @property
    def summary(self) -> Optional[str]:
        return self.meeting_plan

    class Config:
        populate_by_name = True


class LeadActivityRegisterResponse(BaseModel):
    activity_id: str
    lead_id: str
    lead_no: Optional[int] = None
    lead_owner_id: Optional[str] = None
    lead_owner_name: Optional[str] = None
    company: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_designation: Optional[str] = None
    country: Optional[str] = None
    lead_source: Optional[str] = None
    activity_date: date
    activity_type_id: Optional[int] = None
    activity_type_name: Optional[str] = None
    meeting_plan: Optional[str] = None
    meeting_action_remarks: Optional[str] = None
    next_meeting_plan: Optional[str] = None
    next_action: Optional[str] = None
    next_action_date: Optional[date] = None
    next_action_type_id: Optional[int] = None
    next_action_type_name: Optional[str] = None
    outcome_id: Optional[int] = None
    outcome_name: Optional[str] = None
    action_status_id: Optional[int] = None
    action_status_name: Optional[str] = None
    overdue_reason: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    lead: Optional[LeadRegisterMiniResponse] = None
    products: List[ProductRegisterResponse] = []

    @property
    def summary(self) -> Optional[str]:
        return self.meeting_plan

    class Config:
        from_attributes = True


class LeadActivityRegisterUpdate(BaseModel):
    lead_owner_id: Optional[str] = None
    activity_date: Optional[date] = None
    activity_type_id: Optional[int] = None
    meeting_plan: Optional[str] = Field(None, validation_alias=AliasChoices('meeting_plan', 'summary'))
    meeting_action_remarks: Optional[str] = None
    next_action: Optional[str] = None
    next_action_date: Optional[date] = None
    next_action_type_id: Optional[int] = Field(None, validation_alias=AliasChoices('next_action_type_id', 'next_action_type', 'next_activity_type'))
    next_meeting_plan: Optional[str] = Field(None, validation_alias=AliasChoices('next_meeting_plan', 'next_summary', 'next_plan'))
    outcome_id: Optional[int] = None
    action_status_id: Optional[int] = None
    overdue_reason: Optional[str] = None
    is_active: Optional[bool] = None

    @property
    def summary(self) -> Optional[str]:
        return self.meeting_plan

    class Config:
        populate_by_name = True
