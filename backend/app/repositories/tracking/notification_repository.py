from cv2.gapi import parseSSD
import json
from typing import  Optional,List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete,text, cast, and_, or_
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.models.tracking.notification import Notification
from app.repositories.base_repository import AbstractRepository


class NotificationRepository():
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_notification(self, notification_data_obj: Notification) -> str:
        try:
            self.session.add(notification_data_obj)
            await self.session.flush()
            await self.session.refresh(notification_data_obj)
            return str(notification_data_obj.notification_id)
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError(f"Integrity error while creating notification: {e.orig}")
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while creating notification: {str(e)}")
    
    async def raise_pg_notify(self,payload:dict) -> bool:
        try:
            await self.session.execute(
                text("SELECT pg_notify('new_notification', :payload)"),
                {"payload": json.dumps(payload)},
            )
            await self.session.commit()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while raising pg_notify: {str(e)}")
        
    async def get_notification_by_id(self, notification_id: str) -> Optional[Notification]:
        try:
            stmt = select(Notification).where(Notification.notification_id == notification_id)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching notification: {str(e)}")

    async def get_notifications_by_user_id(self, employee_id: str, is_viewed: bool) -> Optional[List[Notification]]:  # employee_id (str)
        try:
            if is_viewed is not None:
                print(is_viewed,"is_viewed")
                print(employee_id)
                print(111111111111111111111)
                stmt = select(Notification).where(
                    and_(
                        Notification.approver_id == employee_id,
                        Notification.is_viewed == is_viewed
                    )
                )
            else:
                print(22222222222222222222222)
                stmt = select(Notification).where(Notification.approver_id == employee_id)
            result = await self.session.execute(stmt)
            # print(result.scalars().all(),"resulttttttttttt")
            return result.scalars().all()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching notifications by employee ID: {str(e)}")
    async def get_notification_by_approver_and_request_id(self, employee_id: str, request_id: str) -> Optional[Notification]:
        try:
            stmt = select(Notification).where(
                and_(
                    Notification.approver_id == employee_id,
                    Notification.id == request_id
                )
            ).order_by(Notification.created_at.desc()).limit(1)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while fetching notification by employee ID and request ID: {str(e)}")


    async def update_notification_view(self,status:bool,notfication_id:str):
        try:
            stmt = (
                update(Notification)
                .where(Notification.notification_id == notfication_id)
                .values(is_viewed=status)
                .returning(Notification)
                .execution_options(synchronize_session="fetch")
            )
            result = await self.session.execute(stmt)
            await self.session.flush()
            notification_data = result.scalar_one_or_none()
            return notification_data
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while updating notification: {str(e)}")
    
    async def update_all_notification_view(self, employee_id: str):  # employee_id (str)
        try:
            stmt = (update(Notification).where(Notification.approver_id == employee_id).values(is_viewed=True).execution_options(synchronize_session="fetch"))
            result = await self.session.execute(stmt)
            await self.session.flush()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while updating notification: {str(e)}")

    async def delete_notification_by_id(self, notification_id: str) -> bool:
        try:
            stmt = delete(Notification).where(Notification.notification_id == notification_id)
            await self.session.execute(stmt)
            await self.session.flush()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error while deleting notification: {str(e)}")
        
    