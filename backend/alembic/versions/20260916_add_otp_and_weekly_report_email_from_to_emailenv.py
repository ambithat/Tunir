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
    op.execute("CREATE SCHEMA IF NOT EXISTS sales;")
    op.execute("""
    CREATE TABLE IF NOT EXISTS sales.emailenv (
        id SERIAL PRIMARY KEY,
        client_id TEXT,
        tenant_id TEXT,
        client_secret TEXT,
        email_from TEXT,
        otp_email_from TEXT DEFAULT 'no-reply@tardidtech.com',
        weekly_report_email_from TEXT DEFAULT 'sales@tardidtech.com',
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
    """)
    op.execute("ALTER TABLE sales.emailenv ADD COLUMN IF NOT EXISTS otp_email_from TEXT;")
    op.execute("ALTER TABLE sales.emailenv ADD COLUMN IF NOT EXISTS weekly_report_email_from TEXT;")
    op.execute("""
    UPDATE sales.emailenv 
    SET 
        otp_email_from = COALESCE(otp_email_from, 'no-reply@tardidtech.com'),
        weekly_report_email_from = COALESCE(weekly_report_email_from, 'sales@tardidtech.com')
    WHERE is_active = True;
    """)

    # Tracking schema and tables
    op.execute("CREATE SCHEMA IF NOT EXISTS tracking;")
    op.execute("CREATE SEQUENCE IF NOT EXISTS tracking.tracker_id_seq START 1;")
    op.execute("CREATE SEQUENCE IF NOT EXISTS tracking.tracker_history_id_seq START 1;")
    op.execute("CREATE SEQUENCE IF NOT EXISTS tracking.notification_id_seq START 1;")
    op.execute("""
    CREATE TABLE IF NOT EXISTS tracking.tracker (
        tracker_id TEXT PRIMARY KEY DEFAULT ('TK-' || to_char(nextval('tracking.tracker_id_seq'), 'FM0000')),
        raised_by TEXT NOT NULL REFERENCES sales.leaders(emp_id) ON DELETE CASCADE,
        current_approver TEXT REFERENCES sales.leaders(emp_id) ON DELETE SET NULL,
        current_level INTEGER,
        id TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS tracking.tracker_history (
        history_id TEXT PRIMARY KEY DEFAULT ('TKH-' || to_char(nextval('tracking.tracker_history_id_seq'), 'FM0000')),
        tracker_id TEXT NOT NULL REFERENCES tracking.tracker(tracker_id) ON DELETE CASCADE,
        action_by TEXT REFERENCES sales.leaders(emp_id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        remarks TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
    """)
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificationtype') THEN
            CREATE TYPE tracking.notificationtype AS ENUM (
                'MANUFACTURING_PURCHASE_REQUEST', 'OPERATIONAL_PURCHASE_REQUEST',
                'EMERGENCY_PURCHASE_REQUEST', 'MANUFACTURING_PURCHASE_ORDER',
                'OPERATIONAL_PURCHASE_ORDER', 'GOODS_RECEIVED', 'ITEM_REQUEST',
                'ASSET_ASSIGNMENT', 'PRODUCTION_ORDER', 'SALES_ORDER'
            );
        END IF;
    END$$;
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS tracking.notification (
        notification_id TEXT PRIMARY KEY DEFAULT ('NTF-' || to_char(nextval('tracking.notification_id_seq'), 'FM0000')),
        user_id TEXT NOT NULL REFERENCES sales.leaders(emp_id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        approver_id TEXT REFERENCES sales.leaders(emp_id) ON DELETE CASCADE,
        notification_type tracking.notificationtype,
        message TEXT NOT NULL,
        is_viewed BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE sales.emailenv DROP COLUMN IF EXISTS otp_email_from;")
    op.execute("ALTER TABLE sales.emailenv DROP COLUMN IF EXISTS weekly_report_email_from;")

