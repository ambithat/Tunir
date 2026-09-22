"""recreate sales_notifications_mv without designation restriction and add unique index

Revision ID: 20260818_update_sales_notif_mv
Revises: 20260818_app_tables_update
Create Date: 2026-08-18 17:18:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260818_update_sales_notif_mv'
down_revision: Union[str, None] = '20260818_app_tables_update'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS sales.sales_notifications_mv CASCADE;")
    op.execute("""
        CREATE MATERIALIZED VIEW sales.sales_notifications_mv AS
        SELECT 
            sn.notification_id,
            sn.user_id,
            l.first_name,
            l.last_name,
            l.email,
            l.designation,
            sn.id AS target_id,
            sn.notification_type,
            sn.message,
            sn.is_viewed,
            sn.created_at,
            now() AS last_refreshed_at
        FROM sales.sales_notifications sn
        JOIN sales.leaders l ON sn.user_id = l.emp_id::text;
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_notifications_mv_id ON sales.sales_notifications_mv (notification_id);")


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS sales.sales_notifications_mv CASCADE;")
    op.execute("""
        CREATE MATERIALIZED VIEW sales.sales_notifications_mv AS
        SELECT 
            sn.notification_id,
            sn.user_id,
            l.first_name,
            l.last_name,
            l.email,
            l.designation,
            sn.id AS target_id,
            sn.notification_type,
            sn.message,
            sn.is_viewed,
            sn.created_at,
            now() AS last_refreshed_at
        FROM sales.sales_notifications sn
        JOIN sales.leaders l ON sn.user_id = l.emp_id::text
        WHERE l.designation = ANY (ARRAY['CEO'::text, 'CFO'::text]);
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_notifications_mv_id ON sales.sales_notifications_mv (notification_id);")
