"""add_updated_at_to_lead_and_product_register

Revision ID: 20260824_add_updated_at
Revises: 20260821_remove_lead_id_from_contacts
Create Date: 2026-08-24 16:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260824_add_updated_at'
down_revision: Union[str, None] = '20260821_remove_contacts_lead_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE sales.lead_register ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;")
    op.execute("ALTER TABLE sales.product_register ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;")


def downgrade() -> None:
    op.execute("ALTER TABLE sales.lead_register DROP COLUMN IF EXISTS updated_at;")
    op.execute("ALTER TABLE sales.product_register DROP COLUMN IF EXISTS updated_at;")
