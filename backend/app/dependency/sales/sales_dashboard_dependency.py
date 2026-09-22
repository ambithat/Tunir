from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.repositories.sales.sales_dashboard_repository import SalesDashboardRepository
from app.services.sales.sales_dashboard_service import SalesDashboardService


def get_sales_dashboard_repository(
    db: AsyncSession = Depends(get_db)
) -> SalesDashboardRepository:
    return SalesDashboardRepository(db)


def get_sales_dashboard_service(
    repository: SalesDashboardRepository = Depends(get_sales_dashboard_repository),
) -> SalesDashboardService:
    return SalesDashboardService(repository)
