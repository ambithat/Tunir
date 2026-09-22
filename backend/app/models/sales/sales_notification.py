from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, Text, Boolean, DateTime, func, Index, ForeignKey, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.sales.leader import Leader


class SalesNotification(Base):
    '''
    SalesNotification model matching lead_activity_register format for sales schema.
    '''
    __tablename__ = "sales_notifications"
    __table_args__ = (
        Index("idx_sales_notification_type", "notification_type"),
        Index("idx_sales_notification_user_viewed", "user_id", "is_viewed"),
        {"schema": "sales"},
    )

    notification_id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        server_default=func.concat('NTF-', func.to_char(func.nextval('sales.sales_notification_id_seq'), 'FM0000')),
        nullable=False
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
    notification_type: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="STAGE_UPDATE"
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    is_viewed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[Optional["Leader"]] = relationship(
        "Leader",
        back_populates="notifications",
        foreign_keys=[user_id]
    )

