"""add_role_to_leaders

Revision ID: 20260828_add_role_to_leaders
Revises: 20260824_add_updated_at
Create Date: 2026-08-28 13:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260828_add_role_to_leaders'
down_revision: Union[str, None] = '20260824_add_updated_at'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE sales.leaders ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';")


def downgrade() -> None:
    op.execute("ALTER TABLE sales.leaders DROP COLUMN IF EXISTS role;")
