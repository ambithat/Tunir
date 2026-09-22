from datetime import datetime
from typing import Optional
from sqlalchemy import Text, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class EmailEnv(Base):
    """
    EmailEnv model for storing encrypted M365/O365 email service credentials in sales.emailenv.
    """
    __tablename__ = "emailenv"
    __table_args__ = {"schema": "sales"}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    client_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    client_secret: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    email_from: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    otp_email_from: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    weekly_report_email_from: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
