"""remove lead_id from sales.contacts

Revision ID: 20260821_remove_contacts_lead_id
Revises: 20260821_contacts_created_by
Create Date: 2026-08-21 14:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260821_remove_contacts_lead_id'
down_revision = '20260821_contacts_created_by'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop foreign key constraint if exists, then drop column
    op.drop_constraint('contacts_lead_id_fkey', 'contacts', schema='sales', type_='foreignkey')
    op.drop_column('contacts', 'lead_id', schema='sales')


def downgrade() -> None:
    op.add_column(
        'contacts',
        sa.Column('lead_id', sa.Text(), nullable=True),
        schema='sales'
    )
    op.create_foreign_key(
        'contacts_lead_id_fkey',
        'contacts', 'lead_register',
        ['lead_id'], ['lead_id'],
        source_schema='sales', referent_schema='sales',
        ondelete='SET NULL'
    )
