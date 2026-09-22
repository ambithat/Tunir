import csv
from decimal import Decimal
import json
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from pathlib import Path
from app.exceptions.tracking.tracker_exception import TrackerNotFound, TrackerHistoryNotFound

from app.schemas.tracking.tracker_schema import TrackerCreateSchema,TrackerDTO,TrackerHistoryModel,RequestRaiseModel,TrackerHistoryDTO,TrackerFullResponse
from app.repositories.tracking.tracker_repository import TrackerRepository,TrackerHistoryRepository
from app.models.tracking.tracker import Tracker,TrackerHistory
from fastapi import HTTPException,status


class TrackerService():
    def __init__(self,
                tracker_repository: TrackerRepository):
        self.tracker_repository = tracker_repository

    async def create_tracker(self,
    #  raised_by:str,
     tracker_data:TrackerCreateSchema
    #  user_service_obj: UserService) -> tuple[str, str]:
    ) -> str:
        try:
            tracker_obj = Tracker(**tracker_data.model_dump(exclude_unset=True))
            tracker_id = await self.tracker_repository.create_tracker(tracker_obj)
            return str(tracker_id)
        except TrackerNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    
    async def get_tracker_by_id(self, tracker_id: str) -> TrackerDTO:
        try:
            tracker_obj = await self.tracker_repository.get_tracker_by_id(tracker_id)
            if not tracker_obj:
                raise TrackerNotFound(f"Tracker with ID {tracker_id} not found")
            return TrackerDTO.model_validate(tracker_obj)
        except TrackerNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_tracker_by_request_id(self, request_id: str) -> TrackerDTO:
        try:
            tracker_obj = await self.tracker_repository.get_tracker_by_request_id(request_id)
            if not tracker_obj:
                raise TrackerNotFound(f"Tracker with Request ID {request_id} not found")
            return TrackerDTO.model_validate(tracker_obj)
        except TrackerNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_tracker_full_data(self, tracker_id: str, 
                                     tracker_history_service: 'TrackerHistoryService') -> TrackerFullResponse:
        """Get tracker info + history with resolved user names."""
        try:
            # 1. Get the main tracker data
            tracker_obj = await self.tracker_repository.get_tracker_by_id(tracker_id)
            if not tracker_obj:
                raise TrackerNotFound(f"Tracker with ID {tracker_id} not found")
            tracker_dto = TrackerDTO.model_validate(tracker_obj)

            # 2. Get the history records for this tracker
            try:
                history_records = await tracker_history_service.tracker_history_repository.get_tracker_history_by_tracker_id(tracker_id)
            except Exception:
                history_records = []

            # 3. Resolve user names from action_by
            enriched_history = []
            for h in (history_records or []):
                action_by_name = str(h.action_by)

                enriched_history.append(TrackerHistoryDTO(
                    action_by=h.action_by,
                    action_by_name=action_by_name,
                    action=h.action,
                    remarks=h.remarks,
                    created_at=h.created_at
                ))

            # 4. Build the full response
            return TrackerFullResponse(
                **tracker_dto.model_dump(),
                history=enriched_history
            )
        except TrackerNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    
    async def get_trackers_by_user_id(self, employee_id:str,status:str=None) -> list[TrackerDTO]: 
        try:
            tracker_objs = await self.tracker_repository.get_trackers_by_user_id(employee_id,status)
            if not tracker_objs:     
                raise TrackerNotFound(f"No trackers found for employee ID {employee_id} with status {status}")
            return [TrackerDTO.model_validate(t) for t in tracker_objs]
        except TrackerNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_service_tracker_count(self) -> dict:
        try:
            
            total_count, approved_count, pending_count, rejected_count = await self.tracker_repository.get_tracker_count()
            return {
                "total_count": total_count,
                "approved_count": approved_count,
                "pending_count": pending_count,
                "rejected_count": rejected_count
            }
        except TrackerNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_service_tracker_count_by_emp_id(self, employee_id:str,designation:str) -> dict:
        try:
            
            total_count, approved_count, pending_count, rejected_count = await self.tracker_repository.get_tracker_count_by_emp_id(employee_id,designation)
            return {
                "total_count": total_count,
                "approved_count": approved_count,
                "pending_count": pending_count,
                "rejected_count": rejected_count
            }
        except TrackerNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def get_pending_tracker_id(self) -> List[str]:
        try:
            tracker_ids = await self.tracker_repository.get_pending_tracker_id()
            if not tracker_ids:     
                raise TrackerNotFound(f"No pending trackers found")
            return tracker_ids
        except TrackerNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    
    async def get_pending_trackers_by_user_and_id(self, employee_id: str, status_type: list) -> Optional[List[Tracker]]:  # employee_id (str)
        try:
            tracker_objs = await self.tracker_repository.get_pending_trackers_by_user_and_id(employee_id,status_type)
            if not tracker_objs:     
                raise TrackerNotFound(f"No pending trackers found for employee ID {employee_id} with status {status_type}")
            tracker_data = []
            for t in tracker_objs:
                data = {
                    "tracker_id":t.tracker_id,
                    "id":t.id
                }
                tracker_data.append(data)
            return tracker_data
        except TrackerNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    

    def get_tracker_status(self, current_role: str, parent_id: str):
        try:
            if not parent_id:
                print(1)
                return "APPROVED"
            elif current_role == "PRODUCTHEAD":
                print(2)
                return "APPROVED_AT_PRODUCT_HEAD"
            elif current_role == "DELIVERYHEAD":
                print(3)
                return "APPROVED_AT_DELIVERY_HEAD"

            elif current_role == "CFO":
                print(4)
                return "APPROVED_AT_CFO"
            # elif current_role == "CEO":
            #     print(5)
            #     return "APPROVED", None, None
            else:
                print(6)
                return "PENDING"
                
        except Exception as e:
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))




    async def get_all_stats(self):
        """
        Fetches combined stats: 
        Global Procurement Stats + (Optional) User's Tracker Counts
        """
        try:

            stats = {}
            tracker_counts = await self.get_service_tracker_count()
            print(f"Fetched tracker counts: {tracker_counts}")
            stats["tracker_counts"] = tracker_counts
            print(f"Fetched dashboard stats: {stats}")
            return stats
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail=f"Failed to fetch dashboard stats: {str(e)}"
            )            



    async def broadcast_tracker_update(self,notification_service):
        """
        Sends a lightweight 'trigger' to Postgres.
        The SSE Listener (in sse_manager.py) will hear this,
        calculate fresh stats, and broadcast them to all users.
        This avoids the 8KB pg_notify payload limit and race conditions.
        """
        try:
            trigger_payload = {
                "event_type": "tracker_update_trigger"
            }
            
            flag = await notification_service.raise_pg_notify(trigger_payload)

                
            if not flag:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to raise dashboard trigger")
            
            print("[SSE] Dashboard update trigger broadcasted.")
            return True
        except Exception as e:
            print(f"[SSE] Failed to broadcast trigger: {e}")
            return False


    # async def update_tracker(self,tracker_id:str,employee_id:str,user_service_obj: UserService,status:str=None):
    #     try:
    #         # notification_all_flag = False
    #         current_approver = await user_service_obj.get_next_approver(employee_id)
    #         if current_approver is  None:
    #             param = {"status":"Approved"}
    #             notification_all_flag = True
    #         else:
    #             current_level = await user_service_obj.get_next_level(current_approver)
    #             param = {
    #                 "current_approver": current_approver,
    #                 "current_level": current_level,
    #                 "status": "Pending"
    #             }
    #         await self.tracker_repository.update_tracker(
    #             tracker_id,
    #             param
    #         )
    #         return notification_all_flag,current_approver

    #     except TrackerNotFound as e:    
    #         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    #     except Exception as e:
    #         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def update_tracker(self,param:dict):
        try:
       
            tracker_id = await self.tracker_repository.update_tracker(
                param
            )
            if not tracker_id:
                raise TrackerNotFound(f"Tracker with ID {tracker_id} not found")

            return tracker_id

        except TrackerNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
        



    async def update_reject_tracker(self,tracker_id:str,employee_id:str):
        try:
            param = {"status":"Rejected"}
            await self.tracker_repository.update_tracker(
                tracker_id,
                param
            )
            return True
        except TrackerNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


    async def delete_tracker_by_id(self,tracker_id:str):
        try:
            tracker_data_obj = await self.tracker_repository.delete_tracker_by_id(tracker_id)
            if not tracker_data_obj:
                return {"message":f"Tracker with ID {tracker_id} not found"}
            return {"message":f"Tracker with ID {tracker_id} deleted successfully"}
        except TrackerNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
        

class TrackerHistoryService():
    def __init__(self,
                tracker_history_repository: TrackerHistoryRepository):
        self.tracker_history_repository = tracker_history_repository
    
    async def create_track_history(self,tracker_history_data:TrackerHistoryModel):
        try:
            tracker_history_data_obj = TrackerHistory(
                tracker_id=tracker_history_data.tracker_id,
                action_by=tracker_history_data.action_by,
                action=tracker_history_data.action,
                remarks=tracker_history_data.remarks
            )
            print(3.222)
            history_id = await self.tracker_history_repository.create_tracker_history(tracker_history_data_obj)
            if history_id:
                return True
            else:
                return False
        except TrackerHistoryNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))   
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
        

    async def get_tracker_history_by_tracker_id(self,tracker_id:str):
        try:
            tracker_history_obj = await self.tracker_history_repository.get_tracker_history_by_tracker_id(tracker_id)
            if not tracker_history_obj:
                return None
                # raise TrackerHistoryNotFound(f"No history found for tracker ID {tracker_id}")
            return [TrackerHistoryDTO.model_validate(h) for h in tracker_history_obj]
        except TrackerHistoryNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))   
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    
    async def get_tracker_history_by_user_id(self,employee_id:str,status:str = None):
        try:
            tracker_history_obj = await self.tracker_history_repository.get_tracker_history_by_user_id(employee_id,status)
            if not tracker_history_obj:
                raise TrackerHistoryNotFound(f"No history found for employee ID {employee_id}")
            return [TrackerHistoryDTO.model_validate(h) for h in tracker_history_obj]
        except TrackerHistoryNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))   
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
 
    async def get_particiipant_user_ids(self, tracker_id:str,exclude_employee_id:str):
        try:
            child_user_ids = await self.tracker_history_repository.get_participant_user_ids(tracker_id,exclude_employee_id)
            return child_user_ids
        except TrackerHistoryNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))   
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
 
    async def get_remarks_action_by_id(self,employee_id:str,tracker_id:str):
        try:
            result = await self.tracker_history_repository.get_remarks_action_by_id(employee_id,tracker_id)
            if not result:
                return None,None
            return result.get("remarks"),result.get("action")
        except TrackerHistoryNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))   
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
 
    async def get_table_info(self, limit:int=10, offset:int=0,employee_id:str = None):
        try:
            # table_info = await self.tracker_history_repository.get_table_info(limit, offset)
            table_info = await self.tracker_history_repository.get_all_tracker_info(limit,offset,employee_id)
            return table_info
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    async def delete_tracker_history_by_tracker_id(self,tracker_id:str):
        try:
            delete_success = await self.tracker_history_repository.delete_tracker_history_by_tracker_id(tracker_id)
            if delete_success:
                return {"message":f"Tracker history for tracker ID {tracker_id} deleted successfully"}
            else:
                return {"message":f"No tracker history found for tracker ID {tracker_id}"}
        except TrackerHistoryNotFound as e:    
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))   
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))