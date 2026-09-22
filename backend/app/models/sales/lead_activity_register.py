from datetime import datetime, date
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, BigInteger, String, Text, Date, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.sales.leader import Leader
    from app.models.sales.lead_register import LeadRegister
    from app.models.statustype.statustype import (
        ActivityTypeStatusType,
        DailyActivityOutcomeStatusType,
        DailyActivityStatusType,
    )


class LeadActivityRegister(Base):
    '''
    LeadActivityRegister model representing lead activity register in sales schema
    '''
    __tablename__ = "lead_activity_register"
    __table_args__ = {"schema": "sales"}

    activity_id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        nullable=False
    )
    lead_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("sales.lead_register.lead_id", ondelete="CASCADE"),
        nullable=False
    )
    lead_no: Mapped[Optional[int]] = mapped_column(
        Integer,
        autoincrement=True,
        nullable=True
    )
    lead_owner_id: Mapped[Optional[str]] = mapped_column(
        Text,
        ForeignKey("sales.leaders.leader_id", ondelete="SET NULL"),
        nullable=True
    )

    activity_date: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )
    activity_type_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("statustype.activity_type_status_type.id", ondelete="SET NULL"),
        nullable=True
    )
    meeting_plan: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    meeting_action_remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    next_meeting_plan: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    next_action_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True
    )
    next_action_type_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("statustype.activity_type_status_type.id", ondelete="SET NULL"),
        nullable=True
    )
    outcome_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("statustype.daily_activity_outcome.id", ondelete="SET NULL"),
        nullable=True
    )
    action_status_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("statustype.daily_activity_status.id", ondelete="SET NULL"),
        nullable=True
    )
    overdue_reason: Mapped[Optional[str]] = mapped_column(
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
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True
    )

    # Relationships
    lead: Mapped[Optional["LeadRegister"]] = relationship(
        "LeadRegister",
        back_populates="activities"
    )
    owner_leader: Mapped[Optional["Leader"]] = relationship(
        "Leader",
        foreign_keys=[lead_owner_id]
    )
    activity_type_status: Mapped[Optional["ActivityTypeStatusType"]] = relationship(
        "ActivityTypeStatusType",
        foreign_keys=[activity_type_id]
    )
    next_action_type_status: Mapped[Optional["ActivityTypeStatusType"]] = relationship(
        "ActivityTypeStatusType",
        foreign_keys=[next_action_type_id]
    )
    outcome_status: Mapped[Optional["DailyActivityOutcomeStatusType"]] = relationship(
        "DailyActivityOutcomeStatusType",
        foreign_keys=[outcome_id]
    )
    action_status_type: Mapped[Optional["DailyActivityStatusType"]] = relationship(
        "DailyActivityStatusType",
        foreign_keys=[action_status_id]
    )



    @property
    def summary(self) -> Optional[str]:
        return self.meeting_plan

    @property
    def next_action(self) -> Optional[str]:
        if self.next_action_type_status:
            return self.next_action_type_status.activity_type
        if self.next_action_type_id is not None:
            return str(self.next_action_type_id)
        return self.next_meeting_plan

    @property
    def lead_owner_name(self) -> Optional[str]:
        '''
        Returns lead owner full name from relationship
        '''
        return self.owner_leader.full_name if self.owner_leader else None

    @property
    def activity_type_name(self) -> Optional[str]:
        '''
        Returns activity type name from relationship
        '''
        return self.activity_type_status.activity_type if self.activity_type_status else None

    @property
    def next_action_type_name(self) -> Optional[str]:
        '''
        Returns next action type name from relationship (using same ActivityTypeStatusType)
        '''
        return self.next_action_type_status.activity_type if self.next_action_type_status else None

    @property
    def outcome_name(self) -> Optional[str]:
        '''
        Returns activity outcome name from relationship
        '''
        return self.outcome_status.outcome if self.outcome_status else None

    @property
    def action_status_name(self) -> Optional[str]:
        '''
        Returns action status name from relationship
        '''
        return self.action_status_type.action_status if self.action_status_type else None

    @property
    def company(self) -> Optional[str]:
        return self.lead.company if self.lead else None

    @property
    def contact_name(self) -> Optional[str]:
        return self.lead.contact_name if self.lead else None

    @property
    def contact_email(self) -> Optional[str]:
        return self.lead.email if self.lead else None

    @property
    def contact_phone(self) -> Optional[str]:
        return self.lead.phone_no if self.lead else None

    @property
    def contact_designation(self) -> Optional[str]:
        return self.lead.designation if self.lead else None

    @property
    def country(self) -> Optional[str]:
        return self.lead.country if self.lead else None

    @property
    def lead_source(self) -> Optional[str]:
        return self.lead.lead_source if self.lead else None

    @property
    def products(self) -> list:
        '''
        Returns product register items from parent lead relationship
        '''
        if self.lead and self.lead.products:
            return self.lead.products
        return []
