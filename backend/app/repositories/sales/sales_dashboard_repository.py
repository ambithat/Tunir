from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sales.sales_lead_details_mv import SalesLeadDetailsMV


class SalesDashboardRepository:
    '''
    Repository for sales dashboard operations using sales.sales_lead_details_mv.
    '''
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_lead_details(self, lead_owner_id: Optional[int] = None, search: Optional[str] = None) -> List[SalesLeadDetailsMV]:
        '''
        Fetches joined lead details from sales.sales_lead_details_mv with optional multi-field search.
        '''
        from sqlalchemy import or_

        stmt = select(SalesLeadDetailsMV).where(SalesLeadDetailsMV.lead_is_active == True)
        if lead_owner_id is not None:
            stmt = stmt.where(SalesLeadDetailsMV.lead_owner_id == lead_owner_id)
        
        if search:
            search_pattern = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    SalesLeadDetailsMV.company.ilike(search_pattern),
                    SalesLeadDetailsMV.contact_name.ilike(search_pattern),
                    SalesLeadDetailsMV.lead_owner_name.ilike(search_pattern),
                    SalesLeadDetailsMV.product_name.ilike(search_pattern),
                    SalesLeadDetailsMV.stage_name.ilike(search_pattern),
                    SalesLeadDetailsMV.status_name.ilike(search_pattern),
                    SalesLeadDetailsMV.designation.ilike(search_pattern),
                    SalesLeadDetailsMV.phone_no.ilike(search_pattern),
                    SalesLeadDetailsMV.email.ilike(search_pattern),
                    SalesLeadDetailsMV.country.ilike(search_pattern),
                    SalesLeadDetailsMV.lead_source.ilike(search_pattern),
                )
            )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_kpis_summary(self, lead_owner_id: Optional[int] = None) -> Dict[str, Any]:
        '''
        Computes overall aggregated KPI metrics directly from sales.sales_lead_details_mv.
        '''
        where_clause = "WHERE lead_is_active = TRUE"
        params = {}
        if lead_owner_id is not None:
            where_clause += " AND lead_owner_id = :lead_owner_id"
            params["lead_owner_id"] = lead_owner_id

        sql = f'''
        SELECT
            COUNT(DISTINCT lead_id) AS total_leads,
            COUNT(DISTINCT CASE WHEN LOWER(status_name) LIKE '%qualified%' THEN lead_id END) AS total_qualified,
            COUNT(DISTINCT CASE WHEN LOWER(stage_name) LIKE '%negotiation%' THEN lead_id END) AS total_leads_in_negotiations,
            COUNT(DISTINCT CASE WHEN LOWER(status_name) LIKE '%proposal%' THEN lead_id END) AS total_proposals_sent,
            COUNT(DISTINCT CASE WHEN LOWER(stage_name) LIKE '%lost%' THEN lead_id END) AS lost_projects,

            COALESCE(SUM(CASE WHEN LOWER(status_name) LIKE '%qualified%' THEN project_value ELSE 0 END), 0.00) AS qualified_project_value,
            COALESCE(SUM(CASE WHEN LOWER(status_name) LIKE '%qualified%' THEN pipeline ELSE 0 END), 0.00) AS qualified_pipeline_amount,

            COALESCE(SUM(CASE WHEN LOWER(status_name) LIKE '%proposal%' THEN project_value ELSE 0 END), 0.00) AS proposal_sent_project_value,
            COALESCE(SUM(CASE WHEN LOWER(status_name) LIKE '%proposal%' THEN pipeline ELSE 0 END), 0.00) AS proposal_sent_pipeline_amount,

            COALESCE(SUM(CASE WHEN LOWER(stage_name) LIKE '%negotiation%' THEN project_value ELSE 0 END), 0.00) AS negotiation_project_value,
            COALESCE(SUM(CASE WHEN LOWER(stage_name) LIKE '%negotiation%' THEN pipeline ELSE 0 END), 0.00) AS negotiation_pipeline_amount,

            COALESCE(SUM(CASE WHEN LOWER(stage_name) LIKE '%lost%' THEN project_value ELSE 0 END), 0.00) AS lost_project_value,
            COALESCE(SUM(CASE WHEN LOWER(stage_name) LIKE '%lost%' THEN pipeline ELSE 0 END), 0.00) AS lost_pipeline_amount,

            COALESCE(SUM(project_value), 0.00) AS total_project_value,
            COALESCE(SUM(pipeline), 0.00) AS total_pipeline_amount,
            COALESCE(SUM(CASE WHEN LOWER(stage_name) LIKE '%won%' THEN COALESCE(pipeline, project_value, 0) ELSE 0 END), 0.00) AS total_won_revenue,
            MAX(last_refreshed_at) AS last_refreshed_at
        FROM sales.sales_lead_details_mv
        {where_clause};
        '''

        result = await self.session.execute(text(sql), params)
        row = result.fetchone()

        if row:
            m = row._mapping
            t_leads = m["total_leads"] or 0
            t_qualified = m["total_qualified"] or 0
            t_negotiations = m["total_leads_in_negotiations"] or 0
            t_proposals = m["total_proposals_sent"] or 0
            t_lost = m["lost_projects"] or 0

            q_pv = float(m["qualified_project_value"] or 0.0)
            q_pipe = float(m["qualified_pipeline_amount"] or 0.0)

            prop_pv = float(m["proposal_sent_project_value"] or 0.0)
            prop_pipe = float(m["proposal_sent_pipeline_amount"] or 0.0)

            neg_pv = float(m["negotiation_project_value"] or 0.0)
            neg_pipe = float(m["negotiation_pipeline_amount"] or 0.0)

            lost_pv = float(m["lost_project_value"] or 0.0)
            lost_pipe = float(m["lost_pipeline_amount"] or 0.0)

            t_project_val = float(m["total_project_value"] or 0.0)
            t_pipeline = float(m["total_pipeline_amount"] or 0.0)
            t_won = float(m["total_won_revenue"] or 0.0)

            qualified_pct = round((t_qualified / t_leads * 100.0), 2) if t_leads > 0 else 0.0
            negotiation_pct = round((t_negotiations / t_leads * 100.0), 2) if t_leads > 0 else 0.0
            proposal_sent_pct = round((t_proposals / t_leads * 100.0), 2) if t_leads > 0 else 0.0
            lost_pct = round((t_lost / t_leads * 100.0), 2) if t_leads > 0 else 0.0

            pipeline_pct = round((t_pipeline / t_project_val * 100.0), 2) if t_project_val > 0 else 0.0
            won_revenue_pct = round((t_won / t_project_val * 100.0), 2) if t_project_val > 0 else 0.0

            return {
                "total_leads": t_leads,
                "total_qualified": t_qualified,
                "qualified_percentage": qualified_pct,
                "qualified_project_value": q_pv,
                "qualified_pipeline_amount": q_pipe,
                "total_leads_in_negotiations": t_negotiations,
                "negotiations_percentage": negotiation_pct,
                "negotiation_project_value": neg_pv,
                "negotiation_pipeline_amount": neg_pipe,
                "total_proposals_sent": t_proposals,
                "proposals_sent_percentage": proposal_sent_pct,
                "proposal_sent_project_value": prop_pv,
                "proposal_sent_pipeline_amount": prop_pipe,
                "lost_projects": t_lost,
                "lost_percentage": lost_pct,
                "lost_project_value": lost_pv,
                "lost_pipeline_amount": lost_pipe,
                "total_project_value": t_project_val,
                "total_pipeline_amount": t_pipeline,
                "pipeline_amount_percentage": pipeline_pct,
                "total_won_revenue": t_won,
                "won_revenue_percentage": won_revenue_pct,
                "last_refreshed_at": m["last_refreshed_at"].isoformat() if m["last_refreshed_at"] else datetime.now().isoformat()
            }

        return {
            "total_leads": 0,
            "total_qualified": 0,
            "qualified_percentage": 0.0,
            "qualified_project_value": 0.0,
            "qualified_pipeline_amount": 0.0,
            "total_leads_in_negotiations": 0,
            "negotiations_percentage": 0.0,
            "negotiation_project_value": 0.0,
            "negotiation_pipeline_amount": 0.0,
            "total_proposals_sent": 0,
            "proposals_sent_percentage": 0.0,
            "proposal_sent_project_value": 0.0,
            "proposal_sent_pipeline_amount": 0.0,
            "lost_projects": 0,
            "lost_percentage": 0.0,
            "lost_project_value": 0.0,
            "lost_pipeline_amount": 0.0,
            "total_project_value": 0.0,
            "total_pipeline_amount": 0.0,
            "pipeline_amount_percentage": 0.0,
            "total_won_revenue": 0.0,
            "won_revenue_percentage": 0.0,
            "last_refreshed_at": datetime.now().isoformat()
        }

    async def get_kpis_by_status(self) -> Dict[str, int]:
        '''
        Computes lead counts grouped by status as a key-value dictionary: { status_name: count }.
        '''
        sql = '''
        SELECT
            lps.status AS status_name,
            COUNT(DISTINCT mv.lead_id) AS total_count
        FROM statustype.lead_product_status lps
        LEFT JOIN sales.sales_lead_details_mv mv 
               ON mv.status_id = lps.id AND mv.lead_is_active = TRUE
        GROUP BY lps.id, lps.status
        ORDER BY lps.id ASC;
        '''
        result = await self.session.execute(text(sql))
        rows = result.fetchall()
        
        status_map = {r._mapping["status_name"]: (r._mapping["total_count"] or 0) for r in rows}

        # Check for unassigned status count
        unassigned_res = await self.session.execute(text('''
            SELECT COUNT(DISTINCT lead_id) FROM sales.sales_lead_details_mv 
            WHERE lead_is_active = TRUE AND (status_id IS NULL OR status_id = 0);
        '''))
        unassigned_cnt = unassigned_res.scalar() or 0
        if unassigned_cnt > 0:
            status_map["Unassigned"] = unassigned_cnt

        return status_map

    async def get_kpis_by_stage(self) -> Dict[str, int]:
        '''
        Computes lead counts grouped by stage as a key-value dictionary: { stage_name: count }.
        '''
        sql = '''
        SELECT
            lsst.leader_stage AS stage_name,
            COUNT(DISTINCT mv.lead_id) AS total_count
        FROM statustype.leader_stage_status_type lsst
        LEFT JOIN sales.sales_lead_details_mv mv 
               ON mv.stage_id = lsst.id AND mv.lead_is_active = TRUE
        GROUP BY lsst.id, lsst.leader_stage
        ORDER BY lsst.id ASC;
        '''
        result = await self.session.execute(text(sql))
        rows = result.fetchall()

        stage_map = {r._mapping["stage_name"]: (r._mapping["total_count"] or 0) for r in rows}

        # Check for unassigned stage count
        unassigned_res = await self.session.execute(text('''
            SELECT COUNT(DISTINCT lead_id) FROM sales.sales_lead_details_mv 
            WHERE lead_is_active = TRUE AND (stage_id IS NULL OR stage_id = 0);
        '''))
        unassigned_cnt = unassigned_res.scalar() or 0
        if unassigned_cnt > 0:
            stage_map["Unassigned"] = unassigned_cnt

        return stage_map

    async def get_kpis_by_stage_by_product(self) -> Dict[str, Dict[str, int]]:
        '''
        Computes product count distribution per stage: { stage_name: { product_name: count } }.
        '''
        sql = '''
        SELECT
            COALESCE(lsst.leader_stage, 'Unassigned') AS stage_name,
            COALESCE(mv.product_name, 'Unassigned') AS product_name,
            COUNT(DISTINCT mv.product_register_id) AS total_count
        FROM statustype.leader_stage_status_type lsst
        LEFT JOIN sales.sales_lead_details_mv mv 
               ON mv.stage_id = lsst.id AND mv.lead_is_active = TRUE AND (mv.product_is_active = TRUE OR mv.product_is_active IS NULL)
        GROUP BY lsst.id, lsst.leader_stage, mv.product_name
        ORDER BY lsst.id ASC, mv.product_name ASC;
        '''
        result = await self.session.execute(text(sql))
        rows = result.fetchall()

        stage_product_map: Dict[str, Dict[str, int]] = {}
        for r in rows:
            m = r._mapping
            stage = m["stage_name"]
            prod = m["product_name"]
            cnt = m["total_count"] or 0

            if stage not in stage_product_map:
                stage_product_map[stage] = {}
            if prod != 'Unassigned' or cnt > 0:
                stage_product_map[stage][prod] = cnt

        return stage_product_map

    async def get_kpis_by_status_by_product(self) -> Dict[str, Dict[str, int]]:
        '''
        Computes product count distribution per status: { status_name: { product_name: count } }.
        '''
        sql = '''
        SELECT
            COALESCE(lps.status, 'Unassigned') AS status_name,
            COALESCE(mv.product_name, 'Unassigned') AS product_name,
            COUNT(DISTINCT mv.product_register_id) AS total_count
        FROM statustype.lead_product_status lps
        LEFT JOIN sales.sales_lead_details_mv mv 
               ON mv.status_id = lps.id AND mv.lead_is_active = TRUE AND (mv.product_is_active = TRUE OR mv.product_is_active IS NULL)
        GROUP BY lps.id, lps.status, mv.product_name
        ORDER BY lps.id ASC, mv.product_name ASC;
        '''
        result = await self.session.execute(text(sql))
        rows = result.fetchall()

        status_product_map: Dict[str, Dict[str, int]] = {}
        for r in rows:
            m = r._mapping
            status_nm = m["status_name"]
            prod = m["product_name"]
            cnt = m["total_count"] or 0

            if status_nm not in status_product_map:
                status_product_map[status_nm] = {}
            if prod != 'Unassigned' or cnt > 0:
                status_product_map[status_nm][prod] = cnt

        return status_product_map

    async def get_kpis_by_leader(self) -> List[Dict[str, Any]]:
        '''
        Computes comprehensive KPI breakdown per sales leader/owner for all dashboard cards
        (total leads, total project value, total pipeline, qualified leads/value/pipeline, negotiations, proposals, lost, won).
        '''
        sql = '''
        SELECT
            COALESCE(lead_owner_id, 'LDR-0000') AS lead_owner_id,
            COALESCE(lead_owner_name, 'Unassigned') AS lead_owner_name,
            COALESCE(lead_owner_email, '') AS lead_owner_email,

            COUNT(DISTINCT lead_id) AS total_leads,
            COALESCE(SUM(project_value), 0.00) AS total_project_value,
            COALESCE(SUM(pipeline), 0.00) AS total_pipeline_amount,

            COUNT(DISTINCT CASE WHEN LOWER(status_name) LIKE '%qualified%' THEN lead_id END) AS qualified,
            COALESCE(SUM(CASE WHEN LOWER(status_name) LIKE '%qualified%' THEN project_value ELSE 0 END), 0.00) AS qualified_project_value,
            COALESCE(SUM(CASE WHEN LOWER(status_name) LIKE '%qualified%' THEN pipeline ELSE 0 END), 0.00) AS qualified_pipeline_amount,

            COUNT(DISTINCT CASE WHEN LOWER(stage_name) LIKE '%negotiation%' THEN lead_id END) AS negotiation,
            COALESCE(SUM(CASE WHEN LOWER(stage_name) LIKE '%negotiation%' THEN project_value ELSE 0 END), 0.00) AS negotiation_project_value,
            COALESCE(SUM(CASE WHEN LOWER(stage_name) LIKE '%negotiation%' THEN pipeline ELSE 0 END), 0.00) AS negotiation_pipeline_amount,

            COUNT(DISTINCT CASE WHEN LOWER(status_name) LIKE '%proposal%' THEN lead_id END) AS proposal_sent,
            COALESCE(SUM(CASE WHEN LOWER(status_name) LIKE '%proposal%' THEN project_value ELSE 0 END), 0.00) AS proposal_sent_project_value,
            COALESCE(SUM(CASE WHEN LOWER(status_name) LIKE '%proposal%' THEN pipeline ELSE 0 END), 0.00) AS proposal_sent_pipeline_amount,

            COUNT(DISTINCT CASE WHEN LOWER(stage_name) LIKE '%lost%' THEN lead_id END) AS lost,
            COALESCE(SUM(CASE WHEN LOWER(stage_name) LIKE '%lost%' THEN project_value ELSE 0 END), 0.00) AS lost_project_value,
            COALESCE(SUM(CASE WHEN LOWER(stage_name) LIKE '%lost%' THEN pipeline ELSE 0 END), 0.00) AS lost_pipeline_amount,

            COUNT(DISTINCT CASE WHEN LOWER(stage_name) LIKE '%won%' THEN lead_id END) AS won,
            COALESCE(SUM(CASE WHEN LOWER(stage_name) LIKE '%won%' THEN project_value ELSE 0 END), 0.00) AS won_project_value,
            COALESCE(SUM(CASE WHEN LOWER(stage_name) LIKE '%won%' THEN COALESCE(pipeline, project_value, 0) ELSE 0 END), 0.00) AS total_won_revenue,

            MAX(last_refreshed_at) AS last_refreshed_at
        FROM sales.sales_lead_details_mv
        WHERE lead_is_active = TRUE
        GROUP BY lead_owner_id, lead_owner_name, lead_owner_email
        ORDER BY total_leads DESC;
        '''

        result = await self.session.execute(text(sql))
        rows = result.fetchall()
        
        breakdown = []
        for r in rows:
            m = r._mapping
            t_leads = m["total_leads"] or 0
            t_qualified = m["qualified"] or 0
            t_negotiation = m["negotiation"] or 0
            t_proposal = m["proposal_sent"] or 0
            t_lost = m["lost"] or 0
            t_won = m["won"] or 0

            t_pv = float(m["total_project_value"] or 0.0)
            t_pipe = float(m["total_pipeline_amount"] or 0.0)

            q_pv = float(m["qualified_project_value"] or 0.0)
            q_pipe = float(m["qualified_pipeline_amount"] or 0.0)

            neg_pv = float(m["negotiation_project_value"] or 0.0)
            neg_pipe = float(m["negotiation_pipeline_amount"] or 0.0)

            prop_pv = float(m["proposal_sent_project_value"] or 0.0)
            prop_pipe = float(m["proposal_sent_pipeline_amount"] or 0.0)

            lost_pv = float(m["lost_project_value"] or 0.0)
            lost_pipe = float(m["lost_pipeline_amount"] or 0.0)

            won_pv = float(m["won_project_value"] or 0.0)
            t_won_rev = float(m["total_won_revenue"] or 0.0)

            # Calculate percentages per leader
            q_pct = round((t_qualified / t_leads * 100.0), 2) if t_leads > 0 else 0.0
            neg_pct = round((t_negotiation / t_leads * 100.0), 2) if t_leads > 0 else 0.0
            prop_pct = round((t_proposal / t_leads * 100.0), 2) if t_leads > 0 else 0.0
            lost_pct = round((t_lost / t_leads * 100.0), 2) if t_leads > 0 else 0.0

            pipe_pct = round((t_pipe / t_pv * 100.0), 2) if t_pv > 0 else 0.0
            won_pct = round((t_won_rev / t_pv * 100.0), 2) if t_pv > 0 else 0.0

            breakdown.append({
                "lead_owner_id": m["lead_owner_id"],
                "lead_owner_name": m["lead_owner_name"],
                "lead_owner_email": m["lead_owner_email"],

                "total_leads": t_leads,
                "total_project_value": t_pv,
                "total_pipeline_amount": t_pipe,
                "pipeline_amount_percentage": pipe_pct,

                "qualified": t_qualified,
                "qualified_percentage": q_pct,
                "qualified_project_value": q_pv,
                "qualified_pipeline_amount": q_pipe,

                "negotiation": t_negotiation,
                "negotiations_percentage": neg_pct,
                "negotiation_project_value": neg_pv,
                "negotiation_pipeline_amount": neg_pipe,

                "proposal_sent": t_proposal,
                "proposals_sent_percentage": prop_pct,
                "proposal_sent_project_value": prop_pv,
                "proposal_sent_pipeline_amount": prop_pipe,

                "lost": t_lost,
                "lost_percentage": lost_pct,
                "lost_project_value": lost_pv,
                "lost_pipeline_amount": lost_pipe,

                "won": t_won,
                "won_project_value": won_pv,
                "total_won_revenue": t_won_rev,
                "won_revenue_percentage": won_pct,

                "last_refreshed_at": m["last_refreshed_at"].isoformat() if m["last_refreshed_at"] else datetime.now().isoformat()
            })
        return breakdown

    async def get_stage_distribution_by_pipeline(self) -> List[Dict[str, Any]]:
        '''
        Computes product-wise stage/status distribution across pipeline directly from sales.sales_lead_details_mv.
        Output matches the "Pipeline Stage Levels" stacked chart UI (Proposal, Qualified, New/Contacted, etc.).
        '''
        sql = '''
        SELECT
            COALESCE(product_name, 'Unassigned') AS product_name,
            COALESCE(status_name, 'Unassigned') AS status_name,
            COALESCE(stage_name, 'Unassigned') AS stage_name,
            COUNT(DISTINCT lead_id) AS lead_count,
            COALESCE(SUM(pipeline), 0.00) AS total_pipeline_amount,
            COALESCE(SUM(COALESCE(pipeline, project_value, 0)), 0.00) AS total_value
        FROM sales.sales_lead_details_mv
        WHERE lead_is_active = TRUE AND (product_is_active = TRUE OR product_is_active IS NULL)
        GROUP BY product_name, status_name, stage_name
        ORDER BY product_name ASC;
        '''
        result = await self.session.execute(text(sql))
        rows = result.fetchall()

        prod_map: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            m = r._mapping
            p_name = m["product_name"]
            st_name = m["status_name"]
            sg_name = m["stage_name"]
            l_cnt = m["lead_count"] or 0
            pipe = float(m["total_pipeline_amount"] or 0.0)
            val = float(m["total_value"] or 0.0)

            if p_name not in prod_map:
                prod_map[p_name] = {
                    "product_name": p_name,
                    "total_pipeline_amount": 0.0,
                    "total_leads": 0,
                    "stages": [],
                    "statuses": []
                }

            prod_map[p_name]["total_pipeline_amount"] += pipe
            prod_map[p_name]["total_leads"] += l_cnt
            prod_map[p_name]["stages"].append({
                "stage_name": sg_name,
                "lead_count": l_cnt,
                "pipeline_amount": pipe,
                "total_value": val
            })
            prod_map[p_name]["statuses"].append({
                "status_name": st_name,
                "lead_count": l_cnt,
                "pipeline_amount": pipe
            })

        return list(prod_map.values())


    async def get_kpis_by_product(self) -> Dict[str, Any]:

        '''
        Computes product counts grouped by product_name, as well as total won
        and total lost counts DIRECTLY from sales.sales_lead_details_mv.
        '''
        # 1. Product counts from Materialized View
        sql_products = '''
        SELECT
            COALESCE(product_name, 'Unassigned') AS product_name,
            COUNT(DISTINCT product_register_id) AS total_count
        FROM sales.sales_lead_details_mv
        WHERE lead_is_active = TRUE AND (product_is_active = TRUE OR product_is_active IS NULL)
        GROUP BY product_name
        ORDER BY total_count DESC;
        '''
        res_prod = await self.session.execute(text(sql_products))
        product_counts = {r._mapping["product_name"]: r._mapping["total_count"] for r in res_prod.fetchall()}

        # 2. Product-wise Won and Lost counts from Materialized View
        sql_won_lost = '''
        SELECT
            COALESCE(product_name, 'Unassigned') AS product_name,
            COUNT(DISTINCT CASE WHEN LOWER(stage_name) LIKE '%won%' THEN product_register_id END) AS won_count,
            COUNT(DISTINCT CASE WHEN LOWER(stage_name) LIKE '%lost%' THEN product_register_id END) AS lost_count
        FROM sales.sales_lead_details_mv
        WHERE lead_is_active = TRUE AND (product_is_active = TRUE OR product_is_active IS NULL)
        GROUP BY product_name
        ORDER BY product_name ASC;
        '''
        res_wl = await self.session.execute(text(sql_won_lost))
        wl_rows = res_wl.fetchall()
        
        won_by_product = {r._mapping["product_name"]: (r._mapping["won_count"] or 0) for r in wl_rows}
        lost_by_product = {r._mapping["product_name"]: (r._mapping["lost_count"] or 0) for r in wl_rows}

        total_won = sum(won_by_product.values())
        total_lost = sum(lost_by_product.values())

        return {
            "by_product": product_counts,
            "won_count": total_won,
            "lost_count": total_lost,
            "won_count_by_product": won_by_product,
            "lost_count_by_product": lost_by_product
        }



    async def refresh_materialized_view(self) -> None:
        '''
        Executes concurrent refresh of sales.sales_lead_details_mv.
        '''
        await self.session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_lead_details_mv;"))
        await self.session.commit()

    async def refresh_notifications_materialized_view(self) -> None:
        '''
        Executes concurrent refresh of sales.sales_notifications_mv.
        '''
        await self.session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_notifications_mv;"))
        await self.session.commit()

    async def notify_sales_lead_update(self, payload: str = "lead_updated") -> None:
        '''
        Sends a PostgreSQL pg_notify on the 'sales_lead_update' channel.
        Triggers background listener to refresh materialized view and stream SSE update.
        '''
        await self.session.execute(text("NOTIFY sales_lead_update, :payload;"), {"payload": payload})
        await self.session.commit()

