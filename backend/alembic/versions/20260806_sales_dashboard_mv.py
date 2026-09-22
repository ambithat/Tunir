"""sales_dashboard_mv

Revision ID: 20260806_sales_dashboard_mv
Revises: 20260806_init_sales_schema
Create Date: 2026-08-06 16:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260806_sales_dashboard_mv'
down_revision: Union[str, None] = '20260806_init_sales_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop legacy aggregated view if exists
    op.execute("DROP MATERIALIZED VIEW IF EXISTS sales.sales_dashboard_kpis_mv CASCADE;")

    # 1. Create Single Detailed Materialized View with all table joins
    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS sales.sales_lead_details_mv AS
        SELECT
            lr.lead_id,
            lr.company,
            lr.contact_name,
            lr.designation,
            lr.phone_no,
            lr.email,
            lr.country,
            lr.lead_source,
            lr.project_value,
            lr.expected_closure,
            lr.is_active AS lead_is_active,
            lr.created_date AS lead_created_date,
            lr.lead_owner_id,
            CONCAT_WS(' ', l.first_name, l.last_name) AS lead_owner_name,
            l.email AS lead_owner_email,
            
            COALESCE(pr.product_register_id::text, 'PRD-0000') AS product_register_id,

            pr.product_id,
            pt.product AS product_name,
            pr.quantity,
            pr.status_id,
            lps.status AS status_name,
            pr.stage_id,
            lsst.leader_stage AS stage_name,
            pr.probability,
            pr.won,
            pr.pipeline,
            pr.risk_matrix,
            pr.is_active AS product_is_active,
            pr.created_at AS product_created_at,
            NOW() AS last_refreshed_at
        FROM sales.lead_register lr
        LEFT JOIN sales.leaders l ON lr.lead_owner_id = l.leader_id
        LEFT JOIN sales.product_register pr ON lr.lead_id = pr.lead_id
        LEFT JOIN statustype.product_status_type pt ON pr.product_id = pt.id
        LEFT JOIN statustype.lead_product_status lps ON pr.status_id = lps.id
        LEFT JOIN statustype.leader_stage_status_type lsst ON pr.stage_id = lsst.id;
    """)

    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_lead_details_mv_pk 
        ON sales.sales_lead_details_mv (lead_id, product_register_id);
    """)

    # 2. Create PG Notification Function & Triggers for pg_notify
    op.execute("""
        CREATE OR REPLACE FUNCTION sales.notify_sales_lead_change()
        RETURNS trigger AS $$
        BEGIN
            PERFORM pg_notify(
                'sales_lead_update',
                json_build_object(
                    'table', TG_TABLE_NAME,
                    'action', TG_OP,
                    'lead_id', COALESCE(NEW.lead_id, OLD.lead_id)
                )::text
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("DROP TRIGGER IF EXISTS trg_sales_lead_register_change ON sales.lead_register;")
    op.execute("""
        CREATE TRIGGER trg_sales_lead_register_change
        AFTER INSERT OR UPDATE OR DELETE ON sales.lead_register
        FOR EACH ROW EXECUTE FUNCTION sales.notify_sales_lead_change();
    """)

    op.execute("DROP TRIGGER IF EXISTS trg_sales_product_register_change ON sales.product_register;")
    op.execute("""
        CREATE TRIGGER trg_sales_product_register_change
        AFTER INSERT OR UPDATE OR DELETE ON sales.product_register
        FOR EACH ROW EXECUTE FUNCTION sales.notify_sales_lead_change();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_sales_product_register_change ON sales.product_register;")
    op.execute("DROP TRIGGER IF EXISTS trg_sales_lead_register_change ON sales.lead_register;")
    op.execute("DROP FUNCTION IF EXISTS sales.notify_sales_lead_change();")

    op.execute("DROP INDEX IF EXISTS sales.idx_sales_lead_details_mv_pk;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS sales.sales_lead_details_mv;")
