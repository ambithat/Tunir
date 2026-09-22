import uuid
from typing import List, Optional, Any
from datetime import date
from fastapi import HTTPException, status

from app.repositories.sales.weekly_pdf_register_repository import WeeklyPdfRegisterRepository
from app.models.sales.weekly_pdf_register import WeeklyPdfRegister
from app.schemas.sales.weekly_pdf_register_schema import WeeklyPdfRegisterCreate


class WeeklyPdfRegisterService:
    def __init__(self, repo: WeeklyPdfRegisterRepository):
        self.repo = repo

    def _generate_weekly_pdf_id(self) -> str:
        return f"WPDF-{uuid.uuid4().hex[:8].upper()}"

    async def create_weekly_pdf_record(
        self, payload: WeeklyPdfRegisterCreate, weekly_pdf_id: Optional[str] = None
    ) -> WeeklyPdfRegister:
        pdf_id = weekly_pdf_id or self._generate_weekly_pdf_id()
        report_dt = payload.report_date or date.today()
        record = WeeklyPdfRegister(
            weekly_pdf_id=pdf_id,
            report_date=report_dt,
            pdf_url=payload.pdf_url,
            filename=payload.filename,
            file_size_bytes=payload.file_size_bytes,
        )
        return await self.repo.create_weekly_pdf(record)

    async def get_all_weekly_pdfs(self, limit: int = 50, cursor: Optional[str] = None) -> List[WeeklyPdfRegister]:
        return await self.repo.get_all_weekly_pdfs(limit=limit, cursor=cursor)

    async def get_weekly_pdf_by_id(self, weekly_pdf_id: str) -> WeeklyPdfRegister:
        record = await self.repo.get_weekly_pdf_by_id(weekly_pdf_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Weekly PDF record '{weekly_pdf_id}' not found."
            )
        return record

    async def delete_weekly_pdf(self, weekly_pdf_id: str) -> bool:
        await self.get_weekly_pdf_by_id(weekly_pdf_id)
        return await self.repo.delete_weekly_pdf(weekly_pdf_id)

    async def delete_all_weekly_pdfs(self, current_user: Optional[Any] = None) -> int:
        user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ") if current_user else ""
        user_desig = (getattr(current_user, "designation", "") or "").strip().upper() if current_user else ""
        is_super_admin = user_role in ["super admin", "admin"] or user_desig in ["CFO", "CEO"]
        if not is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admin / CFO can perform bulk delete all operations."
            )
        return await self.repo.delete_all_weekly_pdfs()

    async def bulk_delete_weekly_pdfs(self, weekly_pdf_ids: List[str], current_user: Optional[Any] = None) -> int:
        str_ids = [str(i) for i in weekly_pdf_ids]
        return await self.repo.bulk_delete_weekly_pdfs(str_ids)
