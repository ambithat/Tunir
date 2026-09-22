import threading
from typing import Callable

import asyncio


from app.core.config import logger
from app.utils.sse_manager import start_pg_listener
from app.utils.embeddings import get_embedding_model

_pg_listener_task: asyncio.Task | None = None

# creating objects 
condition1 = threading.Condition()



def _startup_model() -> None:
    """
        _startup_model
    """
    try:
        pass

    except Exception as e:
        print(f"An exception error occurred from _startup_model method in the event_handlers module :",e)
        logger.error(f"An exception error occurred from _startup_model method in the event_handlers module :",e) 
    


from app.services.sales.sales_dashboard_service import (
    start_sales_lead_pg_listener,
)
from app.services.sales.weekly_report_service import start_weekly_report_cron

_sales_listener_task: asyncio.Task | None = None
_weekly_report_cron_task: asyncio.Task | None = None


def _shutdown_model() -> None:
    global _sales_listener_task, _weekly_report_cron_task
    print("Application shutting down ....")
    if _sales_listener_task and not _sales_listener_task.done():
        _sales_listener_task.cancel()
        print("[SalesDashboard] sales_listener task cancelled on shutdown")
    if _weekly_report_cron_task and not _weekly_report_cron_task.done():
        _weekly_report_cron_task.cancel()
        print("[WeeklyReport] weekly_report task cancelled on shutdown")


def start_app_handler(app) -> Callable:
    async def startup() -> None:                    # make this async
        global _sales_listener_task, _weekly_report_cron_task
        import os
        logger.info(f"Running app start handler in process {os.getpid()}")
        _startup_model()
        
        logger.info(f"Global embeddings will be lazy-loaded in process {os.getpid()}")

        # Start Sales Dashboard background listener and cron tasks only
        _sales_listener_task = asyncio.create_task(start_sales_lead_pg_listener())
        await start_weekly_report_cron()

        # Instantly pick up and process any unsent/pending/failed mail events on startup
        try:
            from app.services.sales.email.mail_event_service import process_pending_mail_events
            asyncio.create_task(process_pending_mail_events())
        except Exception as mail_err:
            logger.warning(f"[Startup Mail Worker Warning] {mail_err}")

        logger.info(f"[SalesDashboard & WeeklyReport] Background listener, APScheduler, and Mail worker started in process {os.getpid()}")
    return startup


def stop_app_handler() -> Callable:
    async def shutdown() -> None:                   # make this async too
        logger.info("Running app shutdown handler.")
        _shutdown_model()
    return shutdown    