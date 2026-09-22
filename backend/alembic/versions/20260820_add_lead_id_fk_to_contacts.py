"""add lead_id FK to sales.contacts

Revision ID: 20260820_contacts_lead_id_fk
Revises: 20260820_notif_fk_cascade
Create Date: 2026-08-20 17:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260820_contacts_lead_id_fk'
down_revision = '20260820_notif_fk_cascade'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'contacts',
        sa.Column('lead_id', sa.Text(), nullable=True),
        schema='sales'
    )
    op.create_foreign_key(
        'contacts_lead_id_fkey',
        'contacts',
        'lead_register',
        ['lead_id'],
        ['lead_id'],
        source_schema='sales',
        referent_schema='sales',
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('contacts_lead_id_fkey', 'contacts', schema='sales', type_='foreignkey')
    op.drop_column('contacts', 'lead_id', schema='sales')
