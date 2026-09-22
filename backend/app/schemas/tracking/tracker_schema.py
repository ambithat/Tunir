from pydantic import BaseModel, ConfigDict,Field
import uuid
from datetime import datetime

from typing import  List, Dict, Any, Union,Optional

class TrackerCreateSchema(BaseModel):
    raised_by: Optional[str] = None
    current_approver: Optional[str] = None
    current_level: Optional[int] = None
    id: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None



class TrackerModel(BaseModel):
    raised_by: str
    information: dict

class TrackerDTO(BaseModel):
    tracker_id: str
    raised_by: str
    raised_by_name: str
    current_approver: Optional[str] = None
    current_approver_name: Optional[str] = None
    current_level: int | None = None
    id: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TrackerHistoryCreateSchema(BaseModel):
    tracker_id: str
    action_by: Optional[str] = None
    action: str
    remarks: Optional[str] = None

class TrackerHistoryModel(BaseModel):
    tracker_id: str
    action_by: Optional[str] = None
    action: str
    remarks: Optional[str] = None

class RequestRaiseModel(BaseModel):
    remarks:str | None = None
    payload_data: Union[Dict[str, Any], List[Dict[str, Any]]]

class ApproveRaiseModel(BaseModel):
    remarks:Optional[str] = None
    tracker_id: str

class RejectRaiseModel(BaseModel):
    remarks:Optional[str] = None
    tracker_id: str

class TrackerHistoryDTO(BaseModel):
    action_by: Optional[str] = None
    action_by_name: str
    action: str
    remarks: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class TrackerFullResponse(TrackerDTO):
    history: List[TrackerHistoryDTO]