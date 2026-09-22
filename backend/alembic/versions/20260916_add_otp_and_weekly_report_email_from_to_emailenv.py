"""add_otp_and_weekly_report_email_from_to_emailenv

Revision ID: 20260916_emailenv_senders
Revises: 02d8836ae476
Create Date: 2026-09-16 15:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260916_emailenv_senders'
down_revision: Union[str, None] = '02d8836ae476'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE sales.emailenv ADD COLUMN IF NOT EXISTS otp_email_from TEXT;")
    op.execute("ALTER TABLE sales.emailenv ADD COLUMN IF NOT EXISTS weekly_report_email_from TEXT;")
    op.execute("""
    UPDATE sales.emailenv 
    SET 
        otp_email_from = COALESCE(otp_email_from, 'no-reply@tardidtech.com'),
        weekly_report_email_from = COALESCE(weekly_report_email_from, 'sales@tardidtech.com')
    WHERE is_active = True;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE sales.emailenv DROP COLUMN IF EXISTS otp_email_from;")
    op.execute("ALTER TABLE sales.emailenv DROP COLUMN IF EXISTS weekly_report_email_from;")
