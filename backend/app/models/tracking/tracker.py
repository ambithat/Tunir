import uuid
import enum
from sqlalchemy import Integer,Text,ForeignKey,Column,DateTime,Sequence,Index,Enum
from typing import List, Optional
from sqlalchemy.dialects.postgresql import UUID,JSONB
from sqlalchemy.orm import Mapped,mapped_column,relationship
from sqlalchemy.sql import func

from app.models.base import Base

# Create sequences for auto-increment IDs
tracker_id_seq = Sequence('tracker_id_seq', metadata=Base.metadata)
tracker_history_id_seq = Sequence('tracker_history_id_seq', metadata=Base.metadata)

class TrackerStatus(enum.Enum):
    # SUBMITTED           = "SUBMITTED"
    VENDOR_QUOTES_ADDED           = "VENDOR_QUOTES_ADDED"      
    APPROVED_AT_PRODUCT_HEAD        = "APPROVED_AT_PRODUCT_HEAD"
    APPROVED_AT_DELIVERY_HEAD       = "APPROVED_AT_DELIVERY_HEAD"
    APPROVED_AT_CFO                 = "APPROVED_AT_CFO"
    APPROVED                        = "APPROVED"
    PARTIALLY_APPROVED              = "PARTIALLY_APPROVED"
    REJECTED                        = "REJECTED"
    PENDING                         = "PENDING"
    CANCELLED                       = "CANCELLED"

class Tracker(Base):
    __tablename__ = "tracker"

    tracker_id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        nullable=False,
        server_default=func.concat('TK-', func.to_char(func.nextval('tracking.tracker_id_seq'), 'FM0000'))
    )
    raised_by: Mapped[str] = mapped_column(
        Text,
        ForeignKey("sales.leaders.emp_id", ondelete="CASCADE"),
        nullable=False,
    )
    current_approver: Mapped[Optional[str]] = mapped_column(
        Text,
        ForeignKey("sales.leaders.emp_id", ondelete="SET NULL"),
        nullable=True
    )
    current_level:Mapped[int] = mapped_column(
        Integer,
        nullable=True
    )
    # information = Column(JSONB,nullable=False)
    id: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    # pr_id:Mapped[Optional[str]] = mapped_column(
    #     Text,
    #     ForeignKey("procurement.purchase_request.pr_id", ondelete="SET NULL"),
    #     nullable=False
    # )
    status: Mapped[TrackerStatus] = mapped_column(
        Enum(TrackerStatus),
        nullable=False
    )
    created_at = Column(
        DateTime(timezone=True), 
        nullable=False, 
        default=func.now(), 
        server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),  
        onupdate=func.now()
    )
    raised_by_user = relationship("Leader", foreign_keys=[raised_by])
    approver = relationship("Leader", foreign_keys=[current_approver])
    tracker_history: Mapped[List["TrackerHistory"]] = relationship(
        "TrackerHistory", back_populates="tracker", cascade="all, delete-orphan"
    )

    @property
    def raised_by_name(self) -> str:
        return self.raised_by_user.full_name if self.raised_by_user else str(self.raised_by)

    @property
    def current_approver_name(self) -> Optional[str]:
        if self.approver:
            return self.approver.full_name
        return str(self.current_approver) if self.current_approver else None

    __table_args__ = (
        Index("idx_tracker_id", "tracker_id"),
        {"schema": "tracking"},
    )



class TrackerHistory(Base):
    __tablename__ = "tracker_history"

    history_id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        nullable=False,
        server_default=func.concat('TKH-', func.to_char(func.nextval('tracking.tracker_history_id_seq'), 'FM0000'))
    )
    tracker_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("tracking.tracker.tracker_id", ondelete="CASCADE"),
        nullable=False
    )
    action_by: Mapped[Optional[str]] = mapped_column(
        Text,
        ForeignKey("sales.leaders.emp_id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    
    remarks = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True), 
        nullable=False, 
        default=func.now(), 
        server_default=func.now()
    )

    tracker = relationship("Tracker", back_populates="tracker_history", foreign_keys=[tracker_id])
    user = relationship("Leader", foreign_keys=[action_by])

    __table_args__ = (
        Index("idx_tracker_history_tracker_id", "tracker_id"),
        Index("idx_tracker_history_action_by", "action_by"),
        {"schema": "tracking"},
    )

    @property
    def action_by_name(self) -> Optional[str]:
        if self.user:
            return self.user.full_name
        return str(self.action_by) if self.action_by else None