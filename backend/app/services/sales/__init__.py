import sys

# Import subpackages
from app.services.sales.email import mail_event_service, lead_reminder_service
from app.services.sales.pdf import weekly_report_service, weekly_pdf_register_service
from app.services.sales.core import (
    lead_register_service,
    lead_activity_register_service,
    contact_service,
    leader_service,
    sales_dashboard_service,
)

# Direct exports
from app.services.sales.email.mail_event_service import (
    queue_mail_event,
    process_pending_mail_events,
)
from app.services.sales.email.lead_reminder_service import (
    fetch_and_push_today_lead_action_reminders,
    check_and_push_overdue_lead_activities,
)
from app.services.sales.pdf.weekly_report_service import (
    generate_weekly_report_pdf,
    generate_and_send_weekly_sales_report,
    start_weekly_report_cron,
)
from app.services.sales.pdf.weekly_pdf_register_service import WeeklyPdfRegisterService

from app.services.sales.core.lead_register_service import LeadRegisterService
from app.services.sales.core.lead_activity_register_service import LeadActivityRegisterService
from app.services.sales.core.contact_service import ContactService
from app.services.sales.core.leader_service import LeaderService
from app.services.sales.core.sales_dashboard_service import SalesDashboardService, start_sales_dashboard_cron

# Backward-compatibility alias registration in sys.modules
sys.modules["app.services.sales.mail_event_service"] = mail_event_service
sys.modules["app.services.sales.lead_reminder_service"] = lead_reminder_service
sys.modules["app.services.sales.weekly_report_service"] = weekly_report_service
sys.modules["app.services.sales.weekly_pdf_register_service"] = weekly_pdf_register_service
sys.modules["app.services.sales.lead_register_service"] = lead_register_service
sys.modules["app.services.sales.lead_activity_register_service"] = lead_activity_register_service
sys.modules["app.services.sales.contact_service"] = contact_service
sys.modules["app.services.sales.leader_service"] = leader_service
sys.modules["app.services.sales.sales_dashboard_service"] = sales_dashboard_service
