
import json

from typing import List

from fastapi import (Depends, FastAPI, HTTPException, WebSocketDisconnect, status, APIRouter, Query,
                     Body, Form, File, UploadFile, Request, WebSocket)
# from app.config  import settings as global_settings


from app.schemas.dynamic_crud_schema import UpdateActionRequest, DeleteRequest, InsertRequest, CreateTableRequest

from app.dependency.auth_dependency import verify_access_token_dep
# from app.dependency.application_tables.query_agent_dependency import get_graph_query_agent_service  # application_tables ignored
# from app.dependency.application_tables.user_data_source_db_dependency import get_user_db_source_service  # application_tables ignored
from app.dependency.dynamic_crud_dependency import get_dynamic_crud_service
from app.dependency.tracking.tracker_dependency import get_tracker_service
from app.dependency.dashboard_dependency import get_dashboard_service

# from app.services.application_tables.llama_model_version_3 import SQLQueryGraphAgent  # application_tables ignored
# from app.services.application_tables.user_db_source_service import UserDBSourceService  # application_tables ignored
from app.services.dynamic_crud_service import DynamicCrudService
from app.services.tracking.tracker_service import TrackerService
from app.services.dashboard_service import DashboardService



dynamic_crud_router = APIRouter()


################################ DYNAMIC CRUD API ###########################################

@dynamic_crud_router.get("/api/v1/db/tables")
async def list_tables(
    crud_service: DynamicCrudService = Depends(get_dynamic_crud_service)
):
    '''Returns a list of every table'''
    try:
        return await crud_service.get_all_tables()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@dynamic_crud_router.get("/api/v1/db/tables/{table_name}/columns")
async def list_columns(
    table_name: str, 
    action: str | None = None,
    crud_service: DynamicCrudService = Depends(get_dynamic_crud_service)
):
    '''Extracts the specific column names, datatypes, and limits of a selected table.'''
    try:
        return await crud_service.get_table_columns(table_name,action)
    except ValueError as v_err:
        raise HTTPException(status_code=400, detail=str(v_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@dynamic_crud_router.post("/api/v1/db/tables")
async def create_table(
    request: Request,
    payload: CreateTableRequest,
    crud_service: DynamicCrudService = Depends(get_dynamic_crud_service),
    # get_user_db: UserDBSourceService = Depends(get_user_db_source_service),  # application_tables ignored
    # query_agent_service: "SQLQueryGraphAgent" = Depends(get_graph_query_agent_service)  # application_tables ignored
):
    '''Executes a perfectly formatted CREATE TABLE query, then refreshes the
    schema/chunk/vector resources for the currently active user DB source so
    the AI is immediately aware of the newly created table.'''
    try:
        result = await crud_service.create_table(payload)

        # ── application_tables ignored: schema refresh block disabled ──────────
        # employee_id: str = request.state.employee_id
        # try:
        #     display_name, _ = await get_user_db.get_active_user_db_source_by_id(user_id=employee_id)
        #     if display_name:
        #         user_db_source_obj = await get_user_db.get_user_db_info_by_display_name(
        #             user_id=employee_id, display_name=display_name
        #         )
        #         if user_db_source_obj:
        #             res = await get_user_db.create_schema_chunk_vectore_resource(
        #                 employee_id=employee_id,
        #                 display_name=display_name,
        #                 user_db_source_obj=user_db_source_obj
        #             )
        #             if res:
        #                 db_config = await query_agent_service.check_db_active(user_id=employee_id, user_db_source=get_user_db)
        #                 if db_config:
        #                     await query_agent_service.rebuild_database_resources(employee_id, db_config)
        #             print(f"Schema/chunk/vector refreshed for '{display_name}' after table creation.")
        # except Exception as refresh_err:
        #     print(f" Could not refresh schema resources after table creation: {refresh_err}")
        # ───────────────────────────────────────────────────────────────────────

        return result
    except ValueError as v_err:
        raise HTTPException(status_code=400, detail=str(v_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@dynamic_crud_router.post("/api/v1/db/insert")
async def insert_record(
    payload: InsertRequest, 
    crud_service: DynamicCrudService = Depends(get_dynamic_crud_service),
    dashboard_service:DashboardService = Depends(get_dashboard_service),
    tracker_service:TrackerService = Depends(get_tracker_service)
):
    '''Safely inserts new information directly into a table.'''
    try:
        return await crud_service.insert_record(payload,dashboard_service,tracker_service)
    except ValueError as v_err:
        raise HTTPException(status_code=400, detail=str(v_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    
        


@dynamic_crud_router.put("/api/v1/db/update")
async def update_record(
    payload: UpdateActionRequest, 
    crud_service: DynamicCrudService = Depends(get_dynamic_crud_service),
    dashboard_service:DashboardService = Depends(get_dashboard_service),
    tracker_service:TrackerService = Depends(get_tracker_service)
):
    '''API route that handles four separate PyQT actions using the action flag in the payload'''
    try:
        return await crud_service.update_record(payload, dashboard_service,tracker_service)
    except ValueError as v_err:
        raise HTTPException(status_code=400, detail=str(v_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@dynamic_crud_router.delete("/api/v1/db/delete")
async def delete_record(
    payload: DeleteRequest = Body(...), 
    crud_service: DynamicCrudService = Depends(get_dynamic_crud_service),
    dashboard_service:DashboardService = Depends(get_dashboard_service),
    tracker_service:TrackerService = Depends(get_tracker_service)
):
    '''Removes data from the database safely'''
    try:
        return await crud_service.delete_record(payload, dashboard_service,tracker_service)
    except ValueError as v_err:
        raise HTTPException(status_code=400, detail=str(v_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))        


