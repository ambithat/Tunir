from prompt_toolkit import formatted_text
from pydantic import error_wrappers
import uuid
from typing import  Optional,List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, cast, and_, or_,func
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.orm import joinedload
from sqlalchemy.engine import RowMapping
from app.models.tracking.tracker import Tracker,TrackerHistory
from app.models.sales.leader import Leader

from app.repositories.base_repository import AbstractRepository


class TrackerRepository():
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_tracker(self, tracker_data_obj: Tracker) -> str:
        try:
            self.session.add(tracker_data_obj)
            await self.session.flush()
            await self.session.refresh(tracker_data_obj)
            return str(tracker_data_obj.tracker_id)
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError(f"Integrity error while creating tracker: {e.orig}")
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while creating tracker: {str(e)}")
        
    async def get_tracker_by_id(self, tracker_id: str) -> Optional[Tracker]:
        try:
            stmt = select(Tracker).options(
                joinedload(Tracker.raised_by_user).joinedload(User.employee),
                joinedload(Tracker.approver).joinedload(User.employee)
            ).where(Tracker.tracker_id == tracker_id)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching tracker: {str(e)}")
            
    async def get_tracker_by_request_id(self, request_id: str) -> Optional[Tracker]:
        try:
            stmt = select(Tracker).options(
                joinedload(Tracker.raised_by_user).joinedload(User.employee),
                joinedload(Tracker.approver).joinedload(User.employee)
            ).where(Tracker.id == request_id)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching tracker by request ID: {str(e)}")
        
    async def get_trackers_by_user_id(self, employee_id: str, status: str) -> Optional[List[Tracker]]:  # employee_id (str)
        try:
            if status is not None:
                stmt = select(Tracker).options(
                    joinedload(Tracker.raised_by_user).joinedload(User.employee),
                    joinedload(Tracker.approver).joinedload(User.employee)
                ).where(
                    and_(
                        Tracker.raised_by == employee_id,
                        Tracker.status == status
                    )
                )
            else:
                stmt = select(Tracker).options(
                    joinedload(Tracker.raised_by_user).joinedload(User.employee),
                    joinedload(Tracker.approver).joinedload(User.employee)
                ).where(Tracker.raised_by == employee_id)
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching trackers by employee ID: {str(e)}")
    
    # async def get_pending_trackers_by_user_and_id(self, employee_id: str, status_type: str) -> Optional[List[Tracker]]:  # employee_id (str)
    #     try:
    #         if status_type is not None:
    #             stmt = select(Tracker.tracker_id,Tracker.id).where(
    #                 and_(
    #                     Tracker.current_approver == employee_id,
    #                     Tracker.status == status_type
    #                 )
    #             )
    #         else:
    #             stmt = select(Tracker.tracker_id,Tracker.id).where(Tracker.current_approver == employee_id)
    #         result = await self.session.execute(stmt)
    #         return result.mappings().all() 
    #     except SQLAlchemyError as e:
    #         await self.session.rollback()
    #         raise RuntimeError(f"Database error while fetching trackers by employee ID: {str(e)}")



        
    async def get_pending_trackers_by_user_and_id(
        self,
        employee_id: str,
        status_type: list | None = None,
    ) -> List[RowMapping]:
        try:
            stmt = (
                select(
                    Tracker.tracker_id,
                    Tracker.id,
                )
                .where(Tracker.current_approver == employee_id)
            )

            if status_type:
                stmt = stmt.where(Tracker.status.in_(status_type))

            result = await self.session.execute(stmt)
            return result.mappings().all()

        except SQLAlchemyError as e:
            raise RuntimeError(
                f"Database error while fetching trackers by employee ID: {e}"
            ) 


            
    async def get_tracker_count(self):
        try:
            print("Getting tracker count...")
            stmt = select(func.count(Tracker.tracker_id))
            result = await self.session.execute(stmt)
            total_count = result.scalar_one()

            approve_stmt = select(func.count(Tracker.tracker_id)).where(
                Tracker.status == "Approved"
            )
            pending_stmt = select(func.count(Tracker.tracker_id)).where(
                Tracker.status == "Pending"
            )
            reject_stmt = select(func.count(Tracker.tracker_id)).where(
                Tracker.status == "Rejected"
            )

            approve_result = await self.session.execute(approve_stmt)
            pending_result = await self.session.execute(pending_stmt)
            reject_result = await self.session.execute(reject_stmt)

            return (
                total_count, 
                approve_result.scalar_one(), 
                pending_result.scalar_one(),
                reject_result.scalar_one()
            )
        except SQLAlchemyError as e:
            print(str(e))
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching tracker count: {str(e)}")

    async def get_tracker_count_by_emp_id(self,employee_id:str,designation:str):
        try:
            print("Getting tracker count by employee ID...")
            if designation in ["MANAGER","ITMANAGER"]:
                base_where = (Tracker.raised_by == employee_id)
            else:
                base_where = True

            stmt = select(func.count(Tracker.tracker_id)).where(base_where)
            result = await self.session.execute(stmt)
            total_count = result.scalar_one()

            approve_stmt = select(func.count(Tracker.tracker_id)).where(
                and_(base_where, Tracker.status == "APPROVED")
            )
            pending_stmt = select(func.count(Tracker.tracker_id)).where(
                and_(base_where, Tracker.status == "PENDING")
            )
            reject_stmt = select(func.count(Tracker.tracker_id)).where(
                and_(base_where, Tracker.status == "REJECTED")
            )

            approve_result = await self.session.execute(approve_stmt)
            pending_result = await self.session.execute(pending_stmt)
            reject_result = await self.session.execute(reject_stmt)

            return (
                total_count, 
                approve_result.scalar_one(), 
                pending_result.scalar_one(),
                reject_result.scalar_one()
            )
        except SQLAlchemyError as e:
            print(str(e))
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching tracker count by employee ID: {str(e)}")

    async def get_pending_tracker_id(self):
        try:
            stmt = select(Tracker.tracker_id).where(Tracker.status == "PENDING")
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching pending tracker IDs: {str(e)}")

    async def update_tracker(self,
        param:dict
         ):
        try:
            stmt = (
                update(Tracker)
                .where(Tracker.tracker_id == param.get("tracker_id"))
                .values(**param)
                .returning(Tracker)
                .execution_options(synchronize_session="fetch")
            )
            result = await self.session.execute(stmt)
            await self.session.flush()
            # tracker_data = result.scalar_one_or_none()
            return str(param.get("tracker_id"))
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while updating tracker: {str(e)}")
    
    async def delete_tracker_by_id(self, tracker_id: str) -> bool:
        try:
            stmt = delete(Tracker).where(Tracker.tracker_id == tracker_id)
            await self.session.execute(stmt)
            await self.session.flush()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while deleting tracker: {str(e)}")
        


class TrackerHistoryRepository():
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_tracker_history(self, tracker_history_data_obj: TrackerHistory) -> str:
        try:
            self.session.add(tracker_history_data_obj)
            await self.session.flush()
            await self.session.refresh(tracker_history_data_obj)
            return str(tracker_history_data_obj.history_id)
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError(f"Integrity error while creating tracker history: {e.orig}")
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while creating tracker history: {str(e)}")
        
    async def get_tracker_history_by_tracker_id(self, tracker_id: str) -> Optional[List[TrackerHistory]]:
        try:
            stmt = select(TrackerHistory).options(
                joinedload(TrackerHistory.user).joinedload(User.employee)
            ).where(TrackerHistory.tracker_id == tracker_id).order_by(TrackerHistory.created_at.desc())
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching tracker history: {str(e)}")
        
    async def get_tracker_history_by_user_id(self, employee_id: str, action: str = None) -> Optional[List[TrackerHistory]]:  # employee_id (str)
        try:
            if action is not None:
                stmt = select(TrackerHistory).options(
                    joinedload(TrackerHistory.user).joinedload(User.employee)
                ).where(
                    and_(
                        TrackerHistory.action_by == employee_id,
                        TrackerHistory.action == action
                    )
                ).order_by(TrackerHistory.created_at.desc())
            else:
                stmt = select(TrackerHistory).options(
                    joinedload(TrackerHistory.user).joinedload(User.employee)
                ).where(TrackerHistory.action_by == employee_id).order_by(TrackerHistory.created_at.desc())
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching tracker history by employee ID: {str(e)}")


    async def get_participant_user_ids(self, tracker_id: str, exclude_employee_id: str) -> set[str]:  # employee_id (str)
        result = await self.session.execute(
            select(TrackerHistory.action_by)
            .where(TrackerHistory.tracker_id == tracker_id)
            .where(TrackerHistory.action_by != exclude_employee_id)
        )
        # Use a set to remove duplicates (e.g., if someone took multiple actions)
        return set(result.scalars().all())

    async def get_remarks_action_by_id(self, employee_id: str, tracker_id: str):  # employee_id (str)
        try:
            stmt = (
                select(TrackerHistory.remarks,TrackerHistory.action)
                .where(
                    TrackerHistory.action_by == employee_id, 
                    TrackerHistory.tracker_id == tracker_id
                )
                .order_by(TrackerHistory.created_at.desc()) # Get latest first
                .limit(1)
            )
            result = await self.session.execute(stmt)
            
            # .scalar() returns a single string or None
            row = result.first()  # Returns Row or None

            if row is None:
                return None

            return {
                "remarks": row.remarks,
                "action": row.action,
            }
            
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error: {str(e)}")
    
    async def get_table_info(self, limit: int = 10, offset: int = 0):
        try:
            # 1. Get total count
            count_stmt = select(func.count()).select_from(TrackerHistory)
            count_result = await self.session.execute(count_stmt)
            total_count = count_result.scalar()

            # 2. Get paginated data
            stmt = (
                select(TrackerHistory)
                .order_by(TrackerHistory.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            result = await self.session.execute(stmt)
            items = result.mappings().all()
            items = [dict(row) for row in items]

            # 3. Return structured data same as _get_table_info
            return {
                "items": items,
                "total_count": total_count,
                "limit": limit,
                "offset": offset,
                "has_next": (offset + limit) < total_count
            }

        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching table info: {str(e)}")


    # async def get_all_tracker_info(self, limit: int = 10, offset: int = 0,user_id:uuid.UUID):
    #     try:
    #         # 1. Get total count of history records for pagination
    #         count_stmt = select(func.count()).select_from(TrackerHistory)
    #         count_result = await self.session.execute(count_stmt)
    #         total_count = count_result.scalar() or 0

    #         # 2. Build the main query (The Join)
    #         stmt = (
    #             select(
    #                 Tracker.tracker_id,
    #                 Tracker.status.label("overall_status"),
    #                 Tracker.current_level,
    #                 # Extracting JSONB fields
    #                 Tracker.information["product_name"].astext.label("product"),
    #                 Tracker.information["quantity"].astext.label("qty"),
    #                 Tracker.information["product_name"].astext.label("product_name"),
    #                 # History Details
    #                 TrackerHistory.history_id,
    #                 TrackerHistory.action,
    #                 TrackerHistory.remarks,
    #                 TrackerHistory.created_at.label("action_time"),
    #                 # User Details
    #                 User.first_name.label("acted_by_name"),
    #                 User.level.label("acted_by_level"),
    #                 # Role from Approval Order
    #                 ApprovalOrder.designation.label("acted_by_role")
    #             )
    #             .outerjoin(Tracker, Tracker.tracker_id == TrackerHistory.tracker_id)
    #             .outerjoin(User, TrackerHistory.action_by == User.user_id)
    #             .outerjoin(ApprovalOrder, User.level == ApprovalOrder.level)
                
    #             # 3. Global Order (Usually show latest activity first)
    #             .order_by(TrackerHistory.created_at.desc())
                
    #             # 4. Pagination
    #             .limit(limit)
    #             .offset(offset)
    #         )

    #         # 5. Execute
    #         result = await self.session.execute(stmt)
    #         items = [dict(row) for row in result.mappings().all()]

    #         # 6. Return structured data with pagination metadata
    #         return {
    #             "total_count": total_count,
    #             "limit": limit,
    #             "offset": offset,
    #             "has_next": (offset + limit) < total_count,
    #             "data": items
    #         }

    #     except SQLAlchemyError as e:
    #         await self.session.rollback()
    #         raise RuntimeError(f"Database error while fetching global tracker info: {str(e)}")

    async def get_all_tracker_info(self, limit: int = 10, offset: int = 0, employee_id: str = None):  # employee_id (str)
        try:
            # ── 1. Count query: use pure ORM joins for consistency ────────────
            count_stmt = (
                select(func.count())
                .select_from(TrackerHistory)
                .outerjoin(Tracker, Tracker.tracker_id == TrackerHistory.tracker_id)
                .outerjoin(User, TrackerHistory.action_by == User.employee_id)
                .outerjoin(ApprovalOrder, User.level == ApprovalOrder.level)
            )
            count_result = await self.session.execute(count_stmt)
            total_count = count_result.scalar() or 0
 
            # ── 2. Main query: pure ORM joins (avoids mixing .__table__ with ORM columns) ──
            stmt = (
                select(
                    Tracker.tracker_id,
                    Tracker.current_approver,
                    Tracker.status.label("overall_status"),
                    Tracker.current_level,
                    Tracker.information["product_name"].astext.label("product"),
                    Tracker.information["quantity"].astext.label("qty"),
                    Tracker.information["product_name"].astext.label("product_name"),
                    TrackerHistory.history_id,
                    TrackerHistory.action,
                    TrackerHistory.remarks,
                    TrackerHistory.created_at.label("action_time"),
                    Employee.first_name.label("acted_by_name"),
                    User.level.label("acted_by_level"),
                    ApprovalOrder.designation.label("acted_by_role")
                )
                .select_from(TrackerHistory)
                .outerjoin(Tracker, Tracker.tracker_id == TrackerHistory.tracker_id)
                .outerjoin(User, TrackerHistory.action_by == User.employee_id)
                .outerjoin(Employee, User.employee_id == Employee.employee_id)
                .outerjoin(ApprovalOrder, User.level == ApprovalOrder.level)
                .order_by(
                    # My pending actions first, then all others newest first
                    ((Tracker.current_approver == employee_id) & (Tracker.status == "Pending")).desc(),
                    (Tracker.current_approver == employee_id).desc(),
                    TrackerHistory.created_at.desc()
                )
                .limit(limit)
                .offset(offset)
            )

            # ── 3. Execute ────────────────────────────────────────────────────
            result = await self.session.execute(stmt)
            items = [dict(row) for row in result.mappings().all()]

            return {
                "total_count": total_count,
                "limit": limit,
                "offset": offset,
                "has_next": (offset + limit) < total_count,
                "data": items
            }

        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching global tracker info: {str(e)}")
    
    
    
    async def delete_tracker_history_by_tracker_id(self, tracker_id: str) -> bool:
        try:
            stmt = delete(TrackerHistory).where(TrackerHistory.tracker_id == tracker_id)
            await self.session.execute(stmt)
            await self.session.flush()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while deleting tracker history: {str(e)}")
