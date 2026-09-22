


from fastapi import (Depends, FastAPI, HTTPException, WebSocketDisconnect, status, APIRouter, Query,
                     Body, Form, File, UploadFile, Request, WebSocket)
from fastapi.responses import JSONResponse
# from app.config  import settings as global_settings


from app.schemas.application_tables.user_db_schema import UserDBSchema, UserDBUpdateSchema

from app.dependency.auth_dependency import verify_access_token_dep
from app.dependency.application_tables.query_agent_dependency import get_graph_query_agent_service
from app.dependency.application_tables.user_data_source_db_dependency import get_user_db_source_service

# from app.services.application_tables.llama_model_version_3 import SQLQueryGraphAgent  # application_tables ignored
# from app.services.application_tables.user_db_source_service import UserDBSourceService  # application_tables ignored



user_db_router = APIRouter()


############################ user db source ---------------------------------------------------------------------------
'''
{
  "display_name": "My Offline SQLite DB",
  "driver": "sqlite",
  "host": "localhost",
  "port": 0,
  "username": "",
  "password": "",
  "db_name": "/home/user/my_data.db"
}

'''

@user_db_router.post("/api/v1/add/user_db/source")
async def add_llam_db(
    request: Request,
    user_db_schema: UserDBSchema = Body(...),
    get_user_db_service: UserDBSourceService = Depends(get_user_db_source_service),
    # query_agent_service: "SQLQueryGraphAgent" = Depends(get_graph_query_agent_service)  # application_tables ignored
):

    try:
        print("RECEIVED PAYLOAD FROM FRONTEND:", user_db_schema)
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        print(user_db_schema.host, "*******************************************")

        user_db_source_obj = await get_user_db_service.create_db_source(
            user_id=employee_id,
            display_name=user_db_schema.display_name,
            database_type=user_db_schema.database_type,
            driver=user_db_schema.driver,
            db_scheme=user_db_schema.db_scheme,
            host=user_db_schema.host,
            port=int(user_db_schema.port),
            username=user_db_schema.username,
            password=user_db_schema.password,
            db_name=user_db_schema.db_name,
            is_active=user_db_schema.is_active
        )

        if not user_db_source_obj:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Not able to add the database .. please try again ",
            )

        # result = await get_user_db_service.create_schema_chunk_vectore_resource(
        #     employee_id=employee_id,
        #     display_name=user_db_schema.display_name,
        #     user_db_source_obj=user_db_source_obj,
        # )

        # # Trigger proactive resource build
        # if result:
        #     db_config = await query_agent_service.check_db_active(user_id=employee_id, user_db_source=get_user_db_service)
        #     if db_config:
        #         await query_agent_service.rebuild_database_resources(employee_id, db_config)
        return JSONResponse(content={"message": "Database is added ...."})

    except HTTPException as e:
        raise HTTPException(status_code=e.status_code, detail=str(e.detail))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

@user_db_router.post("/api/v1/switch/user_db/source")
async def switch_user_db_source(request:Request,
                             display_name:str,
                             get_user_db:UserDBSourceService = Depends(get_user_db_source_service)
):
    try:
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        param = {"is_active": True}
        print(f"employee_id is {employee_id} and param is {param}")
        result = await get_user_db.update_user_db_source_by_id(user_id=employee_id,
                                                               display_name=display_name,
                                                               param=param
                                                            )
        if not result:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Not able to switch the database .. please try again ")
        
        return JSONResponse(content={"message": f"Switched to {display_name}"},status_code=status.HTTP_200_OK)
    
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))

@user_db_router.put("/api/v1/update/user_db/source/{original_display_name}")
async def update_user_db_source(request:Request,
                            original_display_name:str, 
                            user_db_schema:UserDBUpdateSchema,
                            get_user_db:UserDBSourceService = Depends(get_user_db_source_service),
                             # query_agent_service: "SQLQueryGraphAgent" = Depends(get_graph_query_agent_service)  # application_tables ignored
                             ):
    try:
        user_db_data = user_db_schema.model_dump(exclude_unset=True)

        print("***************************************************")
        if not user_db_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="No fields provided for update")
        
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        print(f"employee_id is {employee_id}")

        result = await get_user_db.update_user_db_source_by_id(user_id=employee_id,
                                                               display_name=original_display_name,
                                                               param=user_db_data
                                                            )
        if not result:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Not able to update the database .. please try again ")

        display_name, _ = await get_user_db.get_active_user_db_source_by_id(user_id=employee_id)
        print("fffffffffffff ",display_name)
        if display_name:
            user_db_source_obj = await get_user_db.get_user_db_info_by_display_name(
                user_id=employee_id, display_name=display_name
            )
            print("fffffffffffff1 ",user_db_source_obj)
            if user_db_source_obj:
                res = await get_user_db.create_schema_chunk_vectore_resource(
                    employee_id=employee_id,
                    display_name=display_name,
                    user_db_source_obj=user_db_source_obj
                )
                print("fffffffffffff2 ",res)
                if res:
                    db_config = await query_agent_service.check_db_active(user_id=employee_id, user_db_source=get_user_db)
                    print("fffffffffffff3 ",db_config)
                    if db_config:
                        await query_agent_service.rebuild_database_resources(employee_id, db_config)
                        print("fffffffffffff4 ",db_config)
                print(f"Schema/chunk/vector refreshed for '{display_name}' after update.")
    
        return JSONResponse(content={"message": f"Database settings updated"},status_code=status.HTTP_200_OK)
    
    except HTTPException as e:
        print("exec ",str(e))
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        print("exec1 ",str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))
    

@user_db_router.get("/api/v1/user_db/source/history")
async def get_user_db_source(request:Request,
                            get_user_db:UserDBSourceService = Depends(get_user_db_source_service)
                            
                            ):
    try:
        
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        print(f"employee_id is {employee_id}")

        user_db_source_data = await get_user_db.get_all_user_db_source(user_id=employee_id)
                                                            
        if not user_db_source_data:
            print("EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEXXXXXXXXXXXXXXXXXXXXXx")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Not able to fetch the database .. ")
        return user_db_source_data
        
       
    
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))    


@user_db_router.get("/api/v1/user_db/source/history/all")
async def get_all_user_db_source(request:Request,
                            get_user_db:UserDBSourceService = Depends(get_user_db_source_service)
                            
                            ):
    # fetch all the db source not only particular user id info
    try:
        
        user_db_source_data = await get_user_db.get_all_user_db_source_data()
                                                            
        if not user_db_source_data:
            print("EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEXXXXXXXXXXXXXXXXXXXXXx")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Not able to fetch the database .. ")
        return user_db_source_data
        
       
    
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))    

@user_db_router.delete("/api/v1/user_db/source/{display_name}")
async def get_user_db_source(request:Request,
                             display_name:str,
                            get_user_db:UserDBSourceService = Depends(get_user_db_source_service)
                            
                            ):
    try:
        
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        print(f"employee_id is {employee_id}")

        user_db_source_data = await get_user_db.delete_user_db_source_by_display_name(user_id=employee_id,
                                                                                      display_name=display_name)
                                                            
        if not user_db_source_data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Not able to delete the database .. please try again ")
        return JSONResponse(content={"message":f"user db source user_id {display_name} is delete ... "},status_code=status.HTTP_200_OK)
        
       
    
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))        




@user_db_router.delete("/api/v1/user_db/source/{id}")
async def delete_user_db_source_by_id(request:Request,
                             id:str,
                            get_user_db:UserDBSourceService = Depends(get_user_db_source_service)
                            
                            ):
    try:
        
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        print(f"employee_id is {employee_id}")

        user_db_source_data = await get_user_db.delete_user_db_source_by_display_id(id=id)
                                                            
        if not user_db_source_data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Not able to delete the database .. please try again ")
        return JSONResponse(content={"message":f"user db source user_id {id} is delete ... "},status_code=status.HTTP_200_OK)
        
       
    
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))   

@user_db_router.delete("/api/v1/user_db/sources")
async def get_user_db_source(request:Request,
                            get_user_db:UserDBSourceService = Depends(get_user_db_source_service)
                            ):
    try:
        
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        print(f"employee_id is {employee_id}")

        user_db_source_data = await get_user_db.clear_all_user_db_source_by_user_id(user_id=employee_id)
                                                                                      
                                                            
        if not user_db_source_data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Not able to delete the database .. please try again ")
        return JSONResponse(content={"message":f"user db source deleted  "},status_code=status.HTTP_200_OK)
        
       
    
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))  




