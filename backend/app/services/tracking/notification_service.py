import uuid
import csv
from decimal import Decimal
import json
import uuid
from datetime import date, datetime, timezone
from typing import Dict, List, Tuple, Any, Optional

from pathlib import Path
from app.exceptions.tracking.notification_exception import NotificationNotFound
from app.models.tracking.notification import Notification,NotificationType
from app.schemas.tracking.notification_schema import NotificationModel
from app.repositories.tracking.notification_repository import NotificationRepository

from app.services.tracking.tracker_service import TrackerService,TrackerHistoryService

from fastapi import HTTPException,status


class NotificationService():
    def __init__(self,
                notification_repository: NotificationRepository):
        self.notification_repository = notification_repository

    def get_notificaion_message(self,notification_type:str,id:str,raised_by_name:str,action:str):
        # from manager
            print(f"notification type {notification_type}")
            print(f"id {id}")
            print(f"raised by name {raised_by_name}")
            print(f"action {action}")
            if notification_type=="MANUFACTURING_PURCHASE_REQUEST":
                
                message = (
                    f"Request Type: MANUFACTURING_PURCHASE_REQUEST\n\n"
                    f"{raised_by_name} has {action} a manufacturing purchase request (ID: {id})."
                )
            # from manager
            elif notification_type=="OPERATIONAL_PURCHASE_REQUEST":
                message = (
                    f"Request Type: OPERATIONAL_PURCHASE_REQUEST\n\n"
                    f"{raised_by_name} has {action}  an operational purchase request (ID: {id})."
                )
            # from the it manager 
            elif notification_type=="EMERGENCY_PURCHASE_REQUEST":
                message = (
                    f"Request Type: EMERGENCY_PURCHASE_REQUEST\n\n"
                    f"{raised_by_name} has {action}  an emergency purchase request (ID: {id})."
                )
            elif notification_type=="MANUFACTURING_PURCHASE_ORDER":
                message = (
                    f"Request Type: MANUFACTURING_PURCHASE_ORDER\n\n"
                    f"{raised_by_name} has {action} a manufacturing purchase order (ID: {id})."
                )
            elif notification_type=="OPERATIONAL_PURCHASE_ORDER":
                message = (
                    f"Request Type: OPERATIONAL_PURCHASE_ORDER\n\n"
                    f"{raised_by_name} has {action}  an operational purchase order (ID: {id})."
                )
          
            elif notification_type=="GOODS_RECEIVED":
                message = (
                    f"Request Type: GOODS_RECEIVED\n\n"
                    f"{raised_by_name} has {action}  this request (ID: {id})."
                )
            elif notification_type=="ITEM_REQUEST":
                message = (
                    f"Request Type: ITEM_REQUEST\n\n"
                    f"{raised_by_name} has {action}  this request (ID: {id})."
                )
            elif notification_type=="ASSET_ASSIGNMENT":
                message = (
                    f"Request Type: ASSET_ASSIGNMENT\n\n"
                    f"{raised_by_name} has {action}  this request (ID: {id})."
                )
            elif notification_type=="PRODUCTION_ORDER":
                message = (
                    f"Request Type: PRODUCTION_ORDER\n\n"
                    f"{raised_by_name} has {action}  this request (ID: {id})."
                )
            elif notification_type=="SALES_ORDER":
                message = (
                    f"Request Type: SALES_ORDER\n\n"
                    f"{raised_by_name} has {action}  this request (ID: {id})."
                )
            else:
                print("else part here ................")
                message = f"Request Type: {notification_type}\n\n{raised_by_name} has {action}  this request (ID: {id})."
            return message

    async def create_notification(self, notification_data: NotificationModel,raised_by_name: str,action:str)-> str:  # employee_id (str)
        try:

            '''
            notification_data = NotificationModel(
                user_id=mir_schema.raised_by,
                approver_id=mir_schema.handler_id,
                reqeust_type="MANUFACTURING_NOTIFICATION",
            )
            
            '''
            # user_name = await user_service.get_user_name(notification_data.user_id)
            # print(f'type of user_name is {type(user_name)} and value is {user_name}')
            # message= f"Notification raised by {user_name} for tracker ID {notification_data.tracker_id}"
            '''
            MANUFACTURING_PURCHASE_REQUEST
            OPERATIONAL_PURCHASE_REQUEST
            EMERGENCY_PURCHASE_REQUEST
            '''
            

            # if notification_data.reqeust_type in ["MANUFACTURING_NOTIFICATION","OPERATIONAL_NOTIFICATION"]:
            #     # because these 2 has raised by the Manager or ITMANAGER 
            #     notification_data.tracker_id=None
            message = self.get_notificaion_message(
                notification_data.notification_type,
                notification_data.id,
                raised_by_name,
                action=action
            )
            print(f"message here is {message}")
            notification_data_obj = Notification(
                user_id=notification_data.user_id,
                approver_id=notification_data.approver_id,
                id=notification_data.id,
                notification_type=NotificationType(notification_data.notification_type),
                is_viewed=False,
                message=message
            )
            
            notification_id = await self.notification_repository.create_notification(notification_data_obj)
            if not notification_id:
                return NotificationNotFound(f"Failed to create notification for request type {notification_data.notification_type}")
            return notification_id,message
        except NotificationNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    
        
    async def raise_pg_notify(self,
        notification_id:str,
        # employee_id:str,  # employee_id (str)
        current_approver:str,  # employee_id (str)
        id:str,
        # user_db_service:UserService,
        remarks:str=None,
        message:str | None = None
    ):
        try:
            print("hereeeee")
            # here the user name is of the current user and employee_id is for the sse maanger to send to the next user notification
            # user_name = await user_db_service.get_user_name(employee_id)
            # print(f'type of user_name is {type(user_name)} and value is {user_name}')
            payload = {
                "event_type":"notification",
                "approver_id":str(current_approver),
                "notification_id": notification_id,
                # "user_name": user_name,
                "id": id,
                # "message": f"{user_name} has raised this request for tracker ID {tracker_id}",
                "message": message,
                "remarks": remarks
            }
            print(f"Notification payload here {payload}")
            flag = await self.notification_repository.raise_pg_notify(payload)
            print(f"Notification has been raised here {flag}")
            if not flag:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to raise notification")
            return True
        except NotificationNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

        
    async def broadcast_pg_notify_for_approval(self,
            employee_id:str,  # employee_id (str)
            tracker_id: str,
            tracker_history_service: TrackerHistoryService,
            user_id: str,
            id: str,
            notification_type:str,
            action:str,
            remarks: str = None,
            current_user_name: str = None
    ):
        try:
            # 1. Get the current user's name (the Finance Head / Approver)
            # current_user_name = await user_db_service.get_user_name(employee_id)
            
            # 2. Get the participants, excluding the current user
            child_user_ids = await tracker_history_service.get_particiipant_user_ids(
                tracker_id=tracker_id, exclude_employee_id=employee_id
            )
            
            # 3. Create notification and raise pg_notify for each participant
            for target_user_id in child_user_ids:
                
                
                # message= f"{current_user_name} granted final approval for {notification_data.notification_type} id ({id})"
                message = self.get_notificaion_message(
                    notification_type,
                    id,
                    current_user_name,
                    action=action
                )
                print(f"message here is {message}")
                notification_data_obj = Notification(
                    user_id=user_id,
                    approver_id=target_user_id,
                    id=id,
                    notification_type=notification_type,
                    is_viewed=False,
                    message=message
                )

           
                
                # Insert the notification into the database
                new_notif_id = await self.notification_repository.create_notification(notification_data_obj)
                


                # Prepare the SSE payload
                payload = {
                    "event_type":"notification",
                    "approver_id":str(target_user_id),
                    "notification_id": new_notif_id,
                    # "user_name": user_name,
                    "id": id,
                    # "message": f"{user_name} has raised this request for tracker ID {tracker_id}",
                    "message": message,
                    "remarks": remarks
                }
                print(f"Notification payload here {payload}")
                
                # Let pg_notify send it to the SSE background worker
                flag = await self.notification_repository.raise_pg_notify(payload)
                if not flag:
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to raise notification")
            
            return True
            
        except NotificationNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))



    async def broadcast_pg_notify_for_rejection(self,
        employee_id: str,  # employee_id (str)
        tracker_id: str,
        id: str,
        tracker_history_service: TrackerHistoryService,
        remarks: str = None,
        notification_type: str = None,
        current_user_name: str = None
    ):
        try:
            # 1. Get the current user's name (the Finance Head / Approver)
            # print("employee id is ", employee_id)
            # current_user_name = await user_db_service.get_user_name(employee_id)
            
            # 2. Get the participants, excluding the current user
            child_user_ids = await tracker_history_service.get_particiipant_user_ids(
                tracker_id=tracker_id, exclude_employee_id=employee_id
            )
            
            # 3. Create notification and raise pg_notify for each participant
            for target_user_id in child_user_ids:
                message = self.get_notificaion_message(
                    notification_type,
                    id,
                    current_user_name,
                    action="REJECTED"
                )
                # Ensure you use the SQLAlchemy model, not the Pydantic model
                notification_data = Notification(
                    user_id=employee_id,
                    approver_id=target_user_id,
                    id=id,
                    is_viewed=False,
                    message=message
                )
                
                # Insert the notification into the database
                new_notif_id = await self.notification_repository.create_notification(notification_data)
 
                # Prepare the SSE payload
                payload = {
                    "event_type":"notification",
                    "approver_id": str(target_user_id), # crucial: converts UUID to string so JSONizer works
                    "notification_id": str(new_notif_id),
                    # "user_name": current_user_name,
                    "id": id,
                    "message": message,
                    "remarks": remarks
                }
                
                # Let pg_notify send it to the SSE background worker
                flag = await self.notification_repository.raise_pg_notify(payload)
                if not flag:
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to raise notification")
            
            return True
            
        except NotificationNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))



    async def get_notification_by_id(self, notification_id: str) -> Optional[Notification]:
        try:
            notification_obj = await self.notification_repository.get_notification_by_id(notification_id)
            if not notification_obj:
                raise NotificationNotFound(f"Notification with ID {notification_id} not found")
            return notification_obj
        except NotificationNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_notifications_by_user_id(self, employee_id: str, is_viewed: bool = None) -> list[Notification]:  # employee_id (str)
        try:
            notification_obj = await self.notification_repository.get_notifications_by_user_id(employee_id, is_viewed)
            print(notification_obj,"notification_obj")
            # if not notification_obj:
            #     raise NotificationNotFound(f"No notifications found for user ID {user_id}")
            return notification_obj
        except NotificationNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
 
    async def get_notification_by_approver_and_request_id(self, employee_id: str, request_id: str) -> Optional[Notification]:
        try:
            notification_obj = await self.notification_repository.get_notification_by_approver_and_request_id(employee_id, request_id)
            return notification_obj
        except NotificationNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_service_for_notification(self,
            id:str,
            notification_type:str,
            purchase_request: Any,
            tracker_service: TrackerService,
            tracker_history_service:TrackerHistoryService
            ):
        print(notification_type)
        print(id)
        if notification_type in ["MANUFACTURING_PURCHASE_REQUEST","OPERATIONAL_PURCHASE_REQUEST","EMERGENCY_PURCHASE_REQUEST","MANUFACTURING_PURCHASE_ORDER","OPERATIONAL_PURCHASE_ORDER"]:
            tracker_id = await purchase_request.get_tracker_id(pr_id=id)
            print("tracker_id",tracker_id)
            tracker_info = await tracker_service.get_tracker_by_id(tracker_id)
            # remarks=None
            # if tracker_info.raised_by:
                # remarks,action = await tracker_history_service.get_remarks_action_by_id(str(tracker_info.raised_by), str(tracker_id))

            print("tracker_info",tracker_info)
            # print("remarks",remarks)
            tracker_history = await tracker_history_service.get_tracker_history_by_tracker_id(tracker_id)
            print("tracker_history",tracker_history)
            # request_details = await purchase_request.get_purchase_request_by_id(pr_id=id)
            # print("request_details",request_details)
            return [tracker_info,tracker_history]
        else:
            return None

    async def get_active_notifications_info(self,
                    employee_id: str,
                    is_viewed: bool,
                    tracker_service: TrackerService,
                    tracker_history_service:TrackerHistoryService,
                    purchase_request_service: Any = None
                    
                    ):  # employee_id (str)
        print("SSSSSS")
        notifications = await self.get_notifications_by_user_id(employee_id=employee_id, is_viewed=is_viewed)
        print(notifications,"notificatinonnnnn")
        response_data = []
        # get_remarks = []
        for notif in notifications:
            print(notif,"NOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO")
            service_result = await self.get_service_for_notification(str(notif.id),
            str(NotificationType(notif.notification_type).value),
            purchase_request_service,
            tracker_service,
            tracker_history_service
            )
            print(service_result,"RRRRRRRRRRRRR")
            if service_result:
                tracker_info, tracker_history = service_result
            else:
                tracker_info, tracker_history = None, None

            response_data.append({
                "notification_id": str(notif.notification_id),
                "is_viewed": notif.is_viewed,
                "notification_type":str(NotificationType(notif.notification_type).value),
                "message": str(notif.message),
                "id": str(notif.id),
                "tracker_id": tracker_info.tracker_id if tracker_info else "",
                "raised_by_name": tracker_info.raised_by_name if tracker_info else "",
                "created_at": tracker_info.created_at.isoformat() if tracker_info and tracker_info.created_at else "",
                "tracker_history": [h.model_dump(mode="json") for h in tracker_history] if tracker_history else []
                
                
                


            })
        return response_data







    async def update_notification_view(self,status:bool,notfication_id:str):
        try:
            await self.notification_repository.update_notification_view(status,notfication_id)
            return {"message": f"Notification with ID {notfication_id} updated successfully"}
        except NotificationNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
            
    async def mark_notification_as_read_for_request(self, employee_id: str, request_id: str):
        try:
            notification_obj = await self.notification_repository.get_notification_by_approver_and_request_id(employee_id, request_id)
            if notification_obj and not notification_obj.is_viewed:
                await self.notification_repository.update_notification_view(True, str(notification_obj.notification_id))
        except Exception as e:
            print(f"Failed to auto-mark notification as read for request {request_id}: {e}")
    
    async def update_all_notification_view(self, employee_id: str):  # employee_id (str)
        try:
            await self.notification_repository.update_all_notification_view(employee_id)
            return {"message": f"All notifications for employee ID {employee_id} updated successfully"}
        except NotificationNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
        
    async def delete_notification_by_id(self, notification_id: str):
        try:
            await self.notification_repository.delete_notification_by_id(notification_id)
            return {"message": f"Notification with ID {notification_id} deleted successfully"}
        except NotificationNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))