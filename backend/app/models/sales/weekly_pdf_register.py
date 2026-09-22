from datetime import datetime, date
from typing import Optional
from sqlalchemy import BigInteger, String, Text, Date, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class WeeklyPdfRegister(Base):
    '''
    WeeklyPdfRegister model representing generated executive weekly PDF report entries stored in SeaweedFS.
    '''
    __tablename__ = "weekly_pdf_register"
    __table_args__ = {"schema": "sales"}

    weekly_pdf_id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True
    )
    report_date: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )
    pdf_url: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    filename: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    file_size_bytes: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        server_default="true",
        default=True,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
