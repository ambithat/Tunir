"""add lost_reason column to sales.product_register and drop proposal_document_name

Revision ID: 20260819_add_lost_reason
Revises: 20260819_add_proposal_cols
Create Date: 2026-08-19 13:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260819_add_lost_reason'
down_revision: Union[str, None] = '20260819_add_proposal_cols'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE sales.product_register ADD COLUMN IF NOT EXISTS lost_reason TEXT;")
    op.execute("ALTER TABLE sales.product_register DROP COLUMN IF EXISTS proposal_document_name;")
    op.execute("ALTER TABLE sales.lead_register DROP COLUMN IF EXISTS proposal_document_name;")


def downgrade() -> None:
    op.execute("ALTER TABLE sales.product_register DROP COLUMN IF EXISTS lost_reason;")
