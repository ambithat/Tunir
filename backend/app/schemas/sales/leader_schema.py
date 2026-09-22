from enum import Enum
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime


class LeaderRole(str, Enum):
    SUPER_ADMIN = "super admin"
    ADMIN = "admin"
    USER = "user"


class LeaderCreateSchema(BaseModel):
    emp_id: str = Field(..., description="Unique employee identifier")
    first_name: str = Field(..., min_length=1)
    last_name: Optional[str] = None
    email: EmailStr
    password: str = Field(..., min_length=6)
    designation: Optional[str] = None
    role: str = Field("user", description="Role option: 'super admin', 'admin', or 'user'")
    is_active: bool = True

    @field_validator("role", mode="before")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> str:
        if not v:
            return "user"
        v_clean = str(v).strip().lower().replace("_", " ")
        if v_clean not in ["super admin", "admin", "user"]:
            raise ValueError("role must be one of: 'super admin', 'admin', 'user'")
        return v_clean


class LeaderUpdateSchema(BaseModel):
    emp_id: Optional[str] = Field(None, description="Employee identifier")
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    designation: Optional[str] = None
    role: Optional[str] = Field(None, description="Role option: 'super admin', 'admin', or 'user'")
    is_active: Optional[bool] = None

    @field_validator("role", mode="before")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v_clean = str(v).strip().lower().replace("_", " ")
        if v_clean not in ["super admin", "admin", "user"]:
            raise ValueError("role must be one of: 'super admin', 'admin', 'user'")
        return v_clean


class LeaderResponseSchema(BaseModel):
    leader_id: str
    emp_id: str
    first_name: str
    last_name: Optional[str] = None
    full_name: str
    email: str
    designation: Optional[str] = None
    role: str = "user"
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeaderDropdownSchema(BaseModel):
    leader_id: str
    emp_id: str
    full_name: str
    email: Optional[str] = None
    designation: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class LeaderOffboardSchema(BaseModel):
    target_leader_id: str = Field(..., description="Leader ID to receive all reassigned leads and activities")


class LeaderOffboardResponseSchema(BaseModel):
    message: str
    departing_leader_id: str
    target_replacement_leader_id: str
    reassigned_leads_count: int
    reassigned_activities_count: int
    status: str


class LeaderReassignSchema(BaseModel):
    source_leader_id: str = Field(..., description="Source Leader ID (active or inactive) whose leads and activities will be reassigned")
    target_leader_id: str = Field(..., description="Target active Leader ID to receive the reassigned leads and activities")


class LeaderReassignmentHistoryCreateSchema(BaseModel):
    source_leader_id: str = Field(..., description="Source leader emp_id")
    target_leader_id: str = Field(..., description="Target leader emp_id")
    reassigned_by: Optional[str] = Field(None, description="Reassigned by leader emp_id")
    reassigned_products_count: int = Field(0, ge=0)
    reassigned_leads_count: int = Field(0, ge=0)
    reassigned_activities_count: int = Field(0, ge=0)


class LeaderReassignmentHistoryUpdateSchema(BaseModel):
    source_leader_id: Optional[str] = None
    target_leader_id: Optional[str] = None
    reassigned_by: Optional[str] = None
    reassigned_products_count: Optional[int] = Field(None, ge=0)
    reassigned_leads_count: Optional[int] = Field(None, ge=0)
    reassigned_activities_count: Optional[int] = Field(None, ge=0)


class LeaderReassignmentHistoryResponseSchema(BaseModel):
    id: int
    source_leader_id: str
    source_leader_name: Optional[str] = None
    target_leader_id: str
    target_leader_name: Optional[str] = None
    reassigned_by: Optional[str] = None
    reassigned_by_name: Optional[str] = None
    reassigned_products_count: int = 0
    reassigned_leads_count: int = 0
    reassigned_activities_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class ProductAssignmentItem(BaseModel):
    product_register_id: str = Field(..., description="Product Register ID (e.g. PRD-0001)")
    target_leader_id: str = Field(..., description="Target leader ID to receive ownership of this product")


class GranularProductReassignmentSchema(BaseModel):
    source_leader_id: str = Field(..., description="Source Leader ID whose products are being reassigned")
    deactivate_source: bool = Field(False, description="Optionally deactivate source leader account")
    product_assignments: list[ProductAssignmentItem] = Field(default_factory=list, description="Specific product-to-leader assignment list")
    default_target_leader_id: Optional[str] = Field(None, description="Fallback target leader for any unassigned products or leads owned by source leader")


class GranularProductReassignmentResponseSchema(BaseModel):
    message: str
    source_leader_id: str
    reassigned_products_count: int
    reassigned_leads_count: int
    reassigned_activities_count: int
    status: str

