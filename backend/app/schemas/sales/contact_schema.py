from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class ContactCreateSchema(BaseModel):
    created_by: Optional[str] = None
    company: str = Field(..., description="Company name")
    contact_name: str = Field(..., description="Name of the contact person")
    designation: Optional[str] = None
    phone_no_1: str = Field(...)
    phone_no_2: Optional[str] = None
    email: EmailStr
    country: Optional[str] = None
    region: Optional[str] = None
    is_active: bool = True


class ContactUpdateSchema(BaseModel):
    created_by: Optional[str] = None
    company: Optional[str] = None
    contact_name: Optional[str] = None
    designation: Optional[str] = None
    phone_no_1: Optional[str] = None
    phone_no_2: Optional[str] = None
    email: Optional[EmailStr] = None
    country: Optional[str] = None
    region: Optional[str] = None
    is_active: Optional[bool] = None


class ContactResponseSchema(BaseModel):
    contact_id: str
    created_by: Optional[str] = None
    company: str
    contact_name: str
    designation: Optional[str] = None
    phone_no_1: str
    phone_no_2: Optional[str] = None
    email: str
    country: Optional[str] = None
    region: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContactDropdownSchema(BaseModel):
    contact_id: str
    created_by: Optional[str] = None
    contact_name: str
    company: str
    designation: Optional[str] = None
    phone_no_1: Optional[str] = None
    phone_no_2: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None

    class Config:
        from_attributes = True
