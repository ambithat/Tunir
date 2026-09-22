from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, String, Boolean, Identity, Text, ForeignKey, DateTime, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import Base

class UserDbSource(Base):
    __tablename__ = "user_db_source"
    
    _id: Mapped[int] = mapped_column(
        Integer,
        Identity(start=1, cycle=True),
        nullable=False,
        primary_key=True,
        unique=True
    )
    
    display_name: Mapped[str] = mapped_column(
        String,
        nullable=False
    )
    
    user_id: Mapped[str] = mapped_column(  # emp_id (str)
        Text,
        ForeignKey("sales.leaders.emp_id", ondelete="CASCADE"),
        nullable=False
    )
    
    __table_args__ = (
        UniqueConstraint("display_name", "user_id", name="user_db_source_pk"),
        {"schema": "application_tables"}
    )
    database_type: Mapped[str] = mapped_column(
        String,
        nullable=False
    ) # added as new which contain the name of the database type(like MySQL,Postgresql etc)
    driver: Mapped[str] = mapped_column(
        String,
        nullable=False
    ) # added this will contian the driver name(like asyncpg,aiomysql etc)
    
    db_scheme: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )# updated from scheme(previously storing the driver information now)this will contian my db_scheme like(public,auth_user,tracking etc)
    
    host: Mapped[str] = mapped_column(
        String,
        nullable=False
    )
    
    port: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    
    user_name: Mapped[str] = mapped_column(
        String,
        nullable=False
    )
    
    password: Mapped[str] = mapped_column(
        String,
        nullable=False
    )
    
    db_name: Mapped[str] = mapped_column(
        String,
        nullable=False
    )
    
    ssl_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    
    ssl_mode: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    
    environment: Mapped[Optional[str]] = mapped_column(
        String(50),
        default="development",
        nullable=True
    )
    
    connection_timeout: Mapped[Optional[int]] = mapped_column(
        Integer,
        default=30,
        nullable=True
    )
    
    extra_params: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )
    
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now()
    )

    user = relationship("Leader", foreign_keys=[user_id])
