

from typing import Optional

from fastapi import (Depends, FastAPI, HTTPException, WebSocketDisconnect, status, APIRouter, Query,
                     Body, Form, File, UploadFile, Request, WebSocket)
# from app.config  import settings as global_settings



from app.dependency.auth_dependency import verify_access_token_dep
from app.dependency.application_tables.user_data_source_db_dependency import get_user_db_source_service
from app.dependency.dynamic_crud_dependency import get_dynamic_crud_service
from app.dependency.login_history_dependency import get_login_history_service
from app.dependency.admin_setting_dependency import get_admin_settings_service
from app.dependency.tracking.tracker_dependency import get_tracker_history_service

# from app.services.application_tables.user_db_source_service import UserDBSourceService  # application_tables ignored
from app.services.dynamic_crud_service import DynamicCrudService
from app.services.login_history_service import LoginHistoryService
from app.services.admin_setting_service import AdminSettingsService
from app.services.tracking.tracker_service import TrackerHistoryService



admin_router = APIRouter()


######################################## ADMIN SETTINGS #########################################

@admin_router.get("/api/v1/admin/settings/count_data")
async def get_count_data(
    get_user_db:UserDBSourceService = Depends(get_user_db_source_service),
    login_history_service: LoginHistoryService = Depends(get_login_history_service),
    admin_settings_service: AdminSettingsService = Depends(get_admin_settings_service)
):
    try:
        print(f'get all the admin settings count data ')
        return await admin_settings_service.get_admin_settings_count_data(get_user_db,login_history_service)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


######################################## Table Information #########################################


@admin_router.get("/api/v1/table/info")
async def get_table_info(
    table_name:str,
    limit:int = 10,
    offset:int = 0,
    product_name:Optional[str] = None,
    crud_service: DynamicCrudService = Depends(get_dynamic_crud_service)
):
    try:
        print(f'get table info {table_name}')
        return await crud_service.get_table_info(table_name,limit,offset,product_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@admin_router.get("/api/v1/table/tracker/info")
async def get_tracker_table_info(
    request:Request,
    limit:int = 10,
    offset:int = 0,
    tracker_history_service: TrackerHistoryService = Depends(get_tracker_history_service)
    
):
    try:
        print(f'get table info tracker')
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        return await tracker_history_service.get_table_info(limit,offset,employee_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



