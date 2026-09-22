from datetime import datetime, date
from typing import Optional
from decimal import Decimal
from sqlalchemy import Integer, Numeric, Text, Boolean, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SalesLeadDetailsMV(Base):
    '''
    Materialized View representing complete sales lead details with joins across
    lead_register, product_register, leaders, and status lookup tables.
    '''
    __tablename__ = "sales_lead_details_mv"
    __table_args__ = {"schema": "sales"}

    lead_id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        nullable=False
    )
    product_register_id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        nullable=False,
        default='PRD-0000'
    )
    company: Mapped[str] = mapped_column(Text, nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone_no: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    country: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lead_source: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    project_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    expected_closure: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    lead_is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    lead_created_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lead_owner_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    lead_owner_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lead_owner_email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    product_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    product_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stage_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    stage_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    probability: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    won: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    pipeline: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    risk_matrix: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    product_is_active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    product_created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_refreshed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
