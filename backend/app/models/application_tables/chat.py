from app.models.base import Base
import uuid
import enum
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import text, Text, String, DateTime, ForeignKey, Boolean, Index, Integer, Column, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import ARRAY

class ChatSession(Base):
    __tablename__ = "chat_session"
    __table_args__ = {"schema": "application_tables"}

    session_id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("uuidv7()")
    )
    
    user_id = Column(
        Text,
        ForeignKey("sales.leaders.emp_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user = relationship("Leader", foreign_keys=[user_id])
    
    title = Column(String(255), nullable=True)
    model_name = Column(String(100), nullable=True)
    system_prompt = Column(Text, nullable=True)
    agent_metadata = Column(JSONB, nullable=True)
    
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now(), onupdate=func.now())
    
    is_active = Column(Boolean, nullable=False, default=True)

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    queries = relationship("QueryExecution", back_populates="session", cascade="all, delete-orphan")


class ChatStatus(enum.Enum):
    DATA_LOADED = "DATA_LOADED"
    CHART_LOADED = "CHART_LOADED"
    DASHBOARD_LOADED = "DASHBOARD_LOADED"
    REPORT = "REPORT"
    NO_RESULTS = "NO_RESULTS"
    ERROR = "ERROR"

class ChatMessage(Base):
    __tablename__ = "chat_message"
    __table_args__ = {"schema": "application_tables"}

    message_id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("uuidv7()")
    )
    
    session_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("application_tables.chat_session.session_id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    
    user_id = Column(
        Text,
        ForeignKey("sales.leaders.emp_id", ondelete="CASCADE"),
        nullable=False
    )
    
    content = Column(JSONB, nullable=True)
    chat_metadata = Column(JSONB, nullable=True)
    status: Mapped[ChatStatus] = mapped_column(
        Enum(ChatStatus), nullable=False, default=ChatStatus.NO_RESULTS
    )
    
    feedback_rating = Column(Integer, nullable=True)
    feedback_text = Column(Text, nullable=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    model_name = Column(String(100), nullable=True)
    
    created_at = Column(
        DateTime(timezone=True), 
        nullable=False, 
        default=func.now(),
        server_default=func.now(), 
        index=True
    )

    session = relationship("ChatSession", back_populates="messages")
    user = relationship("Leader", foreign_keys=[user_id])
    query_executions = relationship("QueryExecution", back_populates="message", cascade="all, delete-orphan")


class QueryExecution(Base):
    __tablename__ = "query_execution"
    __table_args__ = {"schema": "application_tables"}

    query_id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("uuidv7()")
    )
    
    session_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("application_tables.chat_session.session_id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    
    message_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("application_tables.chat_message.message_id", ondelete="CASCADE"), 
        nullable=False
    )
    
    sql_query = Column(Text, nullable=False)
    row_count = Column(Integer, nullable=True)
    column_names = Column(ARRAY(String), nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    
    result_type = Column(String(50), nullable=True)
    result_cache_key = Column(String(100), nullable=True)
    csv_file_path = Column(String(500), nullable=True)
    
    agent_name = Column(String(100), nullable=True)
    tokens_used = Column(Integer, nullable=True)
    
    csv_expires_at = Column(DateTime(timezone=True), nullable=True)
    result_preview = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(
        DateTime(timezone=True), 
        nullable=False, 
        default=func.now(),
        server_default=func.now(), 
        index=True
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)

    session = relationship("ChatSession", back_populates="queries")
    message = relationship("ChatMessage", back_populates="query_executions")
