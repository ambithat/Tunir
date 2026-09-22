"""schedule pg_cron materialized view refresh

Revision ID: 20260902_schedule_pg_cron
Revises: 20260831_add_product_owner_id
Create Date: 2026-09-02

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '20260902_schedule_pg_cron'
down_revision = '20260831_add_product_owner_id'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    DO $DO$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
            PERFORM cron.schedule(
                'refresh_sales_lead_details_mv_job',
                '*/5 * * * *',
                'REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_lead_details_mv;'
            );
            PERFORM cron.schedule(
                'refresh_sales_notifications_mv_job',
                '*/5 * * * *',
                'REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_notifications_mv;'
            );
        END IF;
    END
    $DO$;
    """)


def downgrade():
    op.execute("""
    SELECT cron.unschedule('refresh_sales_lead_details_mv_job');
    SELECT cron.unschedule('refresh_sales_notifications_mv_job');
    """)
