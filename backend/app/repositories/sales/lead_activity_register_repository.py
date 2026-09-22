from datetime import date
from typing import List, Optional, Any
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sales.lead_activity_register import LeadActivityRegister
from app.models.sales.lead_register import LeadRegister, ProductRegister
from app.models.sales.leader import Leader

class LeadActivityRegisterRepository:
    """Repository for LeadActivityRegister operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_activity(
        self, activity: LeadActivityRegister, current_user: Optional[Any] = None
    ) -> LeadActivityRegister:
        self.session.add(activity)
        await self.session.flush()
        
        # Trigger lead action reminders check and MV refresh
        try:
            from app.services.sales.lead_reminder_service import fetch_and_push_today_lead_action_reminders
            await fetch_and_push_today_lead_action_reminders(db_session=self.session)
        except Exception:
            pass

        # If activity_date is set, create Outlook Calendar event & notify ONLY the lead owner via O365Service
        target_date = activity.activity_date or activity.next_action_date
        if target_date:
            try:
                import asyncio
                from datetime import datetime, time
                from app.services.o365_service import O365Service
                from app.models.sales.leader import Leader

                # Query lead owner leader object for email
                owner_email = None
                owner_name = "Lead Owner"
                target_owner_id = activity.lead_owner_id or (getattr(current_user, "leader_id", None) or getattr(current_user, "emp_id", None) if current_user else None)
                if target_owner_id:
                    owner_stmt = select(Leader).where((Leader.leader_id == target_owner_id) | (Leader.emp_id == target_owner_id))
                    owner_res = await self.session.execute(owner_stmt)
                    owner_leader = owner_res.scalar_one_or_none()
                    if owner_leader and owner_leader.email:
                        owner_email = owner_leader.email
                        owner_name = f"{owner_leader.first_name} {owner_leader.last_name}"

                # Fallback to logged-in current_user email if lead owner email is missing
                if not owner_email and current_user and getattr(current_user, "email", None):
                    owner_email = current_user.email
                    owner_name = f"{getattr(current_user, 'first_name', '')} {getattr(current_user, 'last_name', '')}".strip() or "Lead Owner"

                from app.models.sales.lead_register import LeadRegister, ProductRegister
                from app.models.statustype.statustype import ActivityTypeStatusType
                from sqlalchemy.orm import selectinload

                lead_obj = None
                if activity.lead_id:
                    l_stmt = (
                        select(LeadRegister)
                        .options(selectinload(LeadRegister.products).selectinload(ProductRegister.product_type))
                        .where(LeadRegister.lead_id == activity.lead_id)
                    )
                    l_res = await self.session.execute(l_stmt)
                    lead_obj = l_res.scalar_one_or_none()

                company_name = getattr(activity, "company", None) or (lead_obj.company if lead_obj else None) or "N/A"
                contact_person_name = getattr(activity, "contact_name", None) or (lead_obj.contact_name if lead_obj else None) or "N/A"
                
                prod_names = []
                if lead_obj and lead_obj.products:
                    for p in lead_obj.products:
                        if p.product_type:
                            p_name = getattr(p.product_type, "product", None) or getattr(p.product_type, "name", None)
                            if p_name:
                                prod_names.append(p_name)
                product_name = ", ".join(prod_names) if prod_names else "N/A"

                act_type_name = "Scheduled Followup"
                if activity.activity_type_id:
                    t_stmt = select(ActivityTypeStatusType).where(ActivityTypeStatusType.id == activity.activity_type_id)
                    t_res = await self.session.execute(t_stmt)
                    t_obj = t_res.scalar_one_or_none()
                    if t_obj:
                        act_type_name = getattr(t_obj, "activity_type", None) or getattr(t_obj, "name", None) or "Scheduled Followup"

                event_start = datetime.combine(target_date, time(11, 0))
                event_end = datetime.combine(target_date, time(12, 0))
                summary_text = getattr(activity, "meeting_plan", None) or getattr(activity, "summary", None) or activity.next_action or "Lead Action Required"
                lead_id_str = activity.lead_id or "N/A"
                target_owner_email = owner_email

                from app.services.sales.mail_event_service import queue_mail_event

                # 1. Queue Calendar Event (set attendees to None so M365 does not create duplicate self-invitations)
                cal_body = f"Lead Owner: {owner_name}\nLead ID: {lead_id_str}\nCompany: {company_name}\nContact Person: {contact_person_name}\nProduct Name: {product_name}\nActivity Type: {act_type_name}\nScheduled Date & Time: {target_date.strftime('%Y-%m-%d')} 11:00 AM IST\nActivity Plan: {summary_text}"
                await queue_mail_event(
                    session=self.session,
                    event_type="create_calendar_event",
                    payload={
                        "activity_id": activity.activity_id,
                        "subject": f"Lead Followup: {summary_text} ({company_name} - {lead_id_str})",
                        "start": event_start.isoformat(),
                        "end": event_end.isoformat(),
                        "body": cal_body,
                        "organizer_email": target_owner_email,
                        "attendees": None,
                        "reminder_minutes": 15
                    }
                )
                # 2. Queue Action Reminder Email
                if target_owner_email:
                    email_subject = f"[Action Reminder] Scheduled {act_type_name} for Lead {lead_id_str} ({company_name})"
                    email_body = f"""
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                      <div style="background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%); color: #ffffff; padding: 20px 24px;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 600;">⏰ Scheduled Lead Activity Reminder</h2>
                      </div>
                      <div style="padding: 24px; background-color: #ffffff; color: #1e293b; line-height: 1.6;">
                        <p style="margin-top: 0;">Hi <b>{owner_name}</b>,</p>
                        <p>This is an automated action reminder for your scheduled lead activity. Below are the complete details:</p>
                        
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0078d4; border-radius: 6px; padding: 16px; margin: 18px 0;">
                          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b; width: 42%;">Lead Owner:</td>
                              <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">{owner_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Lead ID:</td>
                              <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">{lead_id_str}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Company Name:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{company_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Contact Person:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{contact_person_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Product Name:</td>
                              <td style="padding: 8px 0; color: #0078d4; font-weight: 600;">{product_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Activity / Meeting Type:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{act_type_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Scheduled Date & Time:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{target_date.strftime('%Y-%m-%d')} (11:00 AM IST)</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Meeting Plan / Details:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{summary_text}</td>
                            </tr>
                          </table>
                        </div>
                        
                        <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">An Outlook Calendar event with a 15-minute reminder popup has been added to your calendar.</p>
                      </div>
                    </div>
                    """
                    await queue_mail_event(
                        session=self.session,
                        event_type="send_email",
                        payload={
                            "activity_id": activity.activity_id,
                            "to": target_owner_email,
                            "subject": email_subject,
                            "body": email_body,
                            "sender": target_owner_email,
                            "html": True
                        }
                    )
            except Exception as outer_err:
                print(f"[MailEvent Queue Warning] {outer_err}", flush=True)

        # Fetch again to eagerly load relationships
        return await self.get_activity_by_id(activity.activity_id)

    async def get_activity_by_id(self, activity_id: str, leader_id: Optional[str] = None, is_executive: bool = False) -> Optional[LeadActivityRegister]:
        stmt = (
            select(LeadActivityRegister)
            .options(
                selectinload(LeadActivityRegister.lead).options(
                    selectinload(LeadRegister.products).options(
                        selectinload(ProductRegister.product_type),
                        selectinload(ProductRegister.product_status_type),
                        selectinload(ProductRegister.stage_status_type),
                    )
                ),
                selectinload(LeadActivityRegister.owner_leader),
                selectinload(LeadActivityRegister.activity_type_status),
                selectinload(LeadActivityRegister.next_action_type_status),
                selectinload(LeadActivityRegister.outcome_status),
                selectinload(LeadActivityRegister.action_status_type),
            )
            .where(LeadActivityRegister.activity_id == activity_id)
        )
        if not is_executive:
            stmt = stmt.where(LeadActivityRegister.is_active == True)
            if leader_id is not None:
                stmt = stmt.where(LeadActivityRegister.lead_owner_id == leader_id)

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_activities_by_lead(
        self, lead_id: str, limit: int = 50, cursor: Optional[str] = None, 
        leader_id: Optional[str] = None, is_executive: bool = False, is_active_filter: Optional[bool] = None
    ) -> dict:
        from sqlalchemy import func
        
        base_query = select(LeadActivityRegister).where(LeadActivityRegister.lead_id == lead_id)
        count_query = select(func.count()).select_from(LeadActivityRegister).where(LeadActivityRegister.lead_id == lead_id)

        if not is_executive:
            base_query = base_query.where(LeadActivityRegister.is_active == True)
            count_query = count_query.where(LeadActivityRegister.is_active == True)
            if leader_id is not None:
                base_query = base_query.where(LeadActivityRegister.lead_owner_id == leader_id)
                count_query = count_query.where(LeadActivityRegister.lead_owner_id == leader_id)
        else:
            if is_active_filter is not None:
                base_query = base_query.where(LeadActivityRegister.is_active == is_active_filter)
                count_query = count_query.where(LeadActivityRegister.is_active == is_active_filter)

        if cursor is not None:
            from sqlalchemy import or_
            cursor_activity = await self.session.execute(select(LeadActivityRegister.created_at).where(LeadActivityRegister.activity_id == cursor))
            cursor_created_at = cursor_activity.scalar_one_or_none()
            if cursor_created_at:
                base_query = base_query.where(
                    or_(
                        LeadActivityRegister.created_at < cursor_created_at,
                        (LeadActivityRegister.created_at == cursor_created_at) & (LeadActivityRegister.activity_id < cursor)
                    )
                )
            else:
                base_query = base_query.where(LeadActivityRegister.activity_id < cursor)

        total = (await self.session.execute(count_query)).scalar_one()

        stmt = (
            base_query
            .options(
                selectinload(LeadActivityRegister.lead).options(
                    selectinload(LeadRegister.products).options(
                        selectinload(ProductRegister.product_type),
                        selectinload(ProductRegister.product_status_type),
                        selectinload(ProductRegister.stage_status_type),
                    )
                ),
                selectinload(LeadActivityRegister.owner_leader),
                selectinload(LeadActivityRegister.activity_type_status),
                selectinload(LeadActivityRegister.next_action_type_status),
                selectinload(LeadActivityRegister.outcome_status),
                selectinload(LeadActivityRegister.action_status_type),
            )
            .order_by(LeadActivityRegister.created_at.desc(), LeadActivityRegister.activity_id.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        activities = list(result.scalars().all())

        next_cursor = activities[-1].activity_id if activities else None

        return {
            "total": total,
            "data": activities,
            "limit": limit,
            "next_cursor": next_cursor,
            "has_more": len(activities) == limit,
        }

    async def get_all_activities(
        self, limit: int = 50, cursor: Optional[str] = None, 
        leader_id: Optional[str] = None, is_executive: bool = False, is_active_filter: Optional[bool] = None, 
        search: Optional[str] = None,
        from_date: Optional[date] = None, to_date: Optional[date] = None
    ) -> dict:
        from sqlalchemy import func, or_, String, cast
        from datetime import datetime, time
        from app.models.statustype.statustype import (
            ActivityTypeStatusType, 
            DailyActivityStatusType, 
            DailyActivityOutcomeStatusType
        )
        
        base_query = select(LeadActivityRegister)
        count_query = select(func.count()).select_from(LeadActivityRegister)

        if not is_executive:
            base_query = base_query.where(LeadActivityRegister.is_active == True)
            count_query = count_query.where(LeadActivityRegister.is_active == True)
            if leader_id is not None:
                base_query = base_query.where(LeadActivityRegister.lead_owner_id == leader_id)
                count_query = count_query.where(LeadActivityRegister.lead_owner_id == leader_id)
        else:
            if is_active_filter is not None:
                base_query = base_query.where(LeadActivityRegister.is_active == is_active_filter)
                count_query = count_query.where(LeadActivityRegister.is_active == is_active_filter)

        if from_date is not None:
            base_query = base_query.where(LeadActivityRegister.activity_date >= from_date)
            count_query = count_query.where(LeadActivityRegister.activity_date >= from_date)

        if to_date is not None:
            base_query = base_query.where(LeadActivityRegister.activity_date <= to_date)
            count_query = count_query.where(LeadActivityRegister.activity_date <= to_date)

        # ── Dynamic Array-Based Search or Global Text Search Fallback ────
        if search and search.strip():
            raw_search = search.strip()
            parsed_filters = None
            
            if raw_search.startswith("[") or raw_search.startswith("{"):
                import json
                try:
                    parsed_filters = json.loads(raw_search)
                except Exception:
                    parsed_filters = None

            if parsed_filters is not None:
                # ── JSON Array / Dict of Key-Value Filters Passed ──────────
                filters_list = [parsed_filters] if isinstance(parsed_filters, dict) else (parsed_filters if isinstance(parsed_filters, list) else [])

                for item in filters_list:
                    item_dict = item if isinstance(item, dict) else (item.model_dump() if hasattr(item, "model_dump") else {})
                    pairs = []
                    if "key" in item_dict and "value" in item_dict:
                        pairs.append((str(item_dict["key"]), item_dict["value"]))
                    else:
                        for k_key, v_val in item_dict.items():
                            pairs.append((str(k_key), v_val))

                    for raw_k, v_raw in pairs:
                        k = raw_k.strip().lower()
                        v = str(v_raw).strip() if v_raw is not None else ""
                        if k and v:
                            val_pattern = f"%{v}%"
                            if k in ["action_status_id", "status_id"]:
                                try:
                                    st_id = int(v)
                                    base_query = base_query.where(LeadActivityRegister.action_status_id == st_id)
                                    count_query = count_query.where(LeadActivityRegister.action_status_id == st_id)
                                except ValueError:
                                    base_query = base_query.where(cast(LeadActivityRegister.action_status_id, String).ilike(val_pattern))
                                    count_query = count_query.where(cast(LeadActivityRegister.action_status_id, String).ilike(val_pattern))

                            elif k in ["action_status", "status"]:
                                if v.lower() == "not completed":
                                    base_query = base_query.where(LeadActivityRegister.action_status_id != 2)
                                    count_query = count_query.where(LeadActivityRegister.action_status_id != 2)
                                else:
                                    base_query = base_query.outerjoin(DailyActivityStatusType, LeadActivityRegister.action_status_id == DailyActivityStatusType.id)
                                    count_query = count_query.outerjoin(DailyActivityStatusType, LeadActivityRegister.action_status_id == DailyActivityStatusType.id)
                                    base_query = base_query.where(DailyActivityStatusType.action_status.ilike(val_pattern))
                                    count_query = count_query.where(DailyActivityStatusType.action_status.ilike(val_pattern))

                            elif k in ["activity_type_id", "type_id"]:
                                try:
                                    act_id = int(v)
                                    base_query = base_query.where(LeadActivityRegister.activity_type_id == act_id)
                                    count_query = count_query.where(LeadActivityRegister.activity_type_id == act_id)
                                except ValueError:
                                    base_query = base_query.where(cast(LeadActivityRegister.activity_type_id, String).ilike(val_pattern))
                                    count_query = count_query.where(cast(LeadActivityRegister.activity_type_id, String).ilike(val_pattern))

                            elif k in ["activity_type", "type"]:
                                base_query = base_query.outerjoin(ActivityTypeStatusType, LeadActivityRegister.activity_type_id == ActivityTypeStatusType.id)
                                count_query = count_query.outerjoin(ActivityTypeStatusType, LeadActivityRegister.activity_type_id == ActivityTypeStatusType.id)
                                base_query = base_query.where(ActivityTypeStatusType.activity_type.ilike(val_pattern))
                                count_query = count_query.where(ActivityTypeStatusType.activity_type.ilike(val_pattern))

                            elif k in ["outcome_id"]:
                                try:
                                    oc_id = int(v)
                                    base_query = base_query.where(LeadActivityRegister.outcome_id == oc_id)
                                    count_query = count_query.where(LeadActivityRegister.outcome_id == oc_id)
                                except ValueError:
                                    base_query = base_query.where(cast(LeadActivityRegister.outcome_id, String).ilike(val_pattern))
                                    count_query = count_query.where(cast(LeadActivityRegister.outcome_id, String).ilike(val_pattern))

                            elif k in ["outcome"]:
                                base_query = base_query.outerjoin(DailyActivityOutcomeStatusType, LeadActivityRegister.outcome_id == DailyActivityOutcomeStatusType.id)
                                count_query = count_query.outerjoin(DailyActivityOutcomeStatusType, LeadActivityRegister.outcome_id == DailyActivityOutcomeStatusType.id)
                                base_query = base_query.where(DailyActivityOutcomeStatusType.outcome.ilike(val_pattern))
                                count_query = count_query.where(DailyActivityOutcomeStatusType.outcome.ilike(val_pattern))

                            elif k in ["lead_owner_id", "owner_id"]:
                                base_query = base_query.where(LeadActivityRegister.lead_owner_id == v)
                                count_query = count_query.where(LeadActivityRegister.lead_owner_id == v)

                            elif k in ["lead_owner", "owner"]:
                                base_query = base_query.outerjoin(Leader, LeadActivityRegister.lead_owner_id == Leader.leader_id)
                                count_query = count_query.outerjoin(Leader, LeadActivityRegister.lead_owner_id == Leader.leader_id)
                                owner_filter = or_(
                                    Leader.first_name.ilike(val_pattern),
                                    Leader.last_name.ilike(val_pattern),
                                    func.concat(Leader.first_name, ' ', Leader.last_name).ilike(val_pattern)
                                )
                                base_query = base_query.where(owner_filter)
                                count_query = count_query.where(owner_filter)

                            elif k in ["company", "company_name"]:
                                base_query = base_query.outerjoin(LeadRegister, LeadActivityRegister.lead_id == LeadRegister.lead_id)
                                count_query = count_query.outerjoin(LeadRegister, LeadActivityRegister.lead_id == LeadRegister.lead_id)
                                base_query = base_query.where(LeadRegister.company.ilike(val_pattern))
                                count_query = count_query.where(LeadRegister.company.ilike(val_pattern))

                            elif k in ["contact_name", "contact"]:
                                base_query = base_query.outerjoin(LeadRegister, LeadActivityRegister.lead_id == LeadRegister.lead_id)
                                count_query = count_query.outerjoin(LeadRegister, LeadActivityRegister.lead_id == LeadRegister.lead_id)
                                base_query = base_query.where(LeadRegister.contact_name.ilike(val_pattern))
                                count_query = count_query.where(LeadRegister.contact_name.ilike(val_pattern))

                            elif k in ["meeting_plan", "summary"]:
                                base_query = base_query.where(LeadActivityRegister.meeting_plan.ilike(val_pattern))
                                count_query = count_query.where(LeadActivityRegister.meeting_plan.ilike(val_pattern))

                            elif k in ["lead_id"]:
                                base_query = base_query.where(LeadActivityRegister.lead_id.ilike(val_pattern))
                                count_query = count_query.where(LeadActivityRegister.lead_id.ilike(val_pattern))
            else:
                # ── Plain String Search (Global text search across all fields) ──
                val_pattern = f"%{raw_search}%"
                from sqlalchemy.orm import aliased
                ActivityType = aliased(ActivityTypeStatusType)
                NextActionType = aliased(ActivityTypeStatusType)
                
                base_query = (
                    base_query
                    .outerjoin(Leader, LeadActivityRegister.lead_owner_id == Leader.leader_id)
                    .outerjoin(LeadRegister, LeadActivityRegister.lead_id == LeadRegister.lead_id)
                    .outerjoin(DailyActivityStatusType, LeadActivityRegister.action_status_id == DailyActivityStatusType.id)
                    .outerjoin(DailyActivityOutcomeStatusType, LeadActivityRegister.outcome_id == DailyActivityOutcomeStatusType.id)
                    .outerjoin(ActivityType, LeadActivityRegister.activity_type_id == ActivityType.id)
                    .outerjoin(NextActionType, LeadActivityRegister.next_action_type_id == NextActionType.id)
                )
                count_query = (
                    count_query
                    .outerjoin(Leader, LeadActivityRegister.lead_owner_id == Leader.leader_id)
                    .outerjoin(LeadRegister, LeadActivityRegister.lead_id == LeadRegister.lead_id)
                    .outerjoin(DailyActivityStatusType, LeadActivityRegister.action_status_id == DailyActivityStatusType.id)
                    .outerjoin(DailyActivityOutcomeStatusType, LeadActivityRegister.outcome_id == DailyActivityOutcomeStatusType.id)
                    .outerjoin(ActivityType, LeadActivityRegister.activity_type_id == ActivityType.id)
                    .outerjoin(NextActionType, LeadActivityRegister.next_action_type_id == NextActionType.id)
                )
                
                search_filter = or_(
                    Leader.first_name.ilike(val_pattern),
                    Leader.last_name.ilike(val_pattern),
                    func.concat(Leader.first_name, ' ', Leader.last_name).ilike(val_pattern),
                    LeadRegister.contact_name.ilike(val_pattern),
                    LeadRegister.company.ilike(val_pattern),
                    LeadActivityRegister.meeting_plan.ilike(val_pattern),
                    LeadActivityRegister.next_meeting_plan.ilike(val_pattern),
                    cast(LeadActivityRegister.activity_type_id, String).ilike(val_pattern),
                    cast(LeadActivityRegister.action_status_id, String).ilike(val_pattern),
                    DailyActivityStatusType.action_status.ilike(val_pattern),
                    DailyActivityOutcomeStatusType.outcome.ilike(val_pattern),
                    ActivityType.activity_type.ilike(val_pattern),
                    NextActionType.activity_type.ilike(val_pattern),
                )
                base_query = base_query.where(search_filter)
                count_query = count_query.where(search_filter)

        if cursor is not None:
            cursor_activity = await self.session.execute(select(LeadActivityRegister.created_at).where(LeadActivityRegister.activity_id == cursor))
            cursor_created_at = cursor_activity.scalar_one_or_none()
            if cursor_created_at:
                base_query = base_query.where(
                    or_(
                        LeadActivityRegister.created_at < cursor_created_at,
                        (LeadActivityRegister.created_at == cursor_created_at) & (LeadActivityRegister.activity_id < cursor)
                    )
                )
            else:
                base_query = base_query.where(LeadActivityRegister.activity_id < cursor)

        total = (await self.session.execute(count_query)).scalar_one()

        stmt = (
            base_query
            .options(
                selectinload(LeadActivityRegister.lead).options(
                    selectinload(LeadRegister.products).options(
                        selectinload(ProductRegister.product_type),
                        selectinload(ProductRegister.product_status_type),
                        selectinload(ProductRegister.stage_status_type),
                    )
                ),
                selectinload(LeadActivityRegister.owner_leader),
                selectinload(LeadActivityRegister.activity_type_status),
                selectinload(LeadActivityRegister.next_action_type_status),
                selectinload(LeadActivityRegister.outcome_status),
                selectinload(LeadActivityRegister.action_status_type),
            )
            .order_by(LeadActivityRegister.created_at.desc(), LeadActivityRegister.activity_id.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        activities = list(result.scalars().all())

        next_cursor = activities[-1].activity_id if activities else None

        return {
            "total": total,
            "data": activities,
            "limit": limit,
            "next_cursor": next_cursor,
            "has_more": len(activities) == limit,
        }

    async def update_activity(
        self, activity_id: str, update_data: dict, current_user: Optional[Any] = None
    ) -> Optional[LeadActivityRegister]:
        valid_cols = {
            "activity_id", "lead_id", "lead_no", "lead_owner_id", "activity_date",
            "activity_type_id", "meeting_plan", "meeting_action_remarks",
            "next_meeting_plan", "next_action_date", "next_action_type_id", "outcome_id", "action_status_id",
            "overdue_reason", "is_active"
        }
        clean_update_data = {}
        for k, v in update_data.items():
            if k == "summary":
                clean_update_data["meeting_plan"] = v
            elif k in valid_cols:
                clean_update_data[k] = v

        # Resolve next_action, next_action_type_id, next_meeting_plan mapping
        na_val = update_data.get("next_action")
        na_type_val = update_data.get("next_action_type_id") or update_data.get("next_action_type") or update_data.get("next_activity_type")
        nmp_val = update_data.get("next_meeting_plan") or update_data.get("next_summary") or update_data.get("next_plan")

        if na_type_val is not None:
            if isinstance(na_type_val, int):
                clean_update_data["next_action_type_id"] = na_type_val
            elif isinstance(na_type_val, str) and na_type_val.isdigit():
                clean_update_data["next_action_type_id"] = int(na_type_val)

        if "next_action_type_id" not in clean_update_data and na_val is not None:
            if isinstance(na_val, int):
                clean_update_data["next_action_type_id"] = na_val
            elif isinstance(na_val, str) and na_val.isdigit():
                clean_update_data["next_action_type_id"] = int(na_val)
            elif isinstance(na_val, str) and not nmp_val:
                clean_update_data["next_meeting_plan"] = na_val

        if nmp_val is not None:
            clean_update_data["next_meeting_plan"] = nmp_val

        if clean_update_data:
            stmt = (
                update(LeadActivityRegister)
                .where(LeadActivityRegister.activity_id == activity_id)
                .values(**clean_update_data)
            )
            await self.session.execute(stmt)
            await self.session.flush()

        # Trigger lead action reminders check and MV refresh
        try:
            from app.services.sales.lead_reminder_service import fetch_and_push_today_lead_action_reminders
            await fetch_and_push_today_lead_action_reminders(db_session=self.session)
        except Exception:
            pass

        updated_activity = await self.get_activity_by_id(activity_id, is_executive=True)

        # If activity_date or meeting_plan was updated, create/update calendar event & send action reminder email
        if updated_activity and ("activity_date" in update_data or "meeting_plan" in update_data or "summary" in update_data or "next_action_date" in update_data or "next_action" in update_data):
            try:
                import asyncio
                from datetime import datetime, time
                from app.services.o365_service import O365Service
                from app.models.sales.leader import Leader

                owner_email = None
                owner_name = "Lead Owner"
                target_owner_id = updated_activity.lead_owner_id or (getattr(current_user, "leader_id", None) or getattr(current_user, "emp_id", None) if current_user else None)
                if target_owner_id:
                    owner_stmt = select(Leader).where((Leader.leader_id == target_owner_id) | (Leader.emp_id == target_owner_id))
                    owner_res = await self.session.execute(owner_stmt)
                    owner_leader = owner_res.scalar_one_or_none()
                    if owner_leader and owner_leader.email:
                        owner_email = owner_leader.email
                        owner_name = f"{owner_leader.first_name} {owner_leader.last_name}"

                if not owner_email and current_user and getattr(current_user, "email", None):
                    owner_email = current_user.email
                    owner_name = f"{getattr(current_user, 'first_name', '')} {getattr(current_user, 'last_name', '')}".strip() or "Lead Owner"

                from app.models.sales.lead_register import LeadRegister, ProductRegister
                from app.models.statustype.statustype import ActivityTypeStatusType
                from sqlalchemy.orm import selectinload

                lead_obj = None
                if updated_activity.lead_id:
                    l_stmt = (
                        select(LeadRegister)
                        .options(selectinload(LeadRegister.products).selectinload(ProductRegister.product_type))
                        .where(LeadRegister.lead_id == updated_activity.lead_id)
                    )
                    l_res = await self.session.execute(l_stmt)
                    lead_obj = l_res.scalar_one_or_none()

                company_name = getattr(updated_activity, "company", None) or (lead_obj.company if lead_obj else None) or "N/A"
                contact_person_name = getattr(updated_activity, "contact_name", None) or (lead_obj.contact_name if lead_obj else None) or "N/A"

                prod_names = []
                if lead_obj and lead_obj.products:
                    for p in lead_obj.products:
                        if p.product_type:
                            p_name = getattr(p.product_type, "product", None) or getattr(p.product_type, "name", None)
                            if p_name:
                                prod_names.append(p_name)
                product_name = ", ".join(prod_names) if prod_names else "N/A"

                act_type_name = "Scheduled Followup"
                if updated_activity.activity_type_id:
                    t_stmt = select(ActivityTypeStatusType).where(ActivityTypeStatusType.id == updated_activity.activity_type_id)
                    t_res = await self.session.execute(t_stmt)
                    t_obj = t_res.scalar_one_or_none()
                    if t_obj:
                        act_type_name = getattr(t_obj, "activity_type", None) or getattr(t_obj, "name", None) or "Scheduled Followup"

                target_date = updated_activity.activity_date or updated_activity.next_action_date
                if target_date:
                    event_start = datetime.combine(target_date, time(11, 0))
                    event_end = datetime.combine(target_date, time(12, 0))
                    summary_text = getattr(updated_activity, "meeting_plan", None) or getattr(updated_activity, "summary", None) or updated_activity.next_action or "Lead Action Required"
                    lead_id_str = updated_activity.lead_id or "N/A"
                    target_owner_email = owner_email

                from app.services.sales.mail_event_service import queue_mail_event

                # 1. Queue Updated Calendar Event
                cal_body = f"Lead Owner: {owner_name}\nLead ID: {lead_id_str}\nCompany: {company_name}\nContact Person: {contact_person_name}\nProduct Name: {product_name}\nActivity Type: {act_type_name}\nScheduled Date & Time: {target_date.strftime('%Y-%m-%d')} 11:00 AM IST\nActivity Plan: {summary_text}"
                await queue_mail_event(
                    session=self.session,
                    event_type="create_calendar_event",
                    payload={
                        "subject": f"Lead Followup: {summary_text} ({company_name} - {lead_id_str})",
                        "start": event_start.isoformat(),
                        "end": event_end.isoformat(),
                        "body": cal_body,
                        "organizer_email": target_owner_email,
                        "attendees": [target_owner_email] if target_owner_email else None,
                        "reminder_minutes": 15
                    }
                )

                # 2. Queue Updated Action Reminder Email
                if target_owner_email:
                    email_subject = f"[Action Reminder] Updated {act_type_name} Date for Lead {lead_id_str} ({company_name})"
                    email_body = f"""
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                      <div style="background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%); color: #ffffff; padding: 20px 24px;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 600;">⏰ Lead Activity Schedule Updated</h2>
                      </div>
                      <div style="padding: 24px; background-color: #ffffff; color: #1e293b; line-height: 1.6;">
                        <p style="margin-top: 0;">Hi <b>{owner_name}</b>,</p>
                        <p>The scheduled activity date for your lead task has been updated. Below are the updated details:</p>
                        
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0078d4; border-radius: 6px; padding: 16px; margin: 18px 0;">
                          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b; width: 42%;">Lead Owner:</td>
                              <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">{owner_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Lead ID:</td>
                              <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">{lead_id_str}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Company Name:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{company_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Contact Person:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{contact_person_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Product Name:</td>
                              <td style="padding: 8px 0; color: #0078d4; font-weight: 600;">{product_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Activity / Meeting Type:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{act_type_name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">New Scheduled Date:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{target_date.strftime('%Y-%m-%d')} (11:00 AM IST)</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Meeting Plan / Details:</td>
                              <td style="padding: 8px 0; color: #0f172a;">{summary_text}</td>
                            </tr>
                          </table>
                        </div>
                        
                        <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">An Outlook Calendar event with a 15-minute reminder popup has been updated on your calendar.</p>
                      </div>
                    </div>
                    """
                    await queue_mail_event(
                        session=self.session,
                        event_type="send_email",
                        payload={
                            "activity_id": updated_activity.activity_id,
                            "to": target_owner_email,
                            "subject": email_subject,
                            "body": email_body,
                            "sender": target_owner_email,
                            "html": True
                        }
                    )
            except Exception as outer_err:
                print(f"[MailEvent Queue Warning] {outer_err}", flush=True)

        return updated_activity

    async def _cancel_and_delete_calendar_events(self, activity_ids: List[str]):
        if not activity_ids:
            return
        try:
            from app.models.sales.mail_event import MailEvent
            from sqlalchemy import String, cast, or_, select, update
            from datetime import datetime
            import asyncio

            conditions = [cast(MailEvent.payload, String).like(f"%{aid}%") for aid in activity_ids]
            await self.session.execute(
                update(MailEvent)
                .where(
                    MailEvent.status.in_(["pending", "failed"]),
                    or_(*conditions)
                )
                .values(status="cancelled", updated_at=datetime.now())
            )

            done_stmt = (
                select(MailEvent)
                .where(
                    MailEvent.event_type == "create_calendar_event",
                    MailEvent.status == "done",
                    or_(*conditions)
                )
            )
            done_res = await self.session.execute(done_stmt)
            done_events = list(done_res.scalars().all())

            new_del_events = False
            for ev in done_events:
                ev_id_to_del = None
                org_email = None
                if ev.response_payload and isinstance(ev.response_payload, dict):
                    ev_id_to_del = ev.response_payload.get("event_id")
                    org_email = ev.response_payload.get("organizer") or (ev.payload or {}).get("organizer_email")
                elif ev.payload and isinstance(ev.payload, dict):
                    ev_id_to_del = ev.payload.get("event_id")
                    org_email = ev.payload.get("organizer_email")

                del_payload = {
                    "event_id": ev_id_to_del,
                    "organizer_email": org_email or (ev.payload or {}).get("organizer_email"),
                    "activity_id": activity_ids[0] if len(activity_ids) == 1 else None,
                    "subject": (ev.payload or {}).get("subject")
                }

                del_event = MailEvent(
                    event_type="delete_calendar_event",
                    payload=del_payload,
                    status="pending",
                    retry_count=0,
                    created_at=datetime.now()
                )
                self.session.add(del_event)
                new_del_events = True

            await self.session.flush()

            if new_del_events:
                from app.services.sales.email.mail_event_service import trigger_process_pending_mail_events
                trigger_process_pending_mail_events(delay_seconds=1.0)

        except Exception as err:
            print(f"[_cancel_and_delete_calendar_events error] {err}", flush=True)

    async def delete_activity(self, activity_id: str, is_executive: bool = False, current_user: Optional[Any] = None) -> bool:
        activity_to_delete = await self.get_activity_by_id(activity_id, is_executive=True)
        if not activity_to_delete:
            return False

        if is_executive:
            stmt = delete(LeadActivityRegister).where(LeadActivityRegister.activity_id == activity_id)
        else:
            stmt = update(LeadActivityRegister).where(LeadActivityRegister.activity_id == activity_id).values(is_active=False)
            
        result = await self.session.execute(stmt)
        
        # Instantly cancel un-sent events, delete Outlook calendar events, and update notifications
        try:
            from app.models.sales.sales_notification import SalesNotification
            from sqlalchemy import or_, text
            await self._cancel_and_delete_calendar_events([activity_id])
            if is_executive:
                await self.session.execute(
                    delete(SalesNotification)
                    .where(
                        or_(
                            SalesNotification.id == activity_id,
                            SalesNotification.message.like(f"%{activity_id}%")
                        )
                    )
                )
            else:
                await self.session.execute(
                    update(SalesNotification)
                    .where(
                        or_(
                            SalesNotification.id == activity_id,
                            SalesNotification.message.like(f"%{activity_id}%")
                        )
                    )
                    .values(is_viewed=True)
                )
            await self.session.flush()
            try:
                await self.session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_notifications_mv;"))
            except Exception:
                await self.session.execute(text("REFRESH MATERIALIZED VIEW sales.sales_notifications_mv;"))
        except Exception as err:
            print(f"[delete_activity Notification Cleanup Error] {err}", flush=True)

        await self.session.flush()
        return result.rowcount > 0

    async def delete_all_activities(self, hard_delete: bool = True) -> int:
        if hard_delete:
            stmt = delete(LeadActivityRegister)
        else:
            stmt = update(LeadActivityRegister).values(is_active=False)
        result = await self.session.execute(stmt)
        
        try:
            from app.models.sales.mail_event import MailEvent
            from app.models.sales.sales_notification import SalesNotification
            from sqlalchemy import text
            await self.session.execute(
                update(MailEvent).where(MailEvent.status == "pending").values(status="cancelled", updated_at=datetime.now())
            )
            if hard_delete:
                await self.session.execute(
                    delete(SalesNotification).where(
                        SalesNotification.notification_type.in_(["LEAD_REMINDER", "ACTIVITY_OVERDUE", "ACTIVITY_OVERDUE_LOCKED"])
                    )
                )
            else:
                await self.session.execute(
                    update(SalesNotification)
                    .where(SalesNotification.notification_type.in_(["LEAD_REMINDER", "ACTIVITY_OVERDUE", "ACTIVITY_OVERDUE_LOCKED"]))
                    .values(is_viewed=True)
                )
            await self.session.flush()
            try:
                await self.session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_notifications_mv;"))
            except Exception:
                await self.session.execute(text("REFRESH MATERIALIZED VIEW sales.sales_notifications_mv;"))
        except Exception as err:
            print(f"[delete_all_activities Notification Cleanup Error] {err}", flush=True)

        await self.session.flush()
        return result.rowcount

    async def bulk_delete_activities(self, activity_ids: List[str], hard_delete: bool = True) -> int:
        if not activity_ids:
            return 0
        if hard_delete:
            stmt = delete(LeadActivityRegister).where(LeadActivityRegister.activity_id.in_(activity_ids))
        else:
            stmt = update(LeadActivityRegister).where(LeadActivityRegister.activity_id.in_(activity_ids)).values(is_active=False)
        result = await self.session.execute(stmt)
        
        try:
            from app.models.sales.sales_notification import SalesNotification
            from sqlalchemy import or_, text
            await self._cancel_and_delete_calendar_events(activity_ids)
            notif_conds = [SalesNotification.id == aid for aid in activity_ids]
            notif_conds.extend([SalesNotification.message.like(f"%{aid}%") for aid in activity_ids])
            if hard_delete:
                await self.session.execute(
                    delete(SalesNotification).where(or_(*notif_conds))
                )
            else:
                await self.session.execute(
                    update(SalesNotification)
                    .where(or_(*notif_conds))
                    .values(is_viewed=True)
                )
            await self.session.flush()
            try:
                await self.session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_notifications_mv;"))
            except Exception:
                await self.session.execute(text("REFRESH MATERIALIZED VIEW sales.sales_notifications_mv;"))
        except Exception as err:
            print(f"[bulk_delete_activities Notification Cleanup Error] {err}", flush=True)

        await self.session.flush()
        return result.rowcount
