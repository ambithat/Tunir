import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, ForeignKey, text, DateTime, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.sales.leader import Leader


class Auth(Base):
    __tablename__ = "auth_leader"
    __table_args__ = {"schema": "sales"}

    auth_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    emp_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("sales.leaders.emp_id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True
    )
    refresh_token: Mapped[str] = mapped_column(
        String, nullable=False, unique=True
    )
    refresh_token_hash: Mapped[bytes] = mapped_column(
        LargeBinary,
        nullable=False,
        unique=True
    )

    refresh_token_expiry: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    issued_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("CURRENT_TIMESTAMP")
    )

    device_info: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    leader: Mapped["Leader"] = relationship("Leader", back_populates="auth_sessions")



