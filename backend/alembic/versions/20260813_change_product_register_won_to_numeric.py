"""change product_register won to numeric

Revision ID: 20260813_won_numeric
Revises: 20260813_shift_pv_ec_to_product
Create Date: 2026-08-13 13:52:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260813_won_numeric'
down_revision: Union[str, None] = '20260813_shift_pv_ec_to_product'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop MV depending on product_register.won
    op.execute("DROP MATERIALIZED VIEW IF EXISTS sales.sales_lead_details_mv CASCADE;")

    # 2. Alter column won from boolean to numeric(15, 2)
    # Convert existing boolean values: true -> project_value (or 0.00), false -> 0.00
    op.execute("""
        ALTER TABLE sales.product_register 
        ALTER COLUMN won DROP DEFAULT,
        ALTER COLUMN won TYPE numeric(15, 2) USING (
            CASE 
                WHEN won = TRUE THEN COALESCE(project_value, 0.00) 
                ELSE 0.00 
            END
        ),
        ALTER COLUMN won SET DEFAULT 0.00;
    """)

    # 3. Recreate Materialized View sales.sales_lead_details_mv
    op.execute("""
        CREATE MATERIALIZED VIEW sales.sales_lead_details_mv AS
        SELECT
            lr.lead_id,
            lr.company,
            lr.contact_name,
            lr.designation,
            lr.phone_no,
            lr.email,
            lr.country,
            lr.lead_source,
            lr.is_active AS lead_is_active,
            lr.created_date AS lead_created_date,
            lr.lead_owner_id,
            TRIM(CONCAT_WS(' ', l.first_name, l.last_name)) AS lead_owner_name,
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
            pr.project_value,
            pr.expected_closure,
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

    # 4. Re-create Unique Index
    op.execute("""
        CREATE UNIQUE INDEX idx_sales_lead_details_mv_pk 
        ON sales.sales_lead_details_mv (lead_id, product_register_id);
    """)

    # 5. Re-create notify trigger
    op.execute("DROP TRIGGER IF EXISTS trg_product_register_change ON sales.product_register;")
    op.execute("""
        CREATE TRIGGER trg_product_register_change
        AFTER INSERT OR UPDATE OR DELETE ON sales.product_register
        FOR EACH STATEMENT EXECUTE FUNCTION sales.notify_sales_lead_change();
    """)


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS sales.sales_lead_details_mv CASCADE;")
    op.execute("""
        ALTER TABLE sales.product_register 
        ALTER COLUMN won DROP DEFAULT,
        ALTER COLUMN won TYPE boolean USING (
            CASE WHEN won > 0 THEN TRUE ELSE FALSE END
        ),
        ALTER COLUMN won SET DEFAULT FALSE;
    """)
    op.execute("""
        CREATE MATERIALIZED VIEW sales.sales_lead_details_mv AS
        SELECT
            lr.lead_id,
            lr.company,
            lr.contact_name,
            lr.designation,
            lr.phone_no,
            lr.email,
            lr.country,
            lr.lead_source,
            lr.is_active AS lead_is_active,
            lr.created_date AS lead_created_date,
            lr.lead_owner_id,
            TRIM(CONCAT_WS(' ', l.first_name, l.last_name)) AS lead_owner_name,
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
            pr.project_value,
            pr.expected_closure,
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
    op.execute("CREATE UNIQUE INDEX idx_sales_lead_details_mv_pk ON sales.sales_lead_details_mv (lead_id, product_register_id);")
