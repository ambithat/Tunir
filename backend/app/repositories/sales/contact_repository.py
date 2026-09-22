from typing import List, Optional, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, func

from app.models.sales.contact import Contact


class ContactRepository:
    """Repository for the `contacts` table in sales schema."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_contact(self, contact: Contact) -> Contact:
        self.session.add(contact)
        await self.session.flush()
        return contact

    async def get_contact_by_id(self, contact_id: str, is_executive: bool = False) -> Optional[Contact]:
        stmt = select(Contact).where(Contact.contact_id == contact_id)
        if not is_executive:
            stmt = stmt.where(Contact.is_active == True)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_contact_by_email(self, email: str) -> Optional[Contact]:
        stmt = select(Contact).where(Contact.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_contacts(
        self, limit: int = 50, cursor: Optional[str] = None, leader_id: Optional[str] = None, is_executive: bool = False, is_active_filter: Optional[bool] = None, search: Optional[str] = None
    ) -> dict:
        from sqlalchemy import or_
        from app.models.sales.lead_register import LeadRegister
        from app.models.sales.leader import Leader

        count_stmt = select(func.count(Contact.contact_id)).select_from(Contact)
        base_query = select(Contact)

        if not is_executive:
            base_query = base_query.where(Contact.is_active == True)
            count_stmt = count_stmt.where(Contact.is_active == True)

            if leader_id:
                # Resolve emp_id for the leader if leader_id passed is LDR-xxxx or emp_id
                emp_id_stmt = select(Leader.emp_id).where((Leader.leader_id == leader_id) | (Leader.emp_id == leader_id))
                res_emp = await self.session.execute(emp_id_stmt)
                emp_id_val = res_emp.scalar_one_or_none() or leader_id

                owner_filter = or_(
                    Contact.created_by == leader_id,
                    Contact.created_by == emp_id_val
                )

                base_query = base_query.where(owner_filter)
                count_stmt = count_stmt.where(owner_filter)
        else:
            if is_active_filter is not None:
                base_query = base_query.where(Contact.is_active == is_active_filter)
                count_stmt = count_stmt.where(Contact.is_active == is_active_filter)

        if search:
            search_pattern = f"%{search.strip()}%"
            search_filter = or_(
                Contact.company.ilike(search_pattern),
                Contact.contact_name.ilike(search_pattern),
                Contact.designation.ilike(search_pattern),
                Contact.email.ilike(search_pattern),
                Contact.phone_no_1.ilike(search_pattern),
                Contact.country.ilike(search_pattern),
            )
            base_query = base_query.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        if cursor is not None:
            base_query = base_query.where(Contact.contact_id < cursor)

        total = (await self.session.execute(count_stmt)).scalar_one()

        stmt = base_query.order_by(Contact.created_at.desc(), Contact.contact_id.desc()).limit(limit)
        result = await self.session.execute(stmt)
        contacts = list(result.scalars().all())

        next_cursor = contacts[-1].contact_id if contacts else None

        return {
            "total": total,
            "data": contacts,
            "limit": limit,
            "next_cursor": next_cursor,
            "has_more": len(contacts) == limit,
        }

    async def get_contacts_dropdown(self, leader_id: Optional[str] = None, is_executive: bool = False) -> List[Contact]:
        from sqlalchemy import or_
        from app.models.sales.leader import Leader

        stmt = select(Contact).where(Contact.is_active == True)

        if not is_executive and leader_id:
            emp_id_stmt = select(Leader.emp_id).where((Leader.leader_id == leader_id) | (Leader.emp_id == leader_id))
            res_emp = await self.session.execute(emp_id_stmt)
            emp_id_val = res_emp.scalar_one_or_none() or leader_id

            owner_filter = or_(
                Contact.created_by == leader_id,
                Contact.created_by == emp_id_val
            )
            stmt = stmt.where(owner_filter)

        stmt = stmt.order_by(Contact.contact_name.asc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_contact(self, contact_id: int, update_data: dict) -> Optional[Contact]:
        if not update_data:
            return await self.get_contact_by_id(contact_id)

        stmt = (
            update(Contact)
            .where(Contact.contact_id == contact_id)
            .values(**update_data)
            .execution_options(synchronize_session="fetch")
        )
        await self.session.execute(stmt)
        await self.session.flush()
        return await self.get_contact_by_id(contact_id)

    async def delete_contact(self, contact_id: int, is_executive: bool = False) -> bool:
        if is_executive:
            stmt = delete(Contact).where(Contact.contact_id == contact_id)
        else:
            stmt = update(Contact).where(Contact.contact_id == contact_id).values(is_active=False)
            
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount > 0

    async def delete_all_contacts(self, hard_delete: bool = True) -> int:
        if hard_delete:
            stmt = delete(Contact)
        else:
            stmt = update(Contact).values(is_active=False)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def bulk_delete_contacts(self, contact_ids: List[Union[str, int]], hard_delete: bool = True) -> int:
        if not contact_ids:
            return 0
        clean_ids = [str(i).strip() for i in contact_ids if i is not None and str(i).strip()]
        if not clean_ids:
            return 0
        if hard_delete:
            stmt = delete(Contact).where(Contact.contact_id.in_(clean_ids))
        else:
            stmt = update(Contact).where(Contact.contact_id.in_(clean_ids)).values(is_active=False)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount
