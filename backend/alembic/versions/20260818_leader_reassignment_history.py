"""add leader reassignment history table

Revision ID: 20260818_leader_reassignment_history
Revises: 20260813_shift_pv_ec_to_product
Create Date: 2026-08-18 12:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260818_leader_reassign'
down_revision: Union[str, None] = '20260813_won_numeric'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'leader_reassignment_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('source_leader_id', sa.Text(), nullable=False),
        sa.Column('target_leader_id', sa.Text(), nullable=False),
        sa.Column('reassigned_by', sa.Text(), nullable=True),
        sa.Column('reassigned_leads_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('reassigned_activities_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        schema='sales'
    )
    op.create_index(
        'ix_sales_leader_reassignment_history_source_leader_id',
        'leader_reassignment_history',
        ['source_leader_id'],
        unique=False,
        schema='sales'
    )
    op.create_index(
        'ix_sales_leader_reassignment_history_target_leader_id',
        'leader_reassignment_history',
        ['target_leader_id'],
        unique=False,
        schema='sales'
    )


def downgrade() -> None:
    op.drop_index('ix_sales_leader_reassignment_history_target_leader_id', table_name='leader_reassignment_history', schema='sales')
    op.drop_index('ix_sales_leader_reassignment_history_source_leader_id', table_name='leader_reassignment_history', schema='sales')
    op.drop_table('leader_reassignment_history', schema='sales')
