"""add_overdue_reason_to_lead_activity_register

Revision ID: 20260828_add_overdue_reason
Revises: 20260828_add_meeting_action_remarks
Create Date: 2026-08-28 18:12:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260828_add_overdue_reason'
down_revision: Union[str, None] = '20260828_add_meeting_remarks'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE sales.lead_activity_register ADD COLUMN IF NOT EXISTS overdue_reason TEXT;
    """)


def downgrade() -> None:
    op.execute("""
    ALTER TABLE sales.lead_activity_register DROP COLUMN IF EXISTS overdue_reason;
    """)
