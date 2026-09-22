import logging
import json
from datetime import date, datetime
from typing import List, Optional
from sqlalchemy import text, func
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.db.base import get_main_engine
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.sales.lead_register import LeadRegister
from app.models.sales.lead_activity_register import LeadActivityRegister
from app.models.sales.sales_notification import SalesNotification
from app.models.sales.leader import Leader
from app.utils.sse_manager import sse_manager

logger = logging.getLogger(__name__)


async def fetch_and_push_today_lead_action_reminders(
    user_id: Optional[str] = None,
    db_session: Optional[AsyncSession] = None
) -> List[dict]:
    """
    1. If an active db_session is passed, commits pending updates first.
    2. Checks sales.lead_activity_register for items scheduled for today (activity_date == today).
    3. Triggers today's activity reminders once per day on login/creation.
    4. Triggers overdue checks for pending activities past 12 hours.
    """
    if db_session:
        try:
            await db_session.commit()
        except Exception as commit_err:
            logger.warning(f"[LeadReminderService] Session pre-commit warning: {commit_err}")

    engine = get_main_engine()
    today = date.today()
    pushed_notifications = []

    async with AsyncSession(engine) as session:
        # Step 1: Query today's active activities based on activity_date
        stmt = (
            select(LeadActivityRegister)
            .options(
                selectinload(LeadActivityRegister.lead).selectinload(LeadRegister.owner_leader),
                selectinload(LeadActivityRegister.owner_leader)
            )
            .where(
                LeadActivityRegister.is_active == True,
                LeadActivityRegister.activity_date == today,
                LeadActivityRegister.lead.has(LeadRegister.is_active == True)
            )
        )
        if user_id:
            stmt = stmt.where(
                (LeadActivityRegister.lead_owner_id == user_id) |
                (LeadActivityRegister.lead.has(LeadRegister.lead_owner_id == user_id)) |
                (LeadActivityRegister.owner_leader.has(Leader.emp_id == user_id)) |
                (LeadActivityRegister.lead.has(LeadRegister.owner_leader.has(Leader.emp_id == user_id)))
            )

        result = await session.execute(stmt)
        activities = list(result.scalars().all())

        inserted_any = False
        new_or_updated_notif_ids = []

        for act in activities:
            lead = act.lead
            owner = act.owner_leader or (lead.owner_leader if lead else None)
            if not owner or not lead:
                continue

            owner_emp_id = owner.emp_id
            contact_or_name = lead.contact_name or lead.lead_id
            company_name = lead.company or "N/A"
            action_val = getattr(act, "meeting_plan", None) or getattr(act, "summary", None) or getattr(act, "next_meeting_plan", None) or getattr(act, "next_action", None) or "Activity Scheduled Today"

            formatted_msg = (
                f"Lead Owner: {owner.full_name}, Company Name: {company_name}, "
                f"Contact Name: {contact_or_name}, Activity ID: {act.activity_id}, Scheduled Activity: {action_val}"
            )

            # Check if a notification exists for this activity & user
            existing_stmt = select(SalesNotification).where(
                SalesNotification.user_id == owner_emp_id,
                SalesNotification.id == act.activity_id,
                SalesNotification.notification_type == "LEAD_REMINDER"
            )
            ex_res = await session.execute(existing_stmt)
            existing_notif = ex_res.scalars().first()

            if existing_notif:
                notif_date = existing_notif.created_at.date() if existing_notif.created_at else None
                if notif_date and notif_date < today:
                    existing_notif.message = formatted_msg
                    existing_notif.is_viewed = False
                    existing_notif.created_at = datetime.now()
                    session.add(existing_notif)
                    inserted_any = True
                    new_or_updated_notif_ids.append(existing_notif.notification_id)
                else:
                    if existing_notif.message != formatted_msg:
                        existing_notif.message = formatted_msg
                        session.add(existing_notif)
                        inserted_any = True
            else:
                new_notif = SalesNotification(
                    user_id=owner_emp_id,
                    id=act.activity_id,
                    notification_type="LEAD_REMINDER",
                    message=formatted_msg,
                    is_viewed=False,
                    created_at=datetime.now()
                )
                session.add(new_notif)
                await session.flush()
                inserted_any = True
                new_or_updated_notif_ids.append(new_notif.notification_id)

        if inserted_any:
            await session.commit()
            try:
                await session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_notifications_mv;"))
                await session.commit()
            except Exception as refresh_err:
                logger.warning(f"[LeadReminderService] MV Refresh Warning: {refresh_err}")

        if new_or_updated_notif_ids:
            query_sql = """
                SELECT notification_id, user_id, first_name, last_name, email, designation,
                       target_id, notification_type, message, is_viewed, created_at, last_refreshed_at
                FROM sales.sales_notifications_mv
                WHERE is_viewed = FALSE
                  AND notification_type = 'LEAD_REMINDER'
                  AND notification_id = ANY(:notif_ids)
            """
            params = {"notif_ids": new_or_updated_notif_ids}
            if user_id:
                query_sql += " AND user_id = :uid"
                params["uid"] = user_id

            query_sql += " ORDER BY created_at DESC;"

            mv_res = await session.execute(text(query_sql), params)
            rows = [dict(r) for r in mv_res.mappings().all()]

            for row in rows:
                if isinstance(row.get("created_at"), (datetime, date)):
                    row["created_at"] = row["created_at"].isoformat()
                if isinstance(row.get("last_refreshed_at"), (datetime, date)):
                    row["last_refreshed_at"] = row["last_refreshed_at"].isoformat()

                notif_event = {
                    "event_type": "sales_notification",
                    "event": "sales_notification",
                    "notification_type": row.get("notification_type", "LEAD_REMINDER"),
                    "data": row
                }

                recipient_user_id = str(row["user_id"])
                await sse_manager.push(recipient_user_id, notif_event)
                pushed_notifications.append(row)
                logger.info(f"[SalesNotification MV SSE] Pushed notification {row['notification_id']} to user '{recipient_user_id}'")

    # Also run system-wide overdue checks for all activities pending past threshold
    try:
        await check_and_push_overdue_lead_activities(user_id=None)
        from app.services.sales.email.mail_event_service import process_pending_mail_events
        await process_pending_mail_events()
    except Exception as overdue_err:
        logger.warning(f"[LeadReminderService] Overdue check error: {overdue_err}")

    return pushed_notifications


async def check_and_push_overdue_lead_activities(user_id: Optional[str] = None) -> List[dict]:
    """
    Checks for activities in Pending status (action_status_id == 4) that have remained pending
    12+ hours past their activity_date start.
    Sends O365 email notification and in-app SSE notification to the particular lead owner.
    """
    from datetime import time, timedelta
    engine = get_main_engine()
    now = datetime.now()
    overdue_notifs = []

    async with AsyncSession(engine) as session:
        from app.models.sales.lead_register import ProductRegister
        from app.models.statustype.statustype import DailyActivityStatusType

        # Dynamic Status ID Lookup (by name) to protect against DB ID shifts
        async def _get_status_id(s_name: str, fallback_id: int) -> int:
            try:
                st = select(DailyActivityStatusType.id).where(func.lower(DailyActivityStatusType.action_status) == s_name.lower())
                r = await session.execute(st)
                fid = r.scalar_one_or_none()
                return fid if fid is not None else fallback_id
            except Exception:
                return fallback_id

        pending_status_id = await _get_status_id("pending", 4)
        overdue_status_id = await _get_status_id("overdue", 8)

        stmt = (
            select(LeadActivityRegister)
            .options(
                selectinload(LeadActivityRegister.lead).selectinload(LeadRegister.owner_leader),
                selectinload(LeadActivityRegister.lead).selectinload(LeadRegister.products).selectinload(ProductRegister.product_type),
                selectinload(LeadActivityRegister.owner_leader),
                selectinload(LeadActivityRegister.activity_type_status)
            )
            .where(
                LeadActivityRegister.is_active == True,
                LeadActivityRegister.action_status_id.in_([pending_status_id, overdue_status_id]),
                LeadActivityRegister.lead.has(LeadRegister.is_active == True)
            )
        )
        if user_id:
            stmt = stmt.where(
                (LeadActivityRegister.lead_owner_id == user_id) |
                (LeadActivityRegister.lead.has(LeadRegister.lead_owner_id == user_id)) |
                (LeadActivityRegister.owner_leader.has(Leader.emp_id == user_id)) |
                (LeadActivityRegister.lead.has(LeadRegister.owner_leader.has(Leader.emp_id == user_id)))
            )

        res = await session.execute(stmt)
        pending_activities = list(res.scalars().all())

        for act in pending_activities:
            if not act.activity_date:
                continue
            act_event_start = datetime.combine(act.activity_date, time(11, 0))
            is_past_24h = now >= (act_event_start + timedelta(hours=24))
            is_evening_check = (act.activity_date < date.today()) or (act.activity_date == date.today() and now.hour >= 17)

            if not (is_past_24h or is_evening_check):
                continue  # Not due for notification yet

            # Automatically update activity status to Overdue if pending after 24 hours
            if is_past_24h and act.action_status_id != overdue_status_id:
                act.action_status_id = overdue_status_id
                act.updated_at = datetime.now()
                logger.info(f"[LeadReminderService] Automatically updated Activity '{act.activity_id}' action_status_id to {overdue_status_id} ('overdue') after 24 hours.")

            owner = act.owner_leader or (act.lead.owner_leader if act.lead else None)
            if not owner:
                continue

            owner_emp_id = owner.emp_id
            owner_email = owner.email
            owner_fullname = getattr(owner, "full_name", f"{owner.first_name} {owner.last_name}")
            lead_id_str = act.lead_id or "N/A"
            company_name = getattr(act, "company", None) or (act.lead.company if act.lead else None) or "N/A"
            contact_person_name = getattr(act, "contact_name", None) or (act.lead.contact_name if act.lead else None) or "N/A"
            
            prod_names = []
            if act.lead and act.lead.products:
                for p in act.lead.products:
                    if p.product_type:
                        p_name = getattr(p.product_type, "product", None) or getattr(p.product_type, "name", None)
                        if p_name:
                            prod_names.append(p_name)
            product_name = ", ".join(prod_names) if prod_names else "N/A"

            act_type_name = (getattr(act.activity_type_status, "activity_type", None) or getattr(act.activity_type_status, "name", None) if getattr(act, "activity_type_status", None) else None) or "Scheduled Followup"
            act_summary = getattr(act, "meeting_plan", None) or getattr(act, "summary", None) or getattr(act, "next_action", None) or "Lead Action Required"

            notif_type = "ACTIVITY_OVERDUE_LOCKED" if is_past_24h else "ACTIVITY_OVERDUE"

            # Check if notification for this specific activity was already sent today/24h
            existing_overdue_stmt = select(SalesNotification).where(
                SalesNotification.user_id == owner_emp_id,
                SalesNotification.notification_type == notif_type,
                SalesNotification.message.like(f"%'{act.activity_id}'%")
            )
            ex_res = await session.execute(existing_overdue_stmt)
            if ex_res.scalars().first():
                continue  # Already notified; skip duplicate!

            if is_past_24h:
                overdue_msg = (
                    f"[24-HOUR OVERDUE LOCKED] Activity '{act.activity_id}' for Lead '{lead_id_str}' ({company_name}) "
                    f"has exceeded 24 hours since its 11:00 AM scheduled event on {act.activity_date}. Editing has been disabled for standard users. Only Super Admin / CFO can update this activity."
                )
            else:
                overdue_msg = (
                    f"[EVENING OVERDUE ALERT] Activity '{act.activity_id}' for Lead '{lead_id_str}' ({company_name}) "
                    f"scheduled for {act.activity_date} (11:00 AM IST) remains pending. Please complete or update status before 24 hours elapse."
                )

            # Insert/push notification
            new_notif = SalesNotification(
                user_id=owner_emp_id,
                id=act.activity_id,
                notification_type=notif_type,
                message=overdue_msg,
                is_viewed=False,
                created_at=datetime.now()
            )
            session.add(new_notif)
            await session.flush()

            notif_event = {
                "event_type": "sales_notification",
                "event": "sales_notification",
                "notification_type": notif_type,
                "data": {
                    "notification_id": new_notif.notification_id,
                    "user_id": owner_emp_id,
                    "target_id": lead_id_str,
                    "message": overdue_msg,
                    "is_viewed": False,
                    "created_at": new_notif.created_at.isoformat()
                }
            }
            await sse_manager.push(owner_emp_id, notif_event)
            overdue_notifs.append(notif_event)

            # Queue O365 Overdue Email in sales.mail_events outbox table
            if owner_email:
                from app.services.sales.mail_event_service import queue_mail_event

                target_email = owner_email

                if is_past_24h:
                    email_subject = f"[24-HOUR OVERDUE LOCK] Activity Pending > 24h for Lead {lead_id_str} ({company_name})"
                    email_body = f"""
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fda4af; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                      <div style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #ffffff; padding: 20px 24px;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 600;">🚫 24-Hour Overdue Lock Alert</h2>
                      </div>
                      <div style="padding: 24px; background-color: #ffffff; color: #1e293b; line-height: 1.6;">
                        <p style="margin-top: 0;">Hi <b>{owner_fullname}</b>,</p>
                        <p>Your scheduled lead activity has exceeded <b>24 hours</b> past its 11:00 AM event time on <b>{act.activity_date}</b> and remains pending. Editing has been disabled for standard users.</p>
                        
                        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; border-radius: 6px; padding: 16px; margin: 18px 0;">
                          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr style="border-bottom: 1px solid #ffe4e6;">
                              <td style="padding: 8px 0; font-weight: 600; color: #9f1239; width: 42%;">Lead Owner:</td>
                              <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">{owner_fullname}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ffe4e6;">
                              <td style="padding: 8px 0; font-weight: 600; color: #9f1239;">Activity ID:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{act.activity_id}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ffe4e6;">
                              <td style="padding: 8px 0; font-weight: 600; color: #9f1239;">Lead ID:</td>
                              <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">{lead_id_str}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ffe4e6;">
                              <td style="padding: 8px 0; font-weight: 600; color: #9f1239;">Company Name:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{company_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ffe4e6;">
                              <td style="padding: 8px 0; font-weight: 600; color: #9f1239;">Contact Person:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{contact_person_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ffe4e6;">
                              <td style="padding: 8px 0; font-weight: 600; color: #9f1239;">Product Name:</td>
                              <td style="padding: 8px 0; color: #e11d48; font-weight: 600;">{product_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ffe4e6;">
                              <td style="padding: 8px 0; font-weight: 600; color: #9f1239;">Activity / Meeting Type:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{act_type_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ffe4e6;">
                              <td style="padding: 8px 0; font-weight: 600; color: #9f1239;">Scheduled Date & Time:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{act.activity_date} (11:00 AM IST)</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; font-weight: 600; color: #9f1239;">Meeting Plan / Details:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{act_summary}</td>
                            </tr>
                          </table>
                        </div>
                        
                        <p style="font-size: 13px; color: #be123c; margin-bottom: 0;"><b>Action Required:</b> Standard user editing is locked. Only Super Admin / CFO can update this activity by specifying an overdue reason.</p>
                      </div>
                    </div>
                    """
                else:
                    email_subject = f"[EVENING OVERDUE ALERT] Activity Pending for Lead {lead_id_str} ({company_name})"
                    email_body = f"""
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fcd34d; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                      <div style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: #ffffff; padding: 20px 24px;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 600;">⚠️ Daily Evening Overdue Alert (5:00 PM IST)</h2>
                      </div>
                      <div style="padding: 24px; background-color: #ffffff; color: #1e293b; line-height: 1.6;">
                        <p style="margin-top: 0;">Hi <b>{owner_fullname}</b>,</p>
                        <p>This is your daily 5:00 PM evening reminder. Your scheduled activity for 11:00 AM on <b>{act.activity_date}</b> is currently <b>PENDING</b>.</p>
                        
                        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; border-radius: 6px; padding: 16px; margin: 18px 0;">
                          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr style="border-bottom: 1px solid #fef3c7;">
                              <td style="padding: 8px 0; font-weight: 600; color: #92400e; width: 42%;">Lead Owner:</td>
                              <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">{owner_fullname}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #fef3c7;">
                              <td style="padding: 8px 0; font-weight: 600; color: #92400e;">Activity ID:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{act.activity_id}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #fef3c7;">
                              <td style="padding: 8px 0; font-weight: 600; color: #92400e;">Lead ID:</td>
                              <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">{lead_id_str}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #fef3c7;">
                              <td style="padding: 8px 0; font-weight: 600; color: #92400e;">Company Name:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{company_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #fef3c7;">
                              <td style="padding: 8px 0; font-weight: 600; color: #92400e;">Contact Person:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{contact_person_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #fef3c7;">
                              <td style="padding: 8px 0; font-weight: 600; color: #92400e;">Product Name:</td>
                              <td style="padding: 8px 0; color: #d97706; font-weight: 600;">{product_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #fef3c7;">
                              <td style="padding: 8px 0; font-weight: 600; color: #92400e;">Activity / Meeting Type:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{act_type_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #fef3c7;">
                              <td style="padding: 8px 0; font-weight: 600; color: #92400e;">Scheduled Date & Time:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{act.activity_date} (11:00 AM IST)</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; font-weight: 600; color: #92400e;">Meeting Plan / Details:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{act_summary}</td>
                            </tr>
                          </table>
                        </div>
                        
                        <p style="font-size: 13px; color: #b45309; margin-bottom: 0;"><b>Notice:</b> Please complete or update status. If it remains pending 24 hours past the 11:00 AM event time, standard user editing will be disabled.</p>
                      </div>
                    </div>
                    """

                await queue_mail_event(
                    session=session,
                    event_type="send_email",
                    payload={
                        "activity_id": act.activity_id,
                        "to": target_email,
                        "subject": email_subject,
                        "body": email_body,
                        "sender": target_email,
                        "html": True
                    }
                )

        await session.commit()

    return overdue_notifs
