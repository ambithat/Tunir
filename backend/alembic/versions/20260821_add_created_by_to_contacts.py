"""add created_by to sales.contacts

Revision ID: 20260821_contacts_created_by
Revises: 20260820_contacts_lead_id_fk
Create Date: 2026-08-21 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260821_contacts_created_by'
down_revision = '20260820_contacts_lead_id_fk'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'contacts',
        sa.Column('created_by', sa.Text(), nullable=True),
        schema='sales'
    )


def downgrade() -> None:
    op.drop_column('contacts', 'created_by', schema='sales')
