from pydantic import BaseModel, Field, AliasChoices
from typing import Optional
from datetime import datetime, date


class WeeklyPdfRegisterCreate(BaseModel):
    report_date: Optional[date] = None
    pdf_url: str
    filename: Optional[str] = None
    file_size_bytes: Optional[int] = None

    class Config:
        populate_by_name = True


class WeeklyPdfRegisterResponse(BaseModel):
    weekly_pdf_id: str = Field(..., validation_alias=AliasChoices('weekly_pdf_id', 'id'))
    report_date: date = Field(..., validation_alias=AliasChoices('report_date', 'date'))
    pdf_url: str = Field(..., validation_alias=AliasChoices('pdf_url', 'url'))
    filename: Optional[str] = None
    file_size_bytes: Optional[int] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True
