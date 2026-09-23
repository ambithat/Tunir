"""add_response_payload_to_mail_events

Revision ID: 20260910_mail_events_resp
Revises: 20260903_login_history
Create Date: 2026-09-10 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260910_mail_events_resp'
down_revision: Union[str, None] = '20260903_login_history'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE SCHEMA IF NOT EXISTS sales;

    CREATE TABLE IF NOT EXISTS sales.mail_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        response_payload JSONB,
        status VARCHAR(20) DEFAULT 'pending' NOT NULL,
        retry_count INTEGER DEFAULT 0 NOT NULL,
        last_error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE
    );

    ALTER TABLE sales.mail_events ADD COLUMN IF NOT EXISTS response_payload JSONB;

    CREATE TABLE IF NOT EXISTS sales.weekly_pdf_register (
        weekly_pdf_id VARCHAR(50) PRIMARY KEY,
        report_date DATE NOT NULL,
        pdf_url TEXT NOT NULL,
        filename VARCHAR(255),
        file_size_bytes BIGINT,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
    """)


def downgrade() -> None:
    op.execute("""
    ALTER TABLE sales.mail_events DROP COLUMN IF EXISTS response_payload;
    """)

