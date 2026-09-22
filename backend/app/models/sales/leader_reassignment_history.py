from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class LeaderReassignmentHistory(Base):
    """
    Audit history model tracking workload reassignments from one leader to another.
    """
    __tablename__ = "leader_reassignment_history"
    __table_args__ = {"schema": "sales"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )
    source_leader_id: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True
    )
    target_leader_id: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True
    )
    reassigned_by: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    reassigned_products_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )
    reassigned_leads_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )
    reassigned_activities_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
