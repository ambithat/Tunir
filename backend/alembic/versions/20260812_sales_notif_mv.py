"""sales_notifications_mv

Revision ID: 20260812_sales_notif_mv
Revises: 20260811_sales_str_pks
Create Date: 2026-08-12 16:47:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260812_sales_notif_mv'
down_revision: Union[str, None] = '20260811_sales_str_pks'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Materialized View sales.sales_notifications_mv
    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS sales.sales_notifications_mv AS
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
            NOW() AS last_refreshed_at
        FROM sales.sales_notifications sn
        JOIN sales.leaders l ON sn.user_id = l.emp_id
        WHERE l.designation IN ('CEO', 'CFO');
    """)

    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_notifications_mv_pk 
        ON sales.sales_notifications_mv (notification_id);
    """)

    # 2. Create PG Notification Function & Trigger for sales.sales_notifications
    op.execute("""
        CREATE OR REPLACE FUNCTION sales.notify_sales_notification_change()
        RETURNS trigger AS $$
        DECLARE
            v_leader_id text;
        BEGIN
            SELECT leader_id INTO v_leader_id
            FROM sales.leaders
            WHERE emp_id = COALESCE(NEW.user_id, OLD.user_id);

            PERFORM pg_notify(
                'sales_notification_update',
                json_build_object(
                    'table', TG_TABLE_NAME,
                    'action', TG_OP,
                    'notification_id', COALESCE(NEW.notification_id, OLD.notification_id),
                    'user_id', COALESCE(NEW.user_id, OLD.user_id),
                    'leader_id', v_leader_id,
                    'is_viewed', COALESCE(NEW.is_viewed, FALSE),
                    'message', COALESCE(NEW.message, '')
                )::text
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("DROP TRIGGER IF EXISTS trg_sales_notification_change ON sales.sales_notifications;")
    op.execute("""
        CREATE TRIGGER trg_sales_notification_change
        AFTER INSERT OR UPDATE OR DELETE ON sales.sales_notifications
        FOR EACH ROW EXECUTE FUNCTION sales.notify_sales_notification_change();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_sales_notification_change ON sales.sales_notifications;")
    op.execute("DROP FUNCTION IF EXISTS sales.notify_sales_notification_change();")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS sales.sales_notifications_mv CASCADE;")
