from datetime import date
from typing import List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, func, or_, text
from sqlalchemy.orm import selectinload

from app.models.sales.lead_register import LeadRegister, ProductRegister
from app.models.sales.proposal_sent import ProposalSent
from app.models.sales.contact import Contact
from app.models.sales.leader import Leader
from app.models.statustype.statustype import LeaderStageStatusType
from app.schemas.sales.proposal_sent_schema import ProposalSentCreate


# Stage → (probability, risk_matrix) mapping
STAGE_LOGIC = {
    "low":         (25.0, "High Risk"),
    "medium":      (50.0, "Moderate Risk"),
    "high":        (75.0, "Low Risk"),
    "negotiation": (90.0, "Risk Clear"),
    "won":         (100.0, "Revenue"),
    "lost":        (0.0, "LOST"),
}


class LeadRegisterRepository:
    """Repository for LeadRegister and ProductRegister tables."""

    def __init__(self, session: AsyncSession):
        self.session = session

    # ── helpers ─────────────────────────────────────────────────────────────────

    async def _get_stage_name(self, stage_id: int) -> Optional[str]:
        """Fetch the stage label from statustype.leader_stage_status_type."""
        if stage_id is None:
            return None
        stmt = select(LeaderStageStatusType).where(LeaderStageStatusType.id == stage_id)
        result = await self.session.execute(stmt)
        obj = result.scalar_one_or_none()
        return obj.leader_stage.strip().lower() if obj else None

    @staticmethod
    def _sanitize_numeric_15_2(val: Optional[float]) -> Optional[float]:
        """Ensure numeric fields stay within PostgreSQL NUMERIC(15, 2) bounds (< 10^13)."""
        if val is None:
            return None
        try:
            f_val = float(val)
            max_val = 9999999999999.99
            if f_val > max_val:
                return max_val
            if f_val < -max_val:
                return -max_val
            return round(f_val, 2)
        except (ValueError, TypeError):
            return None

    def _compute_product_fields(
        self, stage_name: Optional[str], project_value: Optional[float]
    ) -> dict:
        """Derive probability, risk_matrix, pipeline, and won amount automatically from stage name."""
        project_value = self._sanitize_numeric_15_2(project_value)
        probability, risk_matrix = None, None
        if stage_name and stage_name in STAGE_LOGIC:
            probability, risk_matrix = STAGE_LOGIC[stage_name]

        won_amount = 0.0
        # If stage is 'won' automatically populate full project value
        if stage_name and stage_name == "won":
            probability = 100.0
            risk_matrix = "Revenue"
            won_amount = float(project_value) if project_value is not None else 0.0

        pipeline = None
        if project_value is not None and probability is not None:
            pipeline = round(float(project_value) * (probability / 100), 2)

        return {
            "project_value": project_value,
            "probability": probability,
            "risk_matrix": risk_matrix,
            "pipeline": self._sanitize_numeric_15_2(pipeline),
            "won": self._sanitize_numeric_15_2(won_amount)
        }

    async def _upsert_contact(self, lead: LeadRegister, phone_no_2: Optional[str] = None, region: Optional[str] = None) -> None:
        """
        Auto-insert or update contact details from lead payload into sales.contacts table.
        """
        if not lead.contact_name or not lead.company:
            return
        # Check duplicate by company + contact_name
        stmt = (
            select(Contact)
            .where(Contact.company == lead.company)
            .where(Contact.contact_name == lead.contact_name)
        )

        result = await self.session.execute(stmt)
        existing = result.scalars().first()
        
        if existing:
            existing.created_by = existing.created_by or lead.lead_owner_id
            existing.designation = lead.designation or existing.designation
            existing.phone_no_1 = lead.phone_no or existing.phone_no_1
            existing.phone_no_2 = phone_no_2 or existing.phone_no_2
            existing.email = lead.email or existing.email
            existing.country = lead.country or existing.country
            existing.region = region or existing.region
        else:
            contact = Contact(
                created_by=lead.lead_owner_id,
                company=lead.company,
                contact_name=lead.contact_name,
                designation=lead.designation,
                phone_no_1=lead.phone_no or "N/A",
                phone_no_2=phone_no_2,
                email=lead.email or "N/A",
                country=lead.country,
                region=region,
            )
            self.session.add(contact)

    # ── Notification Helper ──────────────────────────────────────────────────

    async def _notify_lead_creation(self, created_lead: LeadRegister, lead: LeadRegister, current_user: Optional[Any] = None) -> None:
        updater_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
        lead_owner_name = (created_lead.lead_owner_name if created_lead else None) or (
            f"{created_lead.owner_leader.first_name} {created_lead.owner_leader.last_name}" if (created_lead and created_lead.owner_leader) else "N/A"
        )
        company_name = (created_lead.company if created_lead else lead.company) or "N/A"
        contact_name = (created_lead.contact_name if created_lead else lead.contact_name) or "N/A"

        # 1. In-App Notifications for Super Admin & Admin
        from app.models.sales.sales_notification import SalesNotification
        from sqlalchemy import func, or_

        notification_msg = (
            f"New Lead Created: Lead Owner: {lead_owner_name}, Lead ID: {lead.lead_id}, "
            f"Company Name: {company_name}, Contact Name: {contact_name}"
        )

        admin_stmt = select(Leader).where(
            or_(
                func.lower(func.replace(func.trim(Leader.role), '_', ' ')).in_(["super admin", "admin", "ceo", "cfo"]),
                func.upper(func.trim(Leader.designation)).in_(["CEO", "CFO"])
            )
        )
        admin_res = await self.session.execute(admin_stmt)
        recipients = admin_res.scalars().all()

        updater_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
        updater_desig = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
        is_updater_exec = updater_role in ["super admin", "admin", "ceo", "cfo"] or updater_desig in ["CEO", "CFO"]

        if not is_updater_exec:
            for recipient in recipients:
                notif = SalesNotification(
                    user_id=recipient.emp_id,
                    id=lead.lead_id,
                    notification_type="LEAD_CREATED",
                    message=notification_msg,
                    is_viewed=False
                )
                self.session.add(notif)
            await self.session.flush()

    # ── LeadRegister CRUD ────────────────────────────────────────────────────────

    async def create_lead(
        self, lead: LeadRegister, products_data: List[dict], proposals_data: Optional[List[dict]] = None, phone_no_2: Optional[str] = None, region: Optional[str] = None, current_user: Optional[Any] = None
    ) -> List[LeadRegister]:
        """
        Creates lead register record(s).
        Each product entry receives its own LeadRegister with a unique lead_id.
        If no products are provided, a single LeadRegister with 0 products is created.
        """
        created_leads: List[LeadRegister] = []

        if not products_data:
            self.session.add(lead)
            await self.session.flush()
            await self._upsert_contact(lead, phone_no_2=phone_no_2, region=region)
            if proposals_data:
                for prop in proposals_data:
                    p_dict = prop if isinstance(prop, dict) else prop.model_dump(exclude_unset=True)
                    if p_dict.get("url"):
                        self.session.add(ProposalSent(
                            lead_id=lead.lead_id,
                            url=p_dict.get("url"),
                            remarks=p_dict.get("remarks"),
                            proposal_type=p_dict.get("proposal_type"),
                            created_by=getattr(current_user, "leader_id", None) if current_user else None,
                        ))
            await self.session.flush()
            created_lead = await self.get_lead_by_id(lead.lead_id, is_executive=True)
            if created_lead:
                created_leads.append(created_lead)
                await self._notify_lead_creation(created_lead, lead, current_user)
        else:
            for idx, p in enumerate(products_data):
                if idx == 0:
                    current_lead = lead
                else:
                    current_lead = LeadRegister(
                        lead_owner_id=lead.lead_owner_id,
                        lead_source=lead.lead_source,
                        company=lead.company,
                        contact_name=lead.contact_name,
                        designation=lead.designation,
                        phone_no=lead.phone_no,
                        email=lead.email,
                        country=lead.country,
                        is_active=lead.is_active,
                    )

                self.session.add(current_lead)
                await self.session.flush()  # generates unique sequence lead_id

                stage_name = await self._get_stage_name(p.get("stage_id"))
                p_pv = p.get("project_value")
                computed = self._compute_product_fields(stage_name, p_pv)
                product = ProductRegister(
                    lead_id=current_lead.lead_id,
                    product_id=p.get("product_id"),
                    quantity=p.get("quantity", 1),
                    status_id=p.get("status_id"),
                    stage_id=p.get("stage_id"),
                    won=computed["won"],
                    project_value=computed["project_value"],
                    expected_closure=p.get("expected_closure"),
                    probability=computed["probability"],
                    risk_matrix=computed["risk_matrix"],
                    pipeline=computed["pipeline"],
                )
                self.session.add(product)

                if proposals_data:
                    for prop in proposals_data:
                        p_dict = prop if isinstance(prop, dict) else prop.model_dump(exclude_unset=True)
                        if p_dict.get("url"):
                            self.session.add(ProposalSent(
                                lead_id=current_lead.lead_id,
                                url=p_dict.get("url"),
                                remarks=p_dict.get("remarks"),
                                proposal_type=p_dict.get("proposal_type"),
                                created_by=getattr(current_user, "leader_id", None) if current_user else None,
                            ))

                await self._upsert_contact(current_lead, phone_no_2=phone_no_2, region=region)
                await self.session.flush()

                fetched_lead = await self.get_lead_by_id(current_lead.lead_id, is_executive=True)
                if fetched_lead:
                    created_leads.append(fetched_lead)
                    await self._notify_lead_creation(fetched_lead, current_lead, current_user)

        return created_leads

    async def get_lead_by_id(self, lead_id: str, leader_id: Optional[str] = None, is_executive: bool = False) -> Optional[LeadRegister]:
        stmt = (
            select(LeadRegister)
            .options(
                selectinload(LeadRegister.owner_leader),
                selectinload(LeadRegister.proposals),
                selectinload(LeadRegister.products).selectinload(ProductRegister.product_type),
                selectinload(LeadRegister.products).selectinload(ProductRegister.product_status_type),
                selectinload(LeadRegister.products).selectinload(ProductRegister.stage_status_type),
            )
            .where(LeadRegister.lead_id == lead_id)
        )
        
        if not is_executive:
            stmt = stmt.where(LeadRegister.is_active == True)
            if leader_id is not None:
                stmt = stmt.where(LeadRegister.lead_owner_id == leader_id)

        stmt = stmt.execution_options(populate_existing=True)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_leads(
        self, limit: int = 50, cursor: Optional[str] = None, leader_id: Optional[str] = None, 
        is_executive: bool = False, is_active_filter: Optional[bool] = None, search: Optional[str] = None,
        status_id: Optional[int] = None, stage_id: Optional[int] = None,
        from_date: Optional[date] = None, to_date: Optional[date] = None
    ) -> dict:
        from sqlalchemy import func, or_
        from app.models.sales.lead_register import ProductRegister
        from datetime import datetime, time
        
        base_query = select(LeadRegister)
        count_query = select(func.count()).select_from(LeadRegister)

        if not is_executive:
            base_query = base_query.where(LeadRegister.is_active == True)
            count_query = count_query.where(LeadRegister.is_active == True)
            if leader_id is not None:
                base_query = base_query.where(LeadRegister.lead_owner_id == leader_id)
                count_query = count_query.where(LeadRegister.lead_owner_id == leader_id)
        else:
            if is_active_filter is not None:
                base_query = base_query.where(LeadRegister.is_active == is_active_filter)
                count_query = count_query.where(LeadRegister.is_active == is_active_filter)

        if from_date is not None:
            start_dt = datetime.combine(from_date, time.min)
            base_query = base_query.where(LeadRegister.created_date >= start_dt)
            count_query = count_query.where(LeadRegister.created_date >= start_dt)

        if to_date is not None:
            end_dt = datetime.combine(to_date, time.max)
            base_query = base_query.where(LeadRegister.created_date <= end_dt)
            count_query = count_query.where(LeadRegister.created_date <= end_dt)

        # Status & Stage filters (applied on joined ProductRegister)
        if status_id is not None or stage_id is not None:
            base_query = base_query.join(LeadRegister.products)
            count_query = count_query.join(LeadRegister.products)

            if status_id is not None:
                base_query = base_query.where(ProductRegister.status_id == status_id)
                count_query = count_query.where(ProductRegister.status_id == status_id)

            if stage_id is not None:
                base_query = base_query.where(ProductRegister.stage_id == stage_id)
                count_query = count_query.where(ProductRegister.stage_id == stage_id)

            base_query = base_query.distinct()

        if search:
            search_pattern = f"%{search.strip()}%"
            base_query = base_query.outerjoin(Leader, LeadRegister.lead_owner_id == Leader.leader_id)
            count_query = count_query.outerjoin(Leader, LeadRegister.lead_owner_id == Leader.leader_id)

            search_filter = or_(
                LeadRegister.company.ilike(search_pattern),
                LeadRegister.contact_name.ilike(search_pattern),
                LeadRegister.lead_id.ilike(search_pattern),
                Leader.first_name.ilike(search_pattern),
                Leader.last_name.ilike(search_pattern),
                func.concat(Leader.first_name, ' ', Leader.last_name).ilike(search_pattern),
                LeadRegister.designation.ilike(search_pattern),
                LeadRegister.lead_source.ilike(search_pattern),
                LeadRegister.country.ilike(search_pattern),
                LeadRegister.email.ilike(search_pattern),
                LeadRegister.phone_no.ilike(search_pattern),
            )
            base_query = base_query.where(search_filter)
            count_query = count_query.where(search_filter)

        if cursor is not None:
            # Using desc order for leads, so we want IDs smaller than cursor
            base_query = base_query.where(LeadRegister.lead_id < cursor)

        total = (await self.session.execute(count_query)).scalar_one()

        stmt = (
            base_query
            .options(
                selectinload(LeadRegister.owner_leader),
                selectinload(LeadRegister.proposals),
                selectinload(LeadRegister.products).selectinload(ProductRegister.product_type),
                selectinload(LeadRegister.products).selectinload(ProductRegister.product_status_type),
                selectinload(LeadRegister.products).selectinload(ProductRegister.stage_status_type),
            )
            .order_by(LeadRegister.created_date.desc(), LeadRegister.lead_id.desc())
            .limit(limit)
        )

        result = await self.session.execute(stmt)
        leads = list(result.scalars().all())

        next_cursor = leads[-1].lead_id if leads else None

        return {
            "total": total,
            "data": leads,
            "limit": limit,
            "next_cursor": next_cursor,
            "has_more": len(leads) == limit
        }

    async def _get_stage_name_by_id(self, stage_id: Optional[int]) -> Optional[str]:
        if stage_id is None:
            return None
        stmt = select(LeaderStageStatusType).where(LeaderStageStatusType.id == stage_id)
        result = await self.session.execute(stmt)
        obj = result.scalar_one_or_none()
        return obj.leader_stage if obj else None

    async def update_lead(
        self, lead_id: str, update_data: dict, current_user: Optional[Any] = None
    ) -> Optional[LeadRegister]:
        products_data = update_data.pop("products", None)
        proposals_data = update_data.pop("proposals", None)
        phone_no_2 = update_data.pop("phone_no_2", None)
        region = update_data.pop("region", None)

        if update_data:
            from sqlalchemy import func
            update_data["updated_at"] = func.now()
            stmt = (
                update(LeadRegister)
                .where(LeadRegister.lead_id == lead_id)
                .values(**update_data)
                .execution_options(synchronize_session="fetch")
            )
            await self.session.execute(stmt)
            await self.session.flush()

        updated_lead = await self.get_lead_by_id(lead_id, is_executive=True)
        if updated_lead:
            if proposals_data:
                for prop in proposals_data:
                    p_dict = prop if isinstance(prop, dict) else prop.model_dump(exclude_unset=True)
                    if p_dict.get("url"):
                        self.session.add(ProposalSent(
                            lead_id=lead_id,
                            url=p_dict.get("url"),
                            remarks=p_dict.get("remarks"),
                            proposal_type=p_dict.get("proposal_type"),
                            created_by=getattr(current_user, "leader_id", None) if current_user else None,
                        ))
                await self.session.flush()

            if products_data:
                for p_data in products_data:
                    p_reg_id = p_data.pop("product_register_id", None) if isinstance(p_data, dict) else getattr(p_data, "product_register_id", None)
                    p_dict = p_data if isinstance(p_data, dict) else p_data.model_dump(exclude_unset=True)

                    if p_reg_id:
                        # Fetch old product to check stage_id change
                        old_product = await self.get_product_by_id(p_reg_id)
                        old_stage_id = old_product.stage_id if old_product else None

                        updated_prod = await self.update_product(p_reg_id, p_dict)

                        # ── Notification & Email Trigger for Stage Update ─────────────────────────────
                        new_stage_id = p_dict.get("stage_id")
                        updater_designation = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
                        if new_stage_id is not None and old_stage_id != new_stage_id:
                            lead_owner_name = updated_lead.lead_owner_name or "N/A"
                            company_name = updated_lead.company or "N/A"
                            contact_name = updated_lead.contact_name or "N/A"
                            prod_name = updated_prod.product_name if updated_prod else "N/A"
                            stage_str = await self._get_stage_name_by_id(new_stage_id) or "N/A"

                            # 1. In-App Notifications for Super Admin & Admin
                            from app.models.sales.sales_notification import SalesNotification
                            from sqlalchemy import func, or_

                            notification_msg = (
                                f"Lead Owner: {lead_owner_name}, Product Name: {prod_name}, "
                                f"Stage Changed To: {stage_str}, Company Name: {company_name}, "
                                f"Contact Name: {contact_name}"
                            )

                            admin_stmt = select(Leader).where(
                                or_(
                                    func.lower(func.replace(func.trim(Leader.role), '_', ' ')).in_(["super admin", "admin", "ceo", "cfo"]),
                                    func.upper(func.trim(Leader.designation)).in_(["CEO", "CFO"])
                                )
                            )
                            admin_res = await self.session.execute(admin_stmt)
                            recipients = admin_res.scalars().all()

                            updater_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
                            updater_desig = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
                            is_updater_exec = updater_role in ["super admin", "admin", "ceo", "cfo"] or updater_desig in ["CEO", "CFO"]

                            if not is_updater_exec:
                                for recipient in recipients:
                                    notif = SalesNotification(
                                        user_id=recipient.emp_id,
                                        id=lead_id,
                                        notification_type="STAGE_UPDATE",
                                        message=notification_msg,
                                        is_viewed=False
                                    )
                                    self.session.add(notif)
                                await self.session.flush()

                    else:
                        # Add new product to lead
                        await self.create_product(lead_id, p_dict)

            await self._upsert_contact(updated_lead, phone_no_2=phone_no_2, region=region)
            await self.session.flush()

        return await self.get_lead_by_id(lead_id, is_executive=True)

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

    async def delete_lead(self, lead_id: str, is_executive: bool = False, current_user: Optional[Any] = None) -> bool:
        lead_to_delete = await self.get_lead_by_id(lead_id, is_executive=True)

        # Pre-fetch activity IDs BEFORE executing delete statement (prevent FK CASCADE memory loss)
        act_ids = []
        try:
            from app.models.sales.lead_activity_register import LeadActivityRegister
            act_res = await self.session.execute(
                select(LeadActivityRegister.activity_id).where(LeadActivityRegister.lead_id == lead_id)
            )
            act_ids = list(act_res.scalars().all())
        except Exception as err:
            print(f"[delete_lead pre-fetch activity error] {err}", flush=True)

        if is_executive:
            stmt = delete(LeadRegister).where(LeadRegister.lead_id == lead_id)
        else:
            stmt = update(LeadRegister).where(LeadRegister.lead_id == lead_id).values(is_active=False)
            try:
                from app.models.sales.lead_activity_register import LeadActivityRegister
                await self.session.execute(
                    update(LeadActivityRegister)
                    .where(LeadActivityRegister.lead_id == lead_id)
                    .values(is_active=False)
                )
            except Exception as act_err:
                print(f"[delete_lead soft-delete activities error] {act_err}", flush=True)

        result = await self.session.execute(stmt)
        await self.session.flush()

        if act_ids:
            await self._cancel_and_delete_calendar_events(act_ids)

        if lead_to_delete:
            lead_owner_name = lead_to_delete.lead_owner_name or (
                f"{lead_to_delete.owner_leader.first_name} {lead_to_delete.owner_leader.last_name}" if lead_to_delete.owner_leader else "N/A"
            )
            company_name = lead_to_delete.company or "N/A"
            contact_name = lead_to_delete.contact_name or "N/A"

            # 1. In-App Notifications for Super Admin & Admin
            from app.models.sales.sales_notification import SalesNotification
            from sqlalchemy import func, or_, text

            notification_msg = (
                f"Lead Deleted (Inactive): Lead Owner: {lead_owner_name}, Lead ID: {lead_id}, "
                f"Company Name: {company_name}, Contact Name: {contact_name}"
            )

            admin_stmt = select(Leader).where(
                or_(
                    func.lower(func.replace(func.trim(Leader.role), '_', ' ')).in_(["super admin", "admin", "ceo", "cfo"]),
                    func.upper(func.trim(Leader.designation)).in_(["CEO", "CFO"])
                )
            )
            admin_res = await self.session.execute(admin_stmt)
            recipients = admin_res.scalars().all()

            updater_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
            updater_desig = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
            is_updater_exec = updater_role in ["super admin", "admin", "ceo", "cfo"] or updater_desig in ["CEO", "CFO"]

            if not is_updater_exec:
                for recipient in recipients:
                    notif = SalesNotification(
                        user_id=recipient.emp_id,
                        id=lead_id,
                        notification_type="LEAD_DELETED",
                        message=notification_msg,
                        is_viewed=False
                    )
                    self.session.add(notif)
            # Auto-mark/delete notifications for this deleted/deactivated lead for ALL users (Admin, Super Admin, CEO, CFO, User)
            try:
                target_ids = list(set([lead_id] + act_ids))
                conds = [SalesNotification.id.in_(target_ids)]
                for tid in target_ids:
                    conds.append(SalesNotification.message.like(f"%{tid}%"))

                if is_executive:
                    await self.session.execute(
                        delete(SalesNotification).where(or_(*conds))
                    )
                else:
                    await self.session.execute(
                        update(SalesNotification)
                        .where(or_(*conds))
                        .values(is_viewed=True)
                    )
                await self.session.flush()
                try:
                    await self.session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_notifications_mv;"))
                except Exception:
                    await self.session.execute(text("REFRESH MATERIALIZED VIEW sales.sales_notifications_mv;"))
            except Exception as notif_err:
                print(f"[delete_lead Notification Cleanup Error] {notif_err}", flush=True)

        return result.rowcount > 0


    async def create_product(self, lead_id: int, product_data: dict) -> ProductRegister:
        stage_name = await self._get_stage_name(product_data.get("stage_id"))
        p_pv = product_data.get("project_value")
        computed = self._compute_product_fields(stage_name, p_pv)
        product = ProductRegister(
            lead_id=lead_id,
            product_id=product_data.get("product_id"),
            quantity=product_data.get("quantity", 1),
            status_id=product_data.get("status_id"),
            stage_id=product_data.get("stage_id"),
            won=computed["won"],
            project_value=computed["project_value"],
            expected_closure=product_data.get("expected_closure"),
            probability=computed["probability"],
            risk_matrix=computed["risk_matrix"],
            pipeline=computed["pipeline"],
            is_active=product_data.get("is_active", True)
        )
        self.session.add(product)
        await self.session.flush()
        return await self.get_product_by_id(product.product_register_id)

    async def get_product_by_id(self, product_register_id: int) -> Optional[ProductRegister]:
        stmt = (
            select(ProductRegister)
            .options(
                selectinload(ProductRegister.product_type),
                selectinload(ProductRegister.product_status_type),
                selectinload(ProductRegister.stage_status_type),
            )
            .where(ProductRegister.product_register_id == product_register_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


    async def get_products_by_lead(self, lead_id: int) -> List[ProductRegister]:
        stmt = (
            select(ProductRegister)
            .options(
                selectinload(ProductRegister.product_type),
                selectinload(ProductRegister.product_status_type),
                selectinload(ProductRegister.stage_status_type),
            )
            .where(ProductRegister.lead_id == lead_id)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


    async def update_product(
        self, product_register_id: int, update_data: dict
    ) -> Optional[ProductRegister]:
        product = await self.get_product_by_id(product_register_id)
        if not product:
            return None

        # Re-derive computed fields if stage or project_value changed
        stage_id = update_data.get("stage_id", product.stage_id)
        project_value = update_data.get("project_value", product.project_value)
        stage_name = await self._get_stage_name(stage_id)
        computed = self._compute_product_fields(stage_name, project_value)

        update_data["project_value"] = computed["project_value"]
        update_data["probability"] = computed["probability"]
        update_data["risk_matrix"] = computed["risk_matrix"]
        update_data["pipeline"] = computed["pipeline"]
        update_data["won"] = computed["won"]
        from sqlalchemy import func
        update_data["updated_at"] = func.now()

        stmt = (
            update(ProductRegister)
            .where(ProductRegister.product_register_id == product_register_id)
            .values(**update_data)
            .execution_options(synchronize_session="fetch")
        )
        await self.session.execute(stmt)
        await self.session.flush()
        return await self.get_product_by_id(product_register_id)

    # ── ProposalSent CRUD Methods ─────────────────────────────────────────────

    async def create_proposal(
        self, payload: ProposalSentCreate, current_user: Optional[Any] = None
    ) -> ProposalSent:
        created_by = payload.created_by or (current_user.leader_id if current_user else None)
        proposal = ProposalSent(
            lead_id=payload.lead_id,
            url=payload.url,
            remarks=payload.remarks,
            proposal_type=payload.proposal_type,
            created_by=created_by,
        )
        self.session.add(proposal)
        await self.session.flush()
        await self.session.refresh(proposal)
        return proposal

    async def get_proposals_by_lead(self, lead_id: str) -> List[ProposalSent]:
        stmt = (
            select(ProposalSent)
            .where(ProposalSent.lead_id == lead_id)
            .order_by(ProposalSent.created_at.desc())
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def delete_proposal(self, lead_id: str, proposal_sent_id: str) -> bool:
        stmt = delete(ProposalSent).where(
            ProposalSent.lead_id == lead_id,
            ProposalSent.proposal_sent_id == proposal_sent_id
        )
        res = await self.session.execute(stmt)
        await self.session.flush()
        return res.rowcount > 0

    async def delete_product(self, product_register_id: int) -> bool:
        stmt = delete(ProductRegister).where(ProductRegister.product_register_id == product_register_id)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount > 0

    async def delete_all_leads(self, hard_delete: bool = True) -> int:
        if hard_delete:
            stmt = delete(LeadRegister)
        else:
            stmt = update(LeadRegister).values(is_active=False)
            try:
                from app.models.sales.lead_activity_register import LeadActivityRegister
                await self.session.execute(
                    update(LeadActivityRegister).values(is_active=False)
                )
            except Exception as act_err:
                print(f"[delete_all_leads soft-delete activities error] {act_err}", flush=True)
        result = await self.session.execute(stmt)
        try:
            from app.models.sales.sales_notification import SalesNotification
            from sqlalchemy import text
            if hard_delete:
                await self.session.execute(delete(SalesNotification))
            else:
                await self.session.execute(
                    update(SalesNotification).values(is_viewed=True)
                )
            await self.session.flush()
            try:
                await self.session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_notifications_mv;"))
            except Exception:
                await self.session.execute(text("REFRESH MATERIALIZED VIEW sales.sales_notifications_mv;"))
        except Exception as err:
            print(f"[delete_all_leads Notification Cleanup Error] {err}", flush=True)
        await self.session.flush()
        return result.rowcount

    async def bulk_delete_leads(self, lead_ids: List[str], hard_delete: bool = True) -> int:
        if not lead_ids:
            return 0

        # Pre-fetch activity IDs BEFORE executing delete statement (prevent FK CASCADE memory loss)
        act_ids = []
        try:
            from app.models.sales.lead_activity_register import LeadActivityRegister
            act_res = await self.session.execute(
                select(LeadActivityRegister.activity_id).where(LeadActivityRegister.lead_id.in_(lead_ids))
            )
            act_ids = list(act_res.scalars().all())
        except Exception as err:
            print(f"[bulk_delete_leads pre-fetch activity error] {err}", flush=True)

        if hard_delete:
            stmt = delete(LeadRegister).where(LeadRegister.lead_id.in_(lead_ids))
        else:
            stmt = update(LeadRegister).where(LeadRegister.lead_id.in_(lead_ids)).values(is_active=False)
            try:
                from app.models.sales.lead_activity_register import LeadActivityRegister
                await self.session.execute(
                    update(LeadActivityRegister)
                    .where(LeadActivityRegister.lead_id.in_(lead_ids))
                    .values(is_active=False)
                )
            except Exception as act_err:
                print(f"[bulk_delete_leads soft-delete activities error] {act_err}", flush=True)
        result = await self.session.execute(stmt)
        await self.session.flush()

        if act_ids:
            await self._cancel_and_delete_calendar_events(act_ids)
        try:
            from app.models.sales.sales_notification import SalesNotification
            from sqlalchemy import or_, text

            all_target_ids = list(set(lead_ids + act_ids))
            conds = [SalesNotification.id.in_(all_target_ids)]
            for tid in all_target_ids:
                conds.append(SalesNotification.message.like(f"%{tid}%"))

            if hard_delete:
                await self.session.execute(
                    delete(SalesNotification).where(or_(*conds))
                )
            else:
                await self.session.execute(
                    update(SalesNotification)
                    .where(or_(*conds))
                    .values(is_viewed=True)
                )
            await self.session.flush()
            try:
                await self.session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_notifications_mv;"))
            except Exception:
                await self.session.execute(text("REFRESH MATERIALIZED VIEW sales.sales_notifications_mv;"))
        except Exception as err:
            print(f"[bulk_delete_leads Notification Cleanup Error] {err}", flush=True)
        await self.session.flush()
        return result.rowcount

    async def delete_all_proposals(self) -> int:
        stmt = delete(ProposalSent)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def bulk_delete_proposals(self, proposal_ids: List[str]) -> int:
        if not proposal_ids:
            return 0
        stmt = delete(ProposalSent).where(ProposalSent.proposal_sent_id.in_(proposal_ids))
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def delete_all_products(self) -> int:
        stmt = delete(ProductRegister)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def bulk_delete_products(self, product_ids: List[str]) -> int:
        if not product_ids:
            return 0
        stmt = delete(ProductRegister).where(ProductRegister.product_register_id.in_(product_ids))
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def get_leads_dropdown(self, leader_id: Optional[str] = None, is_executive: bool = False) -> List[LeadRegister]:
        """Fetch active leads with minimal fields for dropdown selection lists."""
        stmt = select(LeadRegister).where(LeadRegister.is_active == True)
        if not is_executive and leader_id:
            stmt = stmt.where(LeadRegister.lead_owner_id == leader_id)
        stmt = stmt.order_by(LeadRegister.company.asc(), LeadRegister.lead_id.asc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
