from sqlalchemy import Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class LeaderStageStatusType(Base):
    '''
    LeaderStageStatusType model representing status types for leader stages
    '''
    __tablename__ = "leader_stage_status_type"
    __table_args__ = {"schema": "statustype"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        nullable=False
    )
    leader_stage: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )


class RiskMatrixStatusType(Base):
    '''
    RiskMatrixStatusType model representing status types for risk matrix
    '''
    __tablename__ = "risk_matrix_status_type"
    __table_args__ = {"schema": "statustype"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        nullable=False
    )
    risk_matrix: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )


class ActivityTypeStatusType(Base):
    '''
    ActivityTypeStatusType model representing status types for activity type
    '''
    __tablename__ = "activity_type_status_type"
    __table_args__ = {"schema": "statustype"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        nullable=False
    )
    activity_type: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )


class ProductStatusType(Base):
    '''
    ProductStatusType model representing status types for product
    '''
    __tablename__ = "product_status_type"
    __table_args__ = {"schema": "statustype"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        nullable=False
    )
    product: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )


class LeadProductStatusType(Base):
    '''
    LeadProductStatusType model representing status types for lead product status
    '''
    __tablename__ = "lead_product_status"
    __table_args__ = {"schema": "statustype"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )


class DailyActivityOutcomeStatusType(Base):
    '''
    DailyActivityOutcomeStatusType model representing status types for daily activity outcome
    '''
    __tablename__ = "daily_activity_outcome"
    __table_args__ = {"schema": "statustype"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        nullable=False
    )
    outcome: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )


class DailyActivityStatusType(Base):
    '''
    DailyActivityStatusType model representing status types for daily activity action status
    '''
    __tablename__ = "daily_activity_status"
    __table_args__ = {"schema": "statustype"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        nullable=False
    )
    action_status: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
