import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, Identity
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class KeyStatus(enum.Enum):
    """Enum matching the PostgreSQL enum type `status`.
    Values must correspond exactly to the strings stored in the DB.
    """
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    RATE_LIMITED = "RATE_LIMIT"

class ApiKey(Base):
    __tablename__ = "llm_api_keys"
    __table_args__ = {"schema": "application_tables"}

    id = Column(
        Integer,
        Identity(always=False, start=1, cycle=False),
        primary_key=True,
    )

    key_name = Column(String(100), nullable=True)
    api_key = Column(Text, nullable=False)
    provider_name = Column(String(100), nullable=False, default="openai")
    organization_id = Column(String(100), nullable=True)

    status = Column(
        Enum(
            KeyStatus,
            name="status",
            native_enum=True,
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=KeyStatus.ACTIVE,
    )

    rate_limited_at = Column(DateTime(timezone=True), nullable=True)
    next_available_at = Column(DateTime(timezone=True), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    priority = Column(Integer, nullable=False, default=1)
    fail_count = Column(Integer, nullable=False, default=0)
    max_tokens_limit = Column(Integer, nullable=True)
    monthly_quota = Column(Integer, nullable=True)
