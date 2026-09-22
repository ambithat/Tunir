"""sales_notifications_table

Revision ID: 20260811_sales_notifications
Revises: 20260806_sales_dashboard_mv
Create Date: 2026-08-11 11:22:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260811_sales_notifications'
down_revision: Union[str, None] = '20260806_sales_dashboard_mv'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS sales.sales_notification_id_seq START WITH 1 INCREMENT BY 1;")
    op.create_table(
        'sales_notifications',
        sa.Column('notification_id', sa.Text(), server_default=sa.text("concat('NTF-', to_char(nextval('sales.sales_notification_id_seq'), 'FM0000'))"), nullable=False),
        sa.Column('user_id', sa.Text(), sa.ForeignKey('sales.leaders.emp_id', ondelete='CASCADE'), nullable=False),
        sa.Column('id', sa.Text(), nullable=False),
        sa.Column('notification_type', sa.Text(), server_default='STAGE_UPDATE', nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_viewed', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('notification_id'),
        schema='sales'
    )
    op.create_index('idx_sales_notification_type', 'sales_notifications', ['notification_type'], schema='sales')
    op.create_index('idx_sales_notification_user_viewed', 'sales_notifications', ['user_id', 'is_viewed'], schema='sales')


def downgrade() -> None:
    op.drop_table('sales_notifications', schema='sales')
    op.execute("DROP SEQUENCE IF EXISTS sales.sales_notification_id_seq;")
