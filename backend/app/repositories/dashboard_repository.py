import json
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession


class DashboardRepository():
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _fetch_global_data(self, stmt):
        result = await self.session.execute(stmt)
        return result.mappings().first()

    async def _fetch_project_rows(self, stmt):
        result = await self.session.execute(stmt)
        return result.mappings().all()

    async def get_dashboard_stats(self):
        try:
            global_stmt = text("""
                SELECT 
                    COALESCE(SUM(total), 0) as total_val, 
                    COALESCE(SUM(quantity), 0) as total_qty 
                FROM procurement_table
            """)

            project_stmt = text("""
                SELECT 
                    product_name,
                    COALESCE(SUM(total), 0) as total_value,
                    COALESCE(SUM(quantity), 0) as target_total,
                    COALESCE(SUM(CASE WHEN assigned_to is not null THEN quantity ELSE 0 END), 0) as currently_procured
                FROM procurement_table
                WHERE product_name NOT ILIKE '%off%'
                GROUP BY product_name
                ORDER BY product_name ASC
            """)

            global_data = await self._fetch_global_data(global_stmt)
            project_rows = await self._fetch_project_rows(project_stmt)

            project_cards = []
            for row in project_rows:
                p_name = row['product_name']
                procured = row['currently_procured']
                target = row['target_total']

                project_cards.append({
                    "product_name": p_name,
                    "total_value_raw": float(row['total_value']),
                    "total_qty_raw": int(target),
                    "procured_display": f"{procured} / {target}",
                })

            return {
                "total_procurement_value": float(global_data["total_val"]),
                "total_quantity_procured": int(global_data["total_qty"]),
                "project_cards": project_cards
            }

        except SQLAlchemyError as e:
            await self.session.rollback()
            print(f"Warning: Dashboard Service Error, returning default stats: {e}")
            return {
                "total_procurement_value": 0.0,
                "total_quantity_procured": 0,
                "project_cards": []
            }

    async def raise_pg_notify(self, payload: dict) -> bool:
        try:
            await self.session.execute(
                text("SELECT pg_notify('new_notification', :payload)"),
                {"payload": json.dumps(payload)},
            )
            await self.session.commit()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while raising pg_notify: {str(e)}")

    async def get_bom_inventory_dashboard(self):
        try:
            stmt = text("""
                SELECT
                    product_id,
                    product_name,
                    part_id,
                    part_name,
                    required_qty,
                    available_qty,
                    shortage_qty
                FROM dashboard.bom_inventory_availability
                ORDER BY product_name, part_name;
            """)
            result = await self.session.execute(stmt)
            return result.mappings().all()
        except SQLAlchemyError as e:
            await self.session.rollback()
            print(f"[DashboardRepository] BOM view missing/inaccessible: {e}")
            return []

    async def get_production_dashboard_summary(self):
        try:
            stmt = text("""
                SELECT
                    production_order.product_id,
                    COALESCE(product.product_name, production_order.product_id) AS product_name,
                    COUNT(*) AS total_orders,
                    COUNT(*) FILTER (
                        WHERE production_order.status::text = 'IN_PROGRESS'
                    ) AS production_in_progress
                FROM production.production_orders AS production_order
                LEFT JOIN master.products AS product
                    ON product.product_id = production_order.product_id
                GROUP BY production_order.product_id, product.product_name
                ORDER BY product_name, production_order.product_id;
            """)
            result = await self.session.execute(stmt)
            return result.mappings().all()
        except SQLAlchemyError as e:
            await self.session.rollback()
            print(f"[DashboardRepository] Production view missing/inaccessible: {e}")
            return []
