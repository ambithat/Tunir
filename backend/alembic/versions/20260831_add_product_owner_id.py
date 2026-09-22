"""add_product_owner_id_to_product_register

Revision ID: 20260831_add_product_owner_id
Revises: 20260828_add_overdue_reason
Create Date: 2026-08-31 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260831_add_product_owner_id'
down_revision: Union[str, None] = '20260828_add_overdue_reason'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE sales.product_register
    ADD COLUMN IF NOT EXISTS product_owner_id TEXT REFERENCES sales.leaders(leader_id) ON DELETE SET NULL;
    """)


def downgrade() -> None:
    op.execute("""
    ALTER TABLE sales.product_register DROP COLUMN IF EXISTS product_owner_id;
    """)
