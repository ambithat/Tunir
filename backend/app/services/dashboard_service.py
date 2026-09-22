import uuid
import csv
from decimal import Decimal
import json
from datetime import date, datetime, timezone
from typing import Optional
from pathlib import Path
from app.exceptions.tracking.notification_exception import NotificationNotFound
from app.repositories.dashboard_repository import DashboardRepository
from app.repositories.tracking.notification_repository import NotificationRepository
from app.services.tracking.tracker_service import TrackerService
from app.dependency.tracking.tracker_dependency import get_tracker_repo
from fastapi import HTTPException, status, Depends


class DashboardService:
    def __init__(
        self,
        dashboard_repository: DashboardRepository,
        notification_repository: Optional[NotificationRepository] = None,
    ):
        self.dashboard_repository = dashboard_repository
        self.notification_repository = notification_repository

    async def get_all_stats(self, tracker_service: TrackerService = None):
        """Fetches combined stats: Global Procurement Stats + (Optional) User's Tracker Counts."""
        try:
            stats = await self.dashboard_repository.get_dashboard_stats()
            print(f"Fetched global dashboard stats: {stats}")
            tracker_counts = await tracker_service.get_service_tracker_count()
            print(f"Fetched tracker counts: {tracker_counts}")
            stats["tracker_counts"] = tracker_counts
            print(f"Fetched dashboard stats: {stats}")
            return stats
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch dashboard stats: {str(e)}",
            )

    async def get_bom_inventory_dashboard(self):
        """Delegates BOM inventory dashboard query to dashboard_repository."""
        try:
            return await self.dashboard_repository.get_bom_inventory_dashboard()
        except Exception as e:
            print(f"[DashboardService] Failed to fetch BOM inventory dashboard: {e}")
            return None

    async def get_production_dashboard_summary(self):
        """Delegates production dashboard summary query to dashboard_repository."""
        try:
            return await self.dashboard_repository.get_production_dashboard_summary()
        except Exception as e:
            print(f"[DashboardService] Failed to fetch production dashboard summary: {e}")
            return None


    async def broadcast_dashboard_update(self, tracker_service: TrackerService):
        """Sends a lightweight 'trigger' to Postgres."""
        try:
            raw_stats = await self.dashboard_repository.get_dashboard_stats()
            tracker_counts = await tracker_service.get_service_tracker_count()
            raw_stats["tracker_counts"] = tracker_counts

            payload = {"type": "dashboard_update", "data": raw_stats}
            payload_json = json.dumps(payload)
            await self.dashboard_repository.publish_notification("dashboard_channel", payload_json)
        except Exception as e:
            print(f"[SSE Error] Failed to broadcast update: {e}")
