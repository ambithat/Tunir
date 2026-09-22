from typing import List, Optional
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.sales.weekly_pdf_register import WeeklyPdfRegister


class WeeklyPdfRegisterRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_weekly_pdf(self, weekly_pdf: WeeklyPdfRegister) -> WeeklyPdfRegister:
        self.session.add(weekly_pdf)
        await self.session.flush()
        await self.session.refresh(weekly_pdf)
        return weekly_pdf

    async def get_all_weekly_pdfs(self, limit: int = 50, cursor: Optional[str] = None) -> List[WeeklyPdfRegister]:
        stmt = select(WeeklyPdfRegister).where(WeeklyPdfRegister.is_active == True)
        if cursor:
            stmt = stmt.where(WeeklyPdfRegister.weekly_pdf_id < cursor)
        stmt = stmt.order_by(WeeklyPdfRegister.created_at.desc()).limit(limit)
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def get_weekly_pdf_by_id(self, weekly_pdf_id: str) -> Optional[WeeklyPdfRegister]:
        stmt = select(WeeklyPdfRegister).where(
            WeeklyPdfRegister.weekly_pdf_id == weekly_pdf_id,
            WeeklyPdfRegister.is_active == True
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def delete_weekly_pdf(self, weekly_pdf_id: str, hard_delete: bool = True) -> bool:
        if hard_delete:
            stmt = delete(WeeklyPdfRegister).where(WeeklyPdfRegister.weekly_pdf_id == weekly_pdf_id)
        else:
            stmt = update(WeeklyPdfRegister).where(WeeklyPdfRegister.weekly_pdf_id == weekly_pdf_id).values(is_active=False)
        res = await self.session.execute(stmt)
        await self.session.flush()
        return res.rowcount > 0

    async def delete_all_weekly_pdfs(self, hard_delete: bool = True) -> int:
        if hard_delete:
            stmt = delete(WeeklyPdfRegister)
        else:
            stmt = update(WeeklyPdfRegister).values(is_active=False)
        res = await self.session.execute(stmt)
        await self.session.flush()
        return res.rowcount

    async def bulk_delete_weekly_pdfs(self, weekly_pdf_ids: List[str], hard_delete: bool = True) -> int:
        if not weekly_pdf_ids:
            return 0
        if hard_delete:
            stmt = delete(WeeklyPdfRegister).where(WeeklyPdfRegister.weekly_pdf_id.in_(weekly_pdf_ids))
        else:
            stmt = update(WeeklyPdfRegister).where(WeeklyPdfRegister.weekly_pdf_id.in_(weekly_pdf_ids)).values(is_active=False)
        res = await self.session.execute(stmt)
        await self.session.flush()
        return res.rowcount
