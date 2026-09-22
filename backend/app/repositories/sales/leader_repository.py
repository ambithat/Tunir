from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, func

from app.models.sales.leader import Leader
from app.models.sales.proposal_sent import ProposalSent
from app.models.sales.leader_reassignment_history import LeaderReassignmentHistory
from app.security.security_utils import encrypt_password as fernet_encrypt, decrypt_password as fernet_decrypt


class LeaderRepository:
    """Repository for the `leaders` table in sales schema."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify plain password against Fernet cipher (with fallback to legacy pg_crypto crypt)."""
        if not plain_password or not hashed_password:
            return False

        # 1. Try Fernet decryption
        decrypted = fernet_decrypt(hashed_password)
        if decrypted and decrypted == plain_password:
            return True

        # 2. Fallback check for legacy pg_crypto crypt() hashes
        try:
            stmt = select(func.crypt(plain_password, hashed_password) == hashed_password)
            result = await self.session.execute(stmt)
            return bool(result.scalar_one_or_none())
        except Exception:
            return False

    async def encrypt_password(self, plain_password: str) -> str:
        """Encrypt password using Fernet cipher."""
        return fernet_encrypt(plain_password)

    async def create_leader(self, leader: Leader) -> Leader:
        plain_password = leader.password
        if plain_password:
            leader.password = await self.encrypt_password(plain_password)
        self.session.add(leader)
        await self.session.flush()

        # Expunge object from session so setting decrypted password won't flush to DB
        self.session.expunge(leader)
        if plain_password:
            leader.password = plain_password
        return leader

    async def get_leader_by_id(self, leader_id: str) -> Optional[Leader]:
        stmt = select(Leader).where(Leader.leader_id == leader_id)
        result = await self.session.execute(stmt)
        leader = result.scalar_one_or_none()
        if leader:
            self.session.expunge(leader)
            if leader.password:
                leader.password = fernet_decrypt(leader.password)
        return leader

    async def get_leader_by_emp_id(self, emp_id: str) -> Optional[Leader]:
        stmt = select(Leader).where(Leader.emp_id == emp_id)
        result = await self.session.execute(stmt)
        leader = result.scalar_one_or_none()
        if leader:
            self.session.expunge(leader)
            if leader.password:
                leader.password = fernet_decrypt(leader.password)
        return leader

    async def get_leader_by_email(self, email: str) -> Optional[Leader]:
        stmt = select(Leader).where(Leader.email == email)
        result = await self.session.execute(stmt)
        leader = result.scalar_one_or_none()
        if leader:
            self.session.expunge(leader)
            if leader.password:
                leader.password = fernet_decrypt(leader.password)
        return leader

    async def get_all_leaders(
        self, limit: int = 50, cursor: Optional[str] = None, search: Optional[str] = None, is_active: Optional[bool] = None
    ) -> dict:
        from sqlalchemy import or_

        count_stmt = select(func.count()).select_from(Leader)
        base_query = select(Leader)

        if is_active is not None:
            base_query = base_query.where(Leader.is_active == is_active)
            count_stmt = count_stmt.where(Leader.is_active == is_active)

        if search:
            search_pattern = f"%{search.strip()}%"
            search_filter = or_(
                Leader.first_name.ilike(search_pattern),
                Leader.last_name.ilike(search_pattern),
                func.concat(Leader.first_name, ' ', Leader.last_name).ilike(search_pattern),
                Leader.email.ilike(search_pattern),
                Leader.designation.ilike(search_pattern),
                Leader.emp_id.ilike(search_pattern),
                Leader.leader_id.ilike(search_pattern),
            )
            base_query = base_query.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        if cursor is not None:
            base_query = base_query.where(Leader.emp_id > cursor)

        total = (await self.session.execute(count_stmt)).scalar_one()

        stmt = base_query.order_by(Leader.emp_id.asc()).limit(limit)
        result = await self.session.execute(stmt)
        leaders = list(result.scalars().all())

        next_cursor = leaders[-1].emp_id if leaders else None

        return {
            "total": total,
            "data": leaders,
            "limit": limit,
            "next_cursor": next_cursor,
            "has_more": len(leaders) == limit,
        }

    async def get_leaders_dropdown(self) -> List[Leader]:
        stmt = select(Leader).order_by(Leader.emp_id.asc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_leader(self, leader_id: str, update_data: dict) -> Optional[Leader]:
        if not update_data:
            return await self.get_leader_by_id(leader_id)

        if "password" in update_data and update_data["password"]:
            update_data["password"] = await self.encrypt_password(update_data["password"])

        stmt = (
            update(Leader)
            .where(Leader.leader_id == leader_id)
            .values(**update_data)
            .execution_options(synchronize_session="fetch")
        )
        await self.session.execute(stmt)

        if update_data.get("is_active") is False:
            leader = await self.get_leader_by_id(leader_id)
            if leader and leader.emp_id:
                from app.models.auth import Auth
                auth_stmt = delete(Auth).where(Auth.emp_id == leader.emp_id)
                await self.session.execute(auth_stmt)

        await self.session.flush()

        if "emp_id" in update_data:
            try:
                from sqlalchemy import text
                await self.session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY sales.sales_notifications_mv;"))
                await self.session.flush()
            except Exception as mv_err:
                pass

        return await self.get_leader_by_id(leader_id)

    async def delete_leader(self, leader_id: str) -> bool:
        stmt = delete(Leader).where(Leader.leader_id == leader_id)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount > 0

    async def offboard_and_reassign_leader(
        self, source_leader_id: str, target_leader_id: str, reassigned_by: Optional[str] = None, deactivate_source: bool = False
    ) -> dict:
        from app.models.sales.lead_register import LeadRegister
        from app.models.sales.lead_activity_register import LeadActivityRegister
        from app.models.sales.leader_reassignment_history import LeaderReassignmentHistory
        from app.models.auth import Auth

        # 1. Reassign leads in sales.lead_register
        lead_stmt = (
            update(LeadRegister)
            .where(LeadRegister.lead_owner_id == source_leader_id)
            .values(lead_owner_id=target_leader_id)
        )
        lead_res = await self.session.execute(lead_stmt)
        reassigned_leads = lead_res.rowcount

        # 2. Reassign activities in sales.daily_activity
        activity_stmt = (
            update(LeadActivityRegister)
            .where(LeadActivityRegister.lead_owner_id == source_leader_id)
            .values(lead_owner_id=target_leader_id)
        )
        activity_res = await self.session.execute(activity_stmt)
        reassigned_activities = activity_res.rowcount

        # 3. Optional Deactivation of source leader (only if offboarding)
        if deactivate_source:
            source_leader = await self.get_leader_by_id(source_leader_id)
            deactivate_stmt = (
                update(Leader)
                .where(Leader.leader_id == source_leader_id)
                .values(is_active=False)
            )
            await self.session.execute(deactivate_stmt)

            if source_leader and source_leader.emp_id:
                auth_stmt = delete(Auth).where(Auth.emp_id == source_leader.emp_id)
                await self.session.execute(auth_stmt)

        # 5. Record Audit History Entry
        history_entry = LeaderReassignmentHistory(
            source_leader_id=source_leader_id,
            target_leader_id=target_leader_id,
            reassigned_by=reassigned_by,
            reassigned_leads_count=reassigned_leads,
            reassigned_activities_count=reassigned_activities
        )
        self.session.add(history_entry)
        await self.session.flush()

        return {
            "reassigned_leads": reassigned_leads,
            "reassigned_activities": reassigned_activities,
        }

    async def reassign_products_granularly(
        self,
        source_leader_id: str,
        product_assignments: list[dict],
        default_target_leader_id: Optional[str] = None,
        reassigned_by: Optional[str] = None,
        deactivate_source: bool = False
    ) -> dict:
        from app.models.sales.lead_register import LeadRegister, ProductRegister
        from app.models.sales.lead_activity_register import LeadActivityRegister
        from app.models.sales.leader_reassignment_history import LeaderReassignmentHistory
        from app.models.auth import Auth

        reassigned_products = 0
        reassigned_leads = 0
        reassigned_activities = 0

        # 1. Update explicit product assignments
        for item in product_assignments:
            prd_id = item.get("product_register_id")
            tgt_id = item.get("target_leader_id")
            if prd_id and tgt_id:
                p_stmt = (
                    update(ProductRegister)
                    .where(ProductRegister.product_register_id == prd_id)
                    .values(product_owner_id=tgt_id)
                )
                p_res = await self.session.execute(p_stmt)
                reassigned_products += p_res.rowcount

                # Fetch parent lead_id for this product
                lead_id_stmt = select(ProductRegister.lead_id).where(ProductRegister.product_register_id == prd_id)
                lead_id = (await self.session.execute(lead_id_stmt)).scalar_one_or_none()

                if lead_id:
                    # Reassign tasks/activities for this lead to the delegated product owner
                    act_stmt = (
                        update(LeadActivityRegister)
                        .where(
                            LeadActivityRegister.lead_id == lead_id,
                            LeadActivityRegister.lead_owner_id == source_leader_id
                        )
                        .values(lead_owner_id=tgt_id)
                    )
                    act_res = await self.session.execute(act_stmt)
                    reassigned_activities += act_res.rowcount

                    # Update parent lead owner if owned by source_leader_id
                    lead_stmt = (
                        update(LeadRegister)
                        .where(
                            LeadRegister.lead_id == lead_id,
                            LeadRegister.lead_owner_id == source_leader_id
                        )
                        .values(lead_owner_id=tgt_id)
                    )
                    lead_res = await self.session.execute(lead_stmt)
                    reassigned_leads += lead_res.rowcount

        # 2. If default_target_leader_id is specified, reassign remaining unassigned products, leads, and activities
        if default_target_leader_id:
            p_fallback_stmt = (
                update(ProductRegister)
                .where(
                    (ProductRegister.product_owner_id == source_leader_id) |
                    (
                        (ProductRegister.product_owner_id.is_(None)) &
                        (ProductRegister.lead_id.in_(
                            select(LeadRegister.lead_id).where(LeadRegister.lead_owner_id == source_leader_id)
                        ))
                    )
                )
                .values(product_owner_id=default_target_leader_id)
            )
            p_fall_res = await self.session.execute(p_fallback_stmt)
            reassigned_products += p_fall_res.rowcount

            lead_stmt = (
                update(LeadRegister)
                .where(LeadRegister.lead_owner_id == source_leader_id)
                .values(lead_owner_id=default_target_leader_id)
            )
            lead_res = await self.session.execute(lead_stmt)
            reassigned_leads += lead_res.rowcount

            activity_stmt = (
                update(LeadActivityRegister)
                .where(LeadActivityRegister.lead_owner_id == source_leader_id)
                .values(lead_owner_id=default_target_leader_id)
            )
            activity_res = await self.session.execute(activity_stmt)
            reassigned_activities += activity_res.rowcount

        # 3. Optional Deactivation of source leader
        if deactivate_source:
            source_leader = await self.get_leader_by_id(source_leader_id)
            deactivate_stmt = (
                update(Leader)
                .where(Leader.leader_id == source_leader_id)
                .values(is_active=False)
            )
            await self.session.execute(deactivate_stmt)

            if source_leader and source_leader.emp_id:
                auth_stmt = delete(Auth).where(Auth.emp_id == source_leader.emp_id)
                await self.session.execute(auth_stmt)

        # 4. Record Audit History Entry
        primary_target = default_target_leader_id or (product_assignments[0].get("target_leader_id") if product_assignments else "MULTIPLE")
        history_entry = LeaderReassignmentHistory(
            source_leader_id=source_leader_id,
            target_leader_id=primary_target,
            reassigned_by=reassigned_by,
            reassigned_products_count=reassigned_products,
            reassigned_leads_count=reassigned_leads,
            reassigned_activities_count=reassigned_activities
        )
        self.session.add(history_entry)
        await self.session.flush()

        return {
            "reassigned_products": reassigned_products,
            "reassigned_leads": reassigned_leads,
            "reassigned_activities": reassigned_activities,
        }

    async def create_reassignment_history(self, history_data: dict) -> LeaderReassignmentHistory:
        from app.models.sales.leader_reassignment_history import LeaderReassignmentHistory
        entry = LeaderReassignmentHistory(**history_data)
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def get_reassignment_history_by_id(self, history_id: int) -> Optional[dict]:
        from app.models.sales.leader_reassignment_history import LeaderReassignmentHistory
        from sqlalchemy.orm import aliased

        SourceLeader = aliased(Leader, name="source_leader")
        TargetLeader = aliased(Leader, name="target_leader")
        ByLeader = aliased(Leader, name="by_leader")

        stmt = (
            select(
                LeaderReassignmentHistory.id,
                LeaderReassignmentHistory.source_leader_id,
                func.trim(func.concat(SourceLeader.first_name, ' ', func.coalesce(SourceLeader.last_name, ''))).label("source_leader_name"),
                LeaderReassignmentHistory.target_leader_id,
                func.trim(func.concat(TargetLeader.first_name, ' ', func.coalesce(TargetLeader.last_name, ''))).label("target_leader_name"),
                LeaderReassignmentHistory.reassigned_by,
                func.trim(func.concat(ByLeader.first_name, ' ', func.coalesce(ByLeader.last_name, ''))).label("reassigned_by_name"),
                LeaderReassignmentHistory.reassigned_leads_count,
                LeaderReassignmentHistory.reassigned_activities_count,
                LeaderReassignmentHistory.created_at,
            )
            .outerjoin(SourceLeader, (LeaderReassignmentHistory.source_leader_id == SourceLeader.leader_id) | (LeaderReassignmentHistory.source_leader_id == SourceLeader.emp_id))
            .outerjoin(TargetLeader, (LeaderReassignmentHistory.target_leader_id == TargetLeader.leader_id) | (LeaderReassignmentHistory.target_leader_id == TargetLeader.emp_id))
            .outerjoin(ByLeader, (LeaderReassignmentHistory.reassigned_by == ByLeader.emp_id) | (LeaderReassignmentHistory.reassigned_by == ByLeader.leader_id))
            .where(LeaderReassignmentHistory.id == history_id)
        )
        result = await self.session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def get_reassignment_history(self, limit: int = 50, offset: int = 0, search: Optional[str] = None) -> dict:
        from app.models.sales.leader_reassignment_history import LeaderReassignmentHistory
        from sqlalchemy.orm import aliased
        from sqlalchemy import or_

        SourceLeader = aliased(Leader, name="source_leader")
        TargetLeader = aliased(Leader, name="target_leader")
        ByLeader = aliased(Leader, name="by_leader")

        count_stmt = select(func.count()).select_from(LeaderReassignmentHistory)

        base_stmt = (
            select(
                LeaderReassignmentHistory.id,
                LeaderReassignmentHistory.source_leader_id,
                func.trim(func.concat(SourceLeader.first_name, ' ', func.coalesce(SourceLeader.last_name, ''))).label("source_leader_name"),
                LeaderReassignmentHistory.target_leader_id,
                func.trim(func.concat(TargetLeader.first_name, ' ', func.coalesce(TargetLeader.last_name, ''))).label("target_leader_name"),
                LeaderReassignmentHistory.reassigned_by,
                func.trim(func.concat(ByLeader.first_name, ' ', func.coalesce(ByLeader.last_name, ''))).label("reassigned_by_name"),
                LeaderReassignmentHistory.reassigned_leads_count,
                LeaderReassignmentHistory.reassigned_activities_count,
                LeaderReassignmentHistory.created_at,
            )
            .outerjoin(SourceLeader, (LeaderReassignmentHistory.source_leader_id == SourceLeader.leader_id) | (LeaderReassignmentHistory.source_leader_id == SourceLeader.emp_id))
            .outerjoin(TargetLeader, (LeaderReassignmentHistory.target_leader_id == TargetLeader.leader_id) | (LeaderReassignmentHistory.target_leader_id == TargetLeader.emp_id))
            .outerjoin(ByLeader, (LeaderReassignmentHistory.reassigned_by == ByLeader.emp_id) | (LeaderReassignmentHistory.reassigned_by == ByLeader.leader_id))
        )

        if search:
            search_pattern = f"%{search.strip()}%"
            search_filter = or_(
                LeaderReassignmentHistory.source_leader_id.ilike(search_pattern),
                LeaderReassignmentHistory.target_leader_id.ilike(search_pattern),
                LeaderReassignmentHistory.reassigned_by.ilike(search_pattern),
                SourceLeader.first_name.ilike(search_pattern),
                TargetLeader.first_name.ilike(search_pattern),
            )
            base_stmt = base_stmt.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        total = (await self.session.execute(count_stmt)).scalar_one()

        stmt = base_stmt.order_by(LeaderReassignmentHistory.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        rows = result.mappings().all()

        return {
            "total": total,
            "data": [dict(row) for row in rows],
            "limit": limit,
            "offset": offset,
            "has_more": (offset + len(rows)) < total
        }

    async def update_reassignment_history(self, history_id: int, update_data: dict) -> Optional[dict]:
        from app.models.sales.leader_reassignment_history import LeaderReassignmentHistory
        if not update_data:
            return await self.get_reassignment_history_by_id(history_id)

        stmt = (
            update(LeaderReassignmentHistory)
            .where(LeaderReassignmentHistory.id == history_id)
            .values(**update_data)
        )
        await self.session.execute(stmt)
        await self.session.flush()
        return await self.get_reassignment_history_by_id(history_id)

    async def delete_reassignment_history(self, history_id: int) -> bool:
        from app.models.sales.leader_reassignment_history import LeaderReassignmentHistory
        stmt = delete(LeaderReassignmentHistory).where(LeaderReassignmentHistory.id == history_id)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount > 0

    async def get_leader_products(self, leader_id: str) -> list[dict]:
        """Fetch all products associated with a specific leader for UI product reassignment modal."""
        from app.models.sales.lead_register import LeadRegister, ProductRegister
        from sqlalchemy import or_
        from sqlalchemy.orm import selectinload

        stmt = (
            select(ProductRegister)
            .join(LeadRegister, ProductRegister.lead_id == LeadRegister.lead_id)
            .where(
                or_(
                    ProductRegister.product_owner_id == leader_id,
                    (ProductRegister.product_owner_id.is_(None) & (LeadRegister.lead_owner_id == leader_id))
                )
            )
            .options(
                selectinload(ProductRegister.product_type),
                selectinload(ProductRegister.stage_status_type),
                selectinload(ProductRegister.product_status_type),
            )
        )
        res = await self.session.execute(stmt)
        products = res.scalars().all()

        out = []
        for p in products:
            lead_stmt = select(LeadRegister).where(LeadRegister.lead_id == p.lead_id)
            ld_res = await self.session.execute(lead_stmt)
            ld = ld_res.scalar_one_or_none()

            out.append({
                "product_register_id": p.product_register_id,
                "product_type_id": p.product_id,
                "product_name": p.product_type.product if p.product_type else "N/A",
                "lead_id": p.lead_id,
                "company_name": ld.company if ld else "N/A",
                "stage": p.stage_status_type.leader_stage if p.stage_status_type else "N/A",
                "project_value": float(p.project_value or 0),
                "current_product_owner_id": p.product_owner_id or (ld.lead_owner_id if ld else None)
            })
        return out

    async def delete_all_leaders(self, hard_delete: bool = True) -> int:
        if hard_delete:
            stmt = delete(Leader)
        else:
            stmt = update(Leader).values(is_active=False)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def bulk_delete_leaders(self, leader_ids: List[str], hard_delete: bool = True) -> int:
        if not leader_ids:
            return 0
        if hard_delete:
            stmt = delete(Leader).where(Leader.leader_id.in_(leader_ids))
        else:
            stmt = update(Leader).where(Leader.leader_id.in_(leader_ids)).values(is_active=False)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

