from pydantic import BaseModel
from typing import List, Optional

# LeaderStageStatusType Schemas
class LeaderStageStatusTypeBase(BaseModel):
    leader_stage: str

class LeaderStageStatusTypeCreate(LeaderStageStatusTypeBase):
    pass

class LeaderStageStatusTypeUpdate(LeaderStageStatusTypeBase):
    pass

class LeaderStageStatusTypeResponse(LeaderStageStatusTypeBase):
    id: int
    class Config:
        from_attributes = True

class LeaderStageStatusTypeDropdown(BaseModel):
    id: int
    leader_stage: str
    class Config:
        from_attributes = True

# ActivityTypeStatusType Schemas
class ActivityTypeStatusTypeBase(BaseModel):
    activity_type: str

class ActivityTypeStatusTypeCreate(ActivityTypeStatusTypeBase):
    pass

class ActivityTypeStatusTypeUpdate(ActivityTypeStatusTypeBase):
    pass

class ActivityTypeStatusTypeResponse(ActivityTypeStatusTypeBase):
    id: int
    class Config:
        from_attributes = True

class ActivityTypeStatusTypeDropdown(BaseModel):
    id: int
    activity_type: str
    class Config:
        from_attributes = True

# ProductStatusType Schemas
class ProductStatusTypeBase(BaseModel):
    product: str

class ProductStatusTypeCreate(ProductStatusTypeBase):
    pass

class ProductStatusTypeUpdate(ProductStatusTypeBase):
    pass

class ProductStatusTypeResponse(ProductStatusTypeBase):
    id: int
    class Config:
        from_attributes = True

class ProductStatusTypeDropdown(BaseModel):
    id: int
    product: str
    class Config:
        from_attributes = True

# LeadProductStatusType Schemas
class LeadProductStatusTypeBase(BaseModel):
    status: str

class LeadProductStatusTypeCreate(LeadProductStatusTypeBase):
    pass

class LeadProductStatusTypeUpdate(LeadProductStatusTypeBase):
    pass

class LeadProductStatusTypeResponse(LeadProductStatusTypeBase):
    id: int
    class Config:
        from_attributes = True

class LeadProductStatusTypeDropdown(BaseModel):
    id: int
    status: str
    class Config:
        from_attributes = True

# DailyActivityOutcomeStatusType Schemas
class DailyActivityOutcomeStatusTypeBase(BaseModel):
    outcome: str

class DailyActivityOutcomeStatusTypeCreate(DailyActivityOutcomeStatusTypeBase):
    pass

class DailyActivityOutcomeStatusTypeUpdate(DailyActivityOutcomeStatusTypeBase):
    pass

class DailyActivityOutcomeStatusTypeResponse(DailyActivityOutcomeStatusTypeBase):
    id: int
    class Config:
        from_attributes = True

class DailyActivityOutcomeStatusTypeDropdown(BaseModel):
    id: int
    outcome: str
    class Config:
        from_attributes = True

# DailyActivityStatusType Schemas
class DailyActivityStatusTypeBase(BaseModel):
    action_status: str

class DailyActivityStatusTypeCreate(DailyActivityStatusTypeBase):
    pass

class DailyActivityStatusTypeUpdate(DailyActivityStatusTypeBase):
    pass

class DailyActivityStatusTypeResponse(DailyActivityStatusTypeBase):
    id: int
    class Config:
        from_attributes = True

class DailyActivityStatusTypeDropdown(BaseModel):
    id: int
    action_status: str
    class Config:
        from_attributes = True

