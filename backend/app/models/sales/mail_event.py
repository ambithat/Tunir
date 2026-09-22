from typing import Optional, Any
from datetime import datetime
from sqlalchemy import Integer, String, Text, JSON, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MailEvent(Base):
    """
    Outbox table for queuing and retrying email and calendar event dispatches.
    Stored under sales schema in PostgreSQL (sales.mail_events).
    """
    __tablename__ = "mail_events"
    __table_args__ = {"schema": "sales"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "send_email" or "create_calendar_event"
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    response_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), server_default="pending", default="pending")  # pending -> processing -> done / failed / dead_letter
    retry_count: Mapped[int] = mapped_column(Integer, server_default="0", default=0)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, onupdate=func.now())
