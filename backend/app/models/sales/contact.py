from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, Text, String, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Contact(Base):
    '''
    Contact model representing contacts in sales
    '''
    __tablename__ = "contacts"
    __table_args__ = {"schema": "sales"}

    contact_id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        server_default=func.concat('CNT-', func.to_char(func.nextval('sales.contact_id_seq'), 'FM0000')),
        nullable=False
    )

    created_by: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    company: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    contact_name: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    designation: Mapped[str] = mapped_column(
        Text,
        nullable=True
    )
    phone_no_1: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    phone_no_2: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    email: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    country: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    region: Mapped[Optional[str]] = mapped_column(
        Text,
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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True
    )
