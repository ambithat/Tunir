from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.sales.lead_register import LeadRegister


class ProposalSent(Base):
    __tablename__ = "proposal_sent"
    __table_args__ = {"schema": "sales"}

    proposal_sent_id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        server_default=func.concat('PRP-', func.to_char(func.nextval('sales.proposal_sent_id_seq'), 'FM0000')),
    )
    lead_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("sales.lead_register.lead_id", ondelete="CASCADE"),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    proposal_type: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    created_by: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    lead: Mapped["LeadRegister"] = relationship("LeadRegister", back_populates="proposals")
