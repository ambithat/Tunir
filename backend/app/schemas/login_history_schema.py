from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List

class LoginSchema(BaseModel):
    email: str
    password: str

class LoginHistorySchema(BaseModel):
    id: Optional[int] = None
    user_id: Optional[str] = None
    email_attempted: Optional[str] = None
    timestamp: Optional[datetime] = None
    logout_timestamp: Optional[datetime] = None
    logout_reason: Optional[str] = None
    failure_reason: Optional[str] = None
    ip_address: Optional[str] = None
    device_info: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    status: Optional[str] = None
    active_seconds: int = 0
    last_active_at: Optional[datetime] = None
    session_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class LoginHistoryDataDTO(BaseModel):
    id: int
    user_id: Optional[str] = None
    email: Optional[str] = None
    email_attempted: Optional[str] = None
    timestamp: datetime
    logout_timestamp: Optional[datetime] = None
    logout_reason: Optional[str] = None
    failure_reason: Optional[str] = None
    ip_address: Optional[str] = None
    device_info: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    status: str
    active_seconds: int = 0
    last_active_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class HeartbeatRequest(BaseModel):
    user_id: Optional[str] = None
    token: Optional[str] = None
    active_seconds: int = 30  # Seconds since last heartbeat ping
    session_id: Optional[str] = None
    action: Optional[str] = None  # 'heartbeat' or 'tab_closed'

class DeviceScreenTimeDTO(BaseModel):
    device_info: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    total_active_seconds: int
    human_readable_duration: str

class ScreenTimeSummaryResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    date: str
    total_active_seconds: int
    human_readable_duration: str
    first_login_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    session_count: int
    device_breakdown: List[DeviceScreenTimeDTO] = []

    model_config = ConfigDict(from_attributes=True)