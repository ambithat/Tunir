import json
import sys
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse

from app.dependency.auth_dependency import verify_access_token_dep_sse
from app.dependency.sales.sales_dashboard_dependency import get_sales_dashboard_service
from app.services.sales.sales_dashboard_service import SalesDashboardService, json_serializer
from app.utils.sse_manager import sse_manager
from app.core.config import logger

router = APIRouter(prefix="/sales/dashboard", tags=["Sales Dashboard & KPIs"])


@router.get("/kpis", summary="Get Overall Sales Dashboard KPI Metrics")
async def get_sales_dashboard_kpis(
    lead_owner_id: Optional[int] = Query(None, description="Optional lead owner ID filter"),
    service: SalesDashboardService = Depends(get_sales_dashboard_service)
):
    '''
    Returns initial overall aggregated KPI metrics:
    - total_leads
    - total_qualified
    - total_leads_in_negotiations
    - total_proposals_sent
    - lost_projects
    - total_pipeline_amount
    - total_won_revenue
    '''
    kpis = await service.get_kpis(lead_owner_id=lead_owner_id)
    return {
        "status": "success",
        "data": kpis
    }


@router.get("/kpis/by-status", summary="Get Total Count by Lead Status")
async def get_sales_dashboard_kpis_by_status(
    service: SalesDashboardService = Depends(get_sales_dashboard_service)
):
    '''
    Returns total count of leads grouped by status (e.g. New, Contacted, Qualified, Unqualified, Proposal Sent).
    '''
    by_status = await service.get_kpis_by_status()
    return {
        "status": "success",
        "total_statuses": len(by_status),
        "data": by_status
    }


@router.get("/kpis/by-stage", summary="Get Total Count by Lead Stage")
async def get_sales_dashboard_kpis_by_stage(
    service: SalesDashboardService = Depends(get_sales_dashboard_service)
):
    '''
    Returns total count of leads grouped by stage (e.g. Low, Medium, High, Negotiation, Won, Lost).
    '''
    by_stage = await service.get_kpis_by_stage()
    return {
        "status": "success",
        "total_stages": len(by_stage),
        "data": by_stage
    }


@router.get("/kpis/by-stage-by-product", summary="Get Product Breakdown Grouped by Lead Stage")
async def get_sales_dashboard_kpis_by_stage_by_product(
    service: SalesDashboardService = Depends(get_sales_dashboard_service)
):
    '''
    Returns product count distribution grouped by stage: { stage_name: { product_name: count } }.
    '''
    by_stage_product = await service.get_kpis_by_stage_by_product()
    return {
        "status": "success",
        "data": by_stage_product
    }


@router.get("/kpis/by-status-by-product", summary="Get Product Breakdown Grouped by Lead Status")
async def get_sales_dashboard_kpis_by_status_by_product(
    service: SalesDashboardService = Depends(get_sales_dashboard_service)
):
    '''
    Returns product count distribution grouped by status: { status_name: { product_name: count } }.
    '''
    by_status_product = await service.get_kpis_by_status_by_product()
    return {
        "status": "success",
        "data": by_status_product
    }


@router.get("/kpis/by-product", summary="Get Product KPI Breakdown")
async def get_kpis_by_product(
    service: SalesDashboardService = Depends(get_sales_dashboard_service)
):
    '''
    Returns product counts and total won/lost counts directly from sales.sales_lead_details_mv.
    '''
    info = await service.get_kpis_by_product()
    return {
        "status": "success",
        "data": info
    }


@router.get("/kpis/stage-distribution-by-pipeline", summary="Get Product-wise Stage Distribution by Pipeline")
async def get_stage_distribution_by_pipeline(
    service: SalesDashboardService = Depends(get_sales_dashboard_service)
):
    '''
    Returns product-wise stage distribution aggregated by pipeline amount directly from sales.sales_lead_details_mv.
    '''
    distribution = await service.get_stage_distribution_by_pipeline()
    return {
        "status": "success",
        "total_products": len(distribution),
        "data": distribution
    }




@router.get("/kpis/by-leader", summary="Get KPI Breakdown by Sales Leader ('More Info' view)")
async def get_sales_dashboard_kpis_by_leader(
    service: SalesDashboardService = Depends(get_sales_dashboard_service)
):
    '''
    Returns KPI breakdown grouped by Sales Leader/Owner ('More Info' button click):
    Includes lead_owner_id, lead_owner_name, lead_owner_email, total_leads, total_pipeline_amount, total_won_revenue, etc.
    '''
    breakdown = await service.get_kpis_by_leader()
    return {
        "status": "success",
        "total_leaders": len(breakdown),
        "data": breakdown
    }


@router.get("/details", summary="Get Joined Sales Lead Details")
async def get_sales_lead_details(
    lead_owner_id: Optional[int] = Query(None, description="Optional lead owner ID filter"),
    search: Optional[str] = Query(None, description="Search term for company, contact_name, designation, phone_no, email, country, lead_source, lead_owner_name, product_name, stage_name, status_name, lead_id"),
    service: SalesDashboardService = Depends(get_sales_dashboard_service)
):
    '''
    Returns complete joined table details from sales.sales_lead_details_mv with optional multi-field search:
    Includes lead_register, product_register, leaders, and status lookup tables.
    '''
    details = await service.get_lead_details(lead_owner_id=lead_owner_id, search=search)
    return {
        "status": "success",
        "total_records": len(details),
        "data": details
    }


from app.core.rate_limiter_config import limiter

@router.post("/refresh", summary="Concurrently Refresh Materialized View")
@limiter.limit("5/minute")
async def refresh_sales_dashboard_views(
    request: Request,
    service: SalesDashboardService = Depends(get_sales_dashboard_service)
):
    '''
    Manually triggers concurrent refresh of sales_lead_details_mv.
    '''
    try:
        await service.notify_sales_lead_update("lead_updated")
        return {
            "status": "success",
            "message": "Notification sent to sales_lead_update channel via SalesDashboardRepository."
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh materialized view: {str(e)}"
        )



