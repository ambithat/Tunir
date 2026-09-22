


from fastapi import (Depends, FastAPI, HTTPException, WebSocketDisconnect, status, APIRouter, Query,
                     Body, Form, File, UploadFile, Request, WebSocket)
from fastapi.responses import JSONResponse
# from app.config  import settings as global_settings


from app.schemas.application_tables.api_key_schema import ApiKeySchema

from app.dependency.auth_dependency import verify_access_token_dep
from app.dependency.application_tables.query_agent_dependency import get_api_key_service

from app.services.llama_api_key_service import ApiKeyService



api_key_router = APIRouter()


########################################  API KEY      ######################################################


@api_key_router.post("/api/v1/create/api_key")
async def add_api_token(api_key_data:ApiKeySchema,
                        api_key_service:ApiKeyService = Depends(get_api_key_service)):
    try:
        print(api_key_service,"IIIIIIIIIIIII")
        result = await api_key_service.create_api_key(api_key=api_key_data.api_key,
                                                      priority=int(api_key_data.priority))
        if not result :
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Not able to add the api key ... please try again")
        return JSONResponse(content=result,status_code=status.HTTP_201_CREATED)
    
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))
    

@api_key_router.get("/api/v1/api_key/history")
async def get_api_tokens(api_key_service:ApiKeyService = Depends(get_api_key_service)):
    try:
        api_key_results = await api_key_service.get_all_api_key()
        if not api_key_results :
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Not able to add the api key ... please try again")
        return api_key_results
    
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))

@api_key_router.delete("/api/v1/api_key/{api_key}")
async def add_api_token(api_key:str,
                        api_key_service:ApiKeyService = Depends(get_api_key_service)):
    try:
        result = await api_key_service.delete_by_api_key(api_key=api_key)
                                                    
        if not result :
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Not able to add the api key ... please try again")
        return JSONResponse(content=result,status_code=status.HTTP_201_CREATED)
    
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))

@api_key_router.delete("/api/v1/api_key/delete/a")
async def add_api_token(api_key_service:ApiKeyService = Depends(get_api_key_service)):
    try:
        result = await api_key_service.delete_api_keys()
                                                    
        if not result :
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Not able to add the api key ... please try again")
        return JSONResponse(content=result,status_code=status.HTTP_201_CREATED)
    
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))
    



