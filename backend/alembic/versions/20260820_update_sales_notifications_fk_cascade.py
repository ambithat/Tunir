"""update sales_notifications_user_id_fkey ON UPDATE CASCADE

Revision ID: 20260820_notif_fk_cascade
Revises: 20260819_add_lost_reason
Create Date: 2026-08-20 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260820_notif_fk_cascade'
down_revision = '20260819_add_lost_reason'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE sales.sales_notifications
        DROP CONSTRAINT IF EXISTS sales_notifications_user_id_fkey,
        ADD CONSTRAINT sales_notifications_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES sales.leaders(emp_id)
        ON UPDATE CASCADE ON DELETE CASCADE;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE sales.sales_notifications
        DROP CONSTRAINT IF EXISTS sales_notifications_user_id_fkey,
        ADD CONSTRAINT sales_notifications_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES sales.leaders(emp_id);
    """)
