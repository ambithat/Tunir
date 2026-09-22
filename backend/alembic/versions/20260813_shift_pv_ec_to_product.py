"""shift_pv_ec_to_product

Revision ID: 20260813_shift_pv_ec_to_product
Revises: 20260812_sales_notif_mv
Create Date: 2026-08-13 09:47:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260813_shift_pv_ec_to_product'
down_revision: Union[str, None] = '20260812_sales_notif_mv'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop materialized view sales_lead_details_mv first before changing columns
    op.execute("DROP MATERIALIZED VIEW IF EXISTS sales.sales_lead_details_mv CASCADE;")

    # 2. Drop project_value and expected_closure from sales.lead_register
    op.drop_column('lead_register', 'project_value', schema='sales')
    op.drop_column('lead_register', 'expected_closure', schema='sales')

    # 3. Add project_value and expected_closure to sales.product_register
    op.add_column('product_register', sa.Column('project_value', sa.Numeric(precision=15, scale=2), nullable=True), schema='sales')
    op.add_column('product_register', sa.Column('expected_closure', sa.Date(), nullable=True), schema='sales')

    # 4. Recreate Materialized View sales.sales_lead_details_mv referencing product_register's project_value & expected_closure
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

    # 5. Recreate unique index on lead_id, product_register_id
    op.execute("""
        CREATE UNIQUE INDEX idx_sales_lead_details_mv_pk 
        ON sales.sales_lead_details_mv (lead_id, product_register_id);
    """)

    # 6. Recreate trigger on lead_register and product_register for sales_lead_update
    op.execute("""
        CREATE OR REPLACE FUNCTION sales.notify_sales_lead_change()
        RETURNS trigger AS $$
        BEGIN
            PERFORM pg_notify('sales_lead_update', json_build_object(
                'table', TG_TABLE_NAME,
                'action', TG_OP,
                'lead_id', COALESCE(NEW.lead_id, OLD.lead_id)
            )::text);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("DROP TRIGGER IF EXISTS trg_lead_register_change ON sales.lead_register;")
    op.execute("""
        CREATE TRIGGER trg_lead_register_change
        AFTER INSERT OR UPDATE OR DELETE ON sales.lead_register
        FOR EACH ROW EXECUTE FUNCTION sales.notify_sales_lead_change();
    """)

    op.execute("DROP TRIGGER IF EXISTS trg_product_register_change ON sales.product_register;")
    op.execute("""
        CREATE TRIGGER trg_product_register_change
        AFTER INSERT OR UPDATE OR DELETE ON sales.product_register
        FOR EACH ROW EXECUTE FUNCTION sales.notify_sales_lead_change();
    """)


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS sales.sales_lead_details_mv CASCADE;")
    op.drop_column('product_register', 'expected_closure', schema='sales')
    op.drop_column('product_register', 'project_value', schema='sales')
    op.add_column('lead_register', sa.Column('expected_closure', sa.Date(), nullable=True), schema='sales')
    op.add_column('lead_register', sa.Column('project_value', sa.Numeric(precision=15, scale=2), nullable=True), schema='sales')
