"""create enhanced auth_user.login_history table

Revision ID: 20260903_login_history
Revises: 20260902_schedule_pg_cron
Create Date: 2026-09-03

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '20260903_login_history'
down_revision = '20260902_schedule_pg_cron'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA IF NOT EXISTS auth_user;")
    op.execute("""
    CREATE TABLE IF NOT EXISTS auth_user.login_history (
        id SERIAL PRIMARY KEY,
        user_id TEXT REFERENCES sales.leaders(emp_id) ON DELETE CASCADE,
        email_attempted VARCHAR(255),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        logout_timestamp TIMESTAMP WITH TIME ZONE,
        logout_reason VARCHAR(50),
        failure_reason VARCHAR(255),
        ip_address VARCHAR(45) DEFAULT '127.0.0.1',
        device_info VARCHAR,
        browser VARCHAR(100),
        os VARCHAR(100),
        status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
        active_seconds INTEGER NOT NULL DEFAULT 0,
        last_active_at TIMESTAMP WITH TIME ZONE,
        session_id VARCHAR(255)
    );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_login_history_id ON auth_user.login_history (id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON auth_user.login_history (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_login_history_timestamp ON auth_user.login_history (timestamp);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_login_history_session_id ON auth_user.login_history (session_id);")


def downgrade():
    op.execute("""
    DROP TABLE IF EXISTS auth_user.login_history;
    """)
