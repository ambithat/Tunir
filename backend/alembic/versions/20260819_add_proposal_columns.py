"""add proposal_type and proposal_document_url to product_register only

Revision ID: 20260819_add_proposal_cols
Revises: 20260818_update_sales_notif_mv
Create Date: 2026-08-19 12:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260819_add_proposal_cols'
down_revision: Union[str, None] = '20260818_update_sales_notif_mv'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE sales.lead_register DROP COLUMN IF EXISTS proposal_type;")
    op.execute("ALTER TABLE sales.lead_register DROP COLUMN IF EXISTS proposal_document_url;")
    op.execute("ALTER TABLE sales.lead_register DROP COLUMN IF EXISTS proposal_document_name;")
    op.execute("ALTER TABLE sales.product_register DROP COLUMN IF EXISTS proposal_document_name;")
    op.execute("ALTER TABLE sales.product_register ADD COLUMN IF NOT EXISTS proposal_type TEXT;")
    op.execute("ALTER TABLE sales.product_register ADD COLUMN IF NOT EXISTS proposal_document_url TEXT;")


def downgrade() -> None:
    op.execute("ALTER TABLE sales.product_register DROP COLUMN IF EXISTS proposal_document_url;")
    op.execute("ALTER TABLE sales.product_register DROP COLUMN IF EXISTS proposal_type;")
