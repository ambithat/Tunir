import enum
from typing import Optional
from sqlalchemy import Column,Text,Integer,ForeignKey,DateTime,Boolean,Sequence,Enum,Index

from sqlalchemy.orm import Mapped,mapped_column,relationship
from sqlalchemy.sql import func
from app.models.base import Base

class NotificationType(enum.Enum):
    MANUFACTURING_PURCHASE_REQUEST = "MANUFACTURING_PURCHASE_REQUEST"
    OPERATIONAL_PURCHASE_REQUEST = "OPERATIONAL_PURCHASE_REQUEST"
    EMERGENCY_PURCHASE_REQUEST = "EMERGENCY_PURCHASE_REQUEST"
    MANUFACTURING_PURCHASE_ORDER = "MANUFACTURING_PURCHASE_ORDER"
    OPERATIONAL_PURCHASE_ORDER = "OPERATIONAL_PURCHASE_ORDER"
    GOODS_RECEIVED = "GOODS_RECEIVED"
    ITEM_REQUEST = "ITEM_REQUEST"
    ASSET_ASSIGNMENT = "ASSET_ASSIGNMENT"
    PRODUCTION_ORDER = "PRODUCTION_ORDER"
    SALES_ORDER = "SALES_ORDER"


class Notification(Base):
    __tablename__ = "notification"
    __table_args__ = (
        Index("idx_notification_type", "notification_type"),
        Index("idx_notification_user_viewed", "user_id", "is_viewed"),
        {"schema": "tracking"},
    )
    
    notification_id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        server_default=func.concat('NTF-', func.to_char(func.nextval('tracking.notification_id_seq'), 'FM0000'))
    )
    user_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("sales.leaders.emp_id", ondelete="CASCADE"),
        nullable=False
    )
    id: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    approver_id: Mapped[Optional[str]] = mapped_column(
        Text,
        ForeignKey("sales.leaders.emp_id", ondelete="CASCADE"),
        nullable=True
    )

    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, schema="tracking"),
        nullable=False
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_viewed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("Leader", foreign_keys=[user_id])
    # tracker = relationship("Tracker", foreign_keys=[id])