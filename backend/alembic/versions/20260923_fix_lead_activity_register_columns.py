"""fix_lead_activity_register_columns

Revision ID: 20260923_activity_cols
Revises: 20260916_emailenv_senders
Create Date: 2026-09-23 16:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260923_activity_cols'
down_revision: Union[str, None] = '20260916_emailenv_senders'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE sales.lead_activity_register ADD COLUMN IF NOT EXISTS meeting_plan TEXT;")
    op.execute("ALTER TABLE sales.lead_activity_register ADD COLUMN IF NOT EXISTS meeting_action_remarks TEXT;")
    op.execute("ALTER TABLE sales.lead_activity_register ADD COLUMN IF NOT EXISTS next_meeting_plan TEXT;")
    op.execute("ALTER TABLE sales.lead_activity_register ADD COLUMN IF NOT EXISTS next_action_type_id INTEGER REFERENCES statustype.activity_type_status_type(id) ON DELETE SET NULL;")
    op.execute("ALTER TABLE sales.lead_activity_register ADD COLUMN IF NOT EXISTS overdue_reason TEXT;")
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sales' AND table_name = 'lead_activity_register' AND column_name = 'summary') THEN
            UPDATE sales.lead_activity_register SET meeting_plan = COALESCE(meeting_plan, summary) WHERE meeting_plan IS NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sales' AND table_name = 'lead_activity_register' AND column_name = 'next_action') THEN
            UPDATE sales.lead_activity_register SET next_meeting_plan = COALESCE(next_meeting_plan, next_action) WHERE next_meeting_plan IS NULL;
        END IF;
    END$$;
    """)


def downgrade() -> None:
    pass
