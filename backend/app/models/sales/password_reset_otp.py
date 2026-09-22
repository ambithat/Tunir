import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otp"
    __table_args__ = {"schema": "sales"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    otp_code: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        server_default=text("now()")
    )

