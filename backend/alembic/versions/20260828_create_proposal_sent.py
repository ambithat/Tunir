"""create_proposal_sent_table

Revision ID: 20260828_create_proposal_sent
Revises: 20260828_add_role_to_leaders
Create Date: 2026-08-28 14:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260828_create_proposal_sent'
down_revision: Union[str, None] = '20260828_add_role_to_leaders'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS sales.proposal_sent_id_seq START WITH 1 INCREMENT BY 1;")
    op.execute("""
    CREATE TABLE IF NOT EXISTS sales.proposal_sent (
        proposal_sent_id TEXT PRIMARY KEY DEFAULT concat('PRP-', to_char(nextval('sales.proposal_sent_id_seq'), 'FM0000')),
        lead_id TEXT NOT NULL REFERENCES sales.lead_register(lead_id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        remarks TEXT,
        proposal_type TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT
    );
    """)
    op.execute("ALTER TABLE sales.lead_register DROP COLUMN IF EXISTS proposal_type;")
    op.execute("ALTER TABLE sales.lead_register DROP COLUMN IF EXISTS proposal_document_url;")
    op.execute("ALTER TABLE sales.product_register DROP COLUMN IF EXISTS proposal_type;")
    op.execute("ALTER TABLE sales.product_register DROP COLUMN IF EXISTS proposal_document_url;")


def downgrade() -> None:
    op.execute("""
    DROP TABLE IF EXISTS sales.proposal_sent;
    DROP SEQUENCE IF EXISTS sales.proposal_sent_id_seq;
    """)
