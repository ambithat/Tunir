from fastapi import APIRouter, Depends
from app.api.routes.auth import auth_router

# 2. Tracking Routes
from app.api.routes.tracking_routes.tracker import tracker_router
from app.api.routes.tracking_routes.notification import notification_router

# 3. Sales Routes
from app.api.routes.sales_routes.leader_api import leader_router
from app.api.routes.sales_routes.sales_dashboard_api import router as sales_dashboard_router
from app.api.routes.sales_routes.lead_register_api import lead_register_router
from app.api.routes.sales_routes.lead_activity_register_api import lead_activity_register_router, activity_router
from app.api.routes.sales_routes.contact_api import contact_router
from app.api.routes.sales_routes.leader_reassignment_history_api import reassignment_history_router
from app.api.routes.sales_routes.weekly_pdf_register_api import weekly_pdf_register_router

# 4. StatusType Module
from app.api.routes.statustype_routes.statustype_api import statustype_router

from app.dependency.auth_dependency import verify_access_token_dep

api_router = APIRouter()
protected_router = APIRouter(dependencies=[Depends(verify_access_token_dep)])

# Public Authentication Endpoint
api_router.include_router(auth_router, tags=["Authentication"])

# 2. Tracking Module
protected_router.include_router(tracker_router, tags=["Tracker"])
protected_router.include_router(notification_router, tags=["Notifications"])

# 3. Sales Module
protected_router.include_router(leader_router, tags=["Leader API"])
protected_router.include_router(reassignment_history_router, tags=["Leader Reassignment History API"])

protected_router.include_router(lead_register_router, tags=["Lead Register"])
protected_router.include_router(lead_activity_register_router, tags=["Lead Activity Register"])
protected_router.include_router(activity_router, tags=["Lead Activity Register"])
protected_router.include_router(contact_router, tags=["Contact API"])

protected_router.include_router(sales_dashboard_router, tags=["Sales Dashboard & KPIs"])
protected_router.include_router(weekly_pdf_register_router, tags=["Weekly PDF Register"])

# 5. Login History & Screen Time
from app.api.routes.application_table_routes.login_history import login_history_router

# 4. StatusType Module
protected_router.include_router(statustype_router)
protected_router.include_router(login_history_router, tags=["Login History & Screen Time"])

api_router.include_router(protected_router)
