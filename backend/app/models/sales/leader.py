import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Integer, Text, String, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import func

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.auth import Auth
    from app.models.login_history import LoginHistory
    from app.models.sales.sales_notification import SalesNotification



class Leader(Base):
    '''
    Leader model representing sales leaders/team leads
    '''
    __tablename__ = "leaders"
    __table_args__ = {"schema": "sales"}

    leader_id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        server_default=func.concat('LDR-', func.to_char(func.nextval('sales.leader_id_seq'), 'FM0000')),
        nullable=False
    )

    emp_id: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False
    )
    first_name: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    last_name: Mapped[str] = mapped_column(
        Text,
        nullable=True
    )
    password: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    designation: Mapped[str] = mapped_column(
        Text,
        nullable=True
    )
    role: Mapped[str] = mapped_column(
        Text,
        server_default="user",
        default="user",
        nullable=False
    )
    email: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False
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
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True
    )

    # Relationships
    auth_sessions: Mapped[List["Auth"]] = relationship(
        "Auth",
        back_populates="leader",
        cascade="all, delete-orphan"
    )
    login_history: Mapped[List["LoginHistory"]] = relationship(
        "LoginHistory",
        back_populates="leader",
        cascade="all, delete-orphan"
    )
    notifications: Mapped[List["SalesNotification"]] = relationship(
        "SalesNotification",
        back_populates="user",
        cascade="all, delete-orphan"
    )


    @property
    def full_name(self) -> str:
        '''
        Returns full name combining first_name and last_name
        '''
        if self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name
