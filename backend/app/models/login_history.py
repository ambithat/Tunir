import enum
from typing import List, Optional
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import (Integer, text, String, Boolean, Text,
                        Column, Enum, ForeignKey, Index, DateTime, Identity, func)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

class LoginStatus(enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    ERROR = "ERROR"
    REVOKED = "REVOKED"
    LOGOUT = "LOGOUT"

class LoginHistory(Base):
    __tablename__ = "login_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Text,  # emp_id (str)
        ForeignKey("sales.leaders.emp_id", ondelete="CASCADE"), 
        nullable=True,
        index=True
    )
    leader = relationship("Leader", back_populates="login_history")
    email_attempted = Column(String(255), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Kolkata")), server_default=func.now())
    logout_timestamp = Column(DateTime(timezone=True), nullable=True)
    logout_reason = Column(String(50), nullable=True)  # EXPLICIT_LOGOUT, TAB_CLOSED, DEVICE_LIMIT, TOKEN_EXPIRED
    failure_reason = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True, default="127.0.0.1")
    device_info: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    browser = Column(String(100), nullable=True)
    os = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="SUCCESS")
    active_seconds = Column(Integer, nullable=False, default=0)
    last_active_at = Column(DateTime(timezone=True), nullable=True)
    session_id = Column(String(255), nullable=True, index=True)

    __table_args__ = (
        Index("idx_login_history_id", "id"),
        Index("idx_login_history_user_id", "user_id"),
        Index("idx_login_history_timestamp", "timestamp"),
        Index("idx_login_history_session_id", "session_id"),
        {"schema": "auth_user"}
    )