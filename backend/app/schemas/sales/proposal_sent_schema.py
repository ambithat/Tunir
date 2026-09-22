from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ProposalSentCreate(BaseModel):
    lead_id: str
    url: str
    remarks: Optional[str] = None
    proposal_type: Optional[str] = None
    created_by: Optional[str] = None


class ProposalSentUpdate(BaseModel):
    url: Optional[str] = None
    remarks: Optional[str] = None
    proposal_type: Optional[str] = None


class ProposalSentResponse(BaseModel):
    proposal_sent_id: str
    lead_id: str
    url: str
    remarks: Optional[str] = None
    proposal_type: Optional[str] = None
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
