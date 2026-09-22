"""add_meeting_action_remarks_to_lead_activity_register

Revision ID: 20260828_add_meeting_action_remarks
Revises: 20260828_create_proposal_sent
Create Date: 2026-08-28 17:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260828_add_meeting_remarks'
down_revision: Union[str, None] = '20260828_create_proposal_sent'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE sales.lead_activity_register ADD COLUMN IF NOT EXISTS meeting_action_remarks TEXT;
    """)


def downgrade() -> None:
    op.execute("""
    ALTER TABLE sales.lead_activity_register DROP COLUMN IF EXISTS meeting_action_remarks;
    """)
