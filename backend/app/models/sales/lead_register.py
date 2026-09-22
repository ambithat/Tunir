from datetime import datetime, date
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Integer, BigInteger, String, Text, Numeric, Boolean, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.sales.leader import Leader
    from app.models.sales.lead_activity_register import LeadActivityRegister
    from app.models.sales.proposal_sent import ProposalSent
    from app.models.statustype.statustype import (
        ProductStatusType,
        LeadProductStatusType,
        LeaderStageStatusType,
    )


class LeadRegister(Base):
    '''
    LeadRegister model representing lead register in sales schema
    '''
    __tablename__ = "lead_register"
    __table_args__ = {"schema": "sales"}

    lead_id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        server_default=func.concat('LD-', func.to_char(func.nextval('sales.lead_id_seq'), 'FM0000')),
        nullable=False
    )
    created_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    lead_owner_id: Mapped[Optional[str]] = mapped_column(
        Text,
        ForeignKey("sales.leaders.leader_id", ondelete="SET NULL"),
        nullable=True
    )

    lead_source: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    company: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    contact_name: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    designation: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    phone_no: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    email: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    country: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        server_default="true",
        default=True,
        nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True
    )

    # 1 : N Relationship to ProductRegister
    products: Mapped[List["ProductRegister"]] = relationship(
        "ProductRegister",
        back_populates="lead",
        cascade="all, delete-orphan"
    )

    # 1 : N Relationship to LeadActivityRegister
    activities: Mapped[List["LeadActivityRegister"]] = relationship(
        "LeadActivityRegister",
        back_populates="lead",
        cascade="all, delete-orphan"
    )

    # 1 : N Relationship to ProposalSent
    proposals: Mapped[List["ProposalSent"]] = relationship(
        "ProposalSent",
        back_populates="lead",
        cascade="all, delete-orphan"
    )

    # Relationship to Leader
    owner_leader: Mapped[Optional["Leader"]] = relationship(
        "Leader",
        foreign_keys=[lead_owner_id]
    )

    @property
    def lead_owner_name(self) -> Optional[str]:
        '''
        Returns lead owner full name from relationship
        '''
        return self.owner_leader.full_name if self.owner_leader else None


class ProductRegister(Base):
    '''
    ProductRegister model representing product register in sales schema
    '''
    __tablename__ = "product_register"
    __table_args__ = {"schema": "sales"}

    product_register_id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        server_default=func.concat('PRD-', func.to_char(func.nextval('sales.product_register_id_seq'), 'FM0000')),
        nullable=False
    )
    lead_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("sales.lead_register.lead_id", ondelete="CASCADE"),
        nullable=False
    )

    product_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("statustype.product_status_type.id", ondelete="SET NULL"),
        nullable=True
    )
    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    status_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("statustype.lead_product_status.id", ondelete="SET NULL"),
        nullable=True
    )
    stage_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("statustype.leader_stage_status_type.id", ondelete="SET NULL"),
        nullable=True
    )
    probability: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2),
        nullable=True
    )
    won: Mapped[Optional[float]] = mapped_column(
        Numeric(15, 2),
        server_default="0.00",
        nullable=False,
        default=0.0
    )
    project_value: Mapped[Optional[float]] = mapped_column(
        Numeric(15, 2),
        nullable=True
    )
    expected_closure: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True
    )
    pipeline: Mapped[Optional[float]] = mapped_column(
        Numeric(15, 2),
        nullable=True
    )
    risk_matrix: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    lost_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        server_default="true",
        default=True,
        nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True
    )
    product_owner_id: Mapped[Optional[str]] = mapped_column(
        Text,
        ForeignKey("sales.leaders.leader_id", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    lead: Mapped[Optional["LeadRegister"]] = relationship(
        "LeadRegister",
        back_populates="products"
    )
    product_owner: Mapped[Optional["Leader"]] = relationship(
        "Leader",
        foreign_keys=[product_owner_id]
    )
    product_type: Mapped[Optional["ProductStatusType"]] = relationship(
        "ProductStatusType",
        foreign_keys=[product_id]
    )
    product_status_type: Mapped[Optional["LeadProductStatusType"]] = relationship(
        "LeadProductStatusType",
        foreign_keys=[status_id]
    )
    stage_status_type: Mapped[Optional["LeaderStageStatusType"]] = relationship(
        "LeaderStageStatusType",
        foreign_keys=[stage_id]
    )

    @property
    def product_name(self) -> Optional[str]:
        '''
        Returns product name from ProductStatusType relationship
        '''
        return self.product_type.product if self.product_type else None

    @property
    def status_name(self) -> Optional[str]:
        '''
        Returns product status from LeadProductStatusType relationship
        '''
        return self.product_status_type.status if self.product_status_type else None

    @property
    def stage_name(self) -> Optional[str]:
        '''
        Returns leader stage from LeaderStageStatusType relationship
        '''
        return self.stage_status_type.leader_stage if self.stage_status_type else None
