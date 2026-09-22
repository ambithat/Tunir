"""migrate_sales_pks_to_string_sequences

Revision ID: 20260811_sales_str_pks
Revises: 20260811_sales_notifications
Create Date: 2026-08-11 12:08:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260811_sales_str_pks'
down_revision: Union[str, None] = '20260811_sales_notifications'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create PostgreSQL sequences for formatted primary keys
    op.execute("CREATE SEQUENCE IF NOT EXISTS sales.leader_id_seq START WITH 1 INCREMENT BY 1;")
    op.execute("CREATE SEQUENCE IF NOT EXISTS sales.lead_id_seq START WITH 1 INCREMENT BY 1;")
    op.execute("CREATE SEQUENCE IF NOT EXISTS sales.product_register_id_seq START WITH 1 INCREMENT BY 1;")
    op.execute("CREATE SEQUENCE IF NOT EXISTS sales.contact_id_seq START WITH 1 INCREMENT BY 1;")
    op.execute("CREATE SEQUENCE IF NOT EXISTS sales.sales_notification_id_seq START WITH 1 INCREMENT BY 1;")

    # 2. Ensure sales_notifications table exists with NTF- formatted primary key sequence
    op.execute("""
        CREATE TABLE IF NOT EXISTS sales.sales_notifications (
            notification_id TEXT PRIMARY KEY DEFAULT concat('NTF-', to_char(nextval('sales.sales_notification_id_seq'), 'FM0000')),
            user_id TEXT NOT NULL,
            id TEXT NOT NULL,
            notification_type TEXT NOT NULL DEFAULT 'STAGE_UPDATE',
            message TEXT NOT NULL,
            is_viewed BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_sales_notification_type ON sales.sales_notifications(notification_type);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sales_notification_user_viewed ON sales.sales_notifications(user_id, is_viewed);")

    # 3. Drop dependent Materialized View
    op.execute("DROP MATERIALIZED VIEW IF EXISTS sales.sales_lead_details_mv CASCADE;")


    # 3. Drop Foreign Key constraints before altering column types
    op.execute("ALTER TABLE sales.lead_activity_register DROP CONSTRAINT IF EXISTS lead_activity_register_lead_id_fkey;")
    op.execute("ALTER TABLE sales.lead_activity_register DROP CONSTRAINT IF EXISTS lead_activity_register_lead_owner_id_fkey;")
    op.execute("ALTER TABLE sales.product_register DROP CONSTRAINT IF EXISTS product_register_lead_id_fkey;")
    op.execute("ALTER TABLE sales.lead_register DROP CONSTRAINT IF EXISTS lead_register_lead_owner_id_fkey;")
    op.execute("ALTER TABLE sales.sales_notifications DROP CONSTRAINT IF EXISTS sales_notifications_user_id_fkey;")

    # 4. Alter column types to TEXT with sequence formatting
    op.execute("ALTER TABLE sales.leaders ALTER COLUMN leader_id TYPE TEXT USING concat('LDR-', to_char(leader_id, 'FM0000'));")
    op.execute("ALTER TABLE sales.lead_register ALTER COLUMN lead_id TYPE TEXT USING concat('LD-', to_char(lead_id, 'FM0000'));")
    op.execute("ALTER TABLE sales.lead_register ALTER COLUMN lead_owner_id TYPE TEXT USING CASE WHEN lead_owner_id IS NOT NULL THEN concat('LDR-', to_char(lead_owner_id, 'FM0000')) ELSE NULL END;")
    op.execute("ALTER TABLE sales.product_register ALTER COLUMN product_register_id TYPE TEXT USING concat('PRD-', to_char(product_register_id, 'FM0000'));")
    op.execute("ALTER TABLE sales.product_register ALTER COLUMN lead_id TYPE TEXT USING concat('LD-', to_char(lead_id, 'FM0000'));")
    op.execute("ALTER TABLE sales.contacts ALTER COLUMN contact_id TYPE TEXT USING concat('CNT-', to_char(contact_id, 'FM0000'));")
    op.execute("ALTER TABLE sales.lead_activity_register ALTER COLUMN lead_id TYPE TEXT USING concat('LD-', to_char(lead_id, 'FM0000'));")
    op.execute("ALTER TABLE sales.lead_activity_register ALTER COLUMN lead_owner_id TYPE TEXT USING CASE WHEN lead_owner_id IS NOT NULL THEN concat('LDR-', to_char(lead_owner_id, 'FM0000')) ELSE NULL END;")

    # 5. Set default server expressions for auto-generating formatted IDs
    op.execute("ALTER TABLE sales.leaders ALTER COLUMN leader_id SET DEFAULT concat('LDR-', to_char(nextval('sales.leader_id_seq'), 'FM0000'));")
    op.execute("ALTER TABLE sales.lead_register ALTER COLUMN lead_id SET DEFAULT concat('LD-', to_char(nextval('sales.lead_id_seq'), 'FM0000'));")
    op.execute("ALTER TABLE sales.product_register ALTER COLUMN product_register_id SET DEFAULT concat('PRD-', to_char(nextval('sales.product_register_id_seq'), 'FM0000'));")
    op.execute("ALTER TABLE sales.contacts ALTER COLUMN contact_id SET DEFAULT concat('CNT-', to_char(nextval('sales.contact_id_seq'), 'FM0000'));")

    # 6. Re-add Foreign Key constraints
    op.execute("ALTER TABLE sales.lead_register ADD CONSTRAINT lead_register_lead_owner_id_fkey FOREIGN KEY (lead_owner_id) REFERENCES sales.leaders(leader_id) ON DELETE SET NULL;")
    op.execute("ALTER TABLE sales.product_register ADD CONSTRAINT product_register_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES sales.lead_register(lead_id) ON DELETE CASCADE;")
    op.execute("ALTER TABLE sales.lead_activity_register ADD CONSTRAINT lead_activity_register_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES sales.lead_register(lead_id) ON DELETE CASCADE;")
    op.execute("ALTER TABLE sales.lead_activity_register ADD CONSTRAINT lead_activity_register_lead_owner_id_fkey FOREIGN KEY (lead_owner_id) REFERENCES sales.leaders(leader_id) ON DELETE SET NULL;")
    op.execute("ALTER TABLE sales.sales_notifications ADD CONSTRAINT sales_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES sales.leaders(emp_id) ON DELETE CASCADE;")

    # 7. Recreate Materialized View sales.sales_lead_details_mv with string types
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
        CREATE UNIQUE INDEX idx_sales_lead_details_mv_pk ON sales.sales_lead_details_mv (lead_id, product_register_id);
    """)


def downgrade() -> None:
    pass
