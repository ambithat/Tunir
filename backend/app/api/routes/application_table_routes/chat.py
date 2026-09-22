
import base64
import re
import json
from datetime import datetime
from zoneinfo import ZoneInfo
import uuid
from fastapi.encoders import jsonable_encoder

from typing import Optional

from fastapi import (Depends, FastAPI, HTTPException, WebSocketDisconnect, status, APIRouter, Query,
                     Body, Form, File, UploadFile, Request, WebSocket)
from fastapi.responses import JSONResponse, FileResponse
# from app.config  import settings as global_settings


from app.schemas.application_tables.chat import CreateSessionRequest, SendMessageRequest

from app.dependency.auth_dependency import verify_access_token_dep
from app.dependency.application_tables.chat_dependency import get_chat_session_service, get_chat_message_service, get_chat_query_service
from app.dependency.application_tables.query_agent_dependency import get_graph_query_agent_service
from app.dependency.application_tables.user_data_source_db_dependency import get_user_db_source_service

# from app.services.application_tables.chat_service import ChatSessionService, ChatMessageService, ChatQueryService  # application_tables ignored
# from app.services.application_tables.llama_model_version_3 import SQLQueryGraphAgent  # application_tables ignored
# from app.services.application_tables.user_db_source_service import UserDBSourceService  # application_tables ignored

from app.exceptions.chat_exception import ChatNotFound


chat_router = APIRouter()


################################################ chat history fetch ##############################################################################################3

@chat_router.get("/api/v1/chat/history")
async def get_all_chat_history(request:Request,
                            #   session_id:str,
                              limit: int = Query(default=10, ge=1, le=50),
                              offset: int = Query(default=0, ge=0),
                              chat_session_service:ChatSessionService = Depends(get_chat_session_service)):
    try:
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        # session_id = uuid.UUID(session_id)
        # print(f"employee_id {employee_id} and session id is {session_id}")
        result = await chat_session_service.get_chat_session_history(employee_id=employee_id,
                                                                     limit=limit,
                                                                     offset=offset,
                                                             )
        return result

    except AttributeError:
        raise HTTPException(status_code=400, detail="user_id missing in request state")


    except TypeError:
        raise HTTPException(status_code=400, detail="data must be a string")

    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))









# create a chat session
@chat_router.post("/api/v1/chat/session")
async def create_chat_session(
    request: Request,
    session_data: CreateSessionRequest, # Use the cleaned schema
    service: ChatSessionService = Depends(get_chat_session_service)
):
    try:
        print("*****************************************8888")

        # SECURE: Get ID from the token (middleware)
        print(request,"RRRRRRRRRRRRRRRRRRRR")
        print(request.state,"SSSSSSSSSSSSSSSSSSSSSSSSss")
        print(request.state.employee_id,"USSSSSSSSSSSSSSSSSSSS")
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        print(employee_id,"USSSSSSSSSSSSSSSSSSSSSS")

        # Pass only the title from the body, employee_id from token
        result = await service.create_chat_session(
            employee_id=employee_id, 
            title=session_data.title
        )
        
        return JSONResponse(content=result, status_code=status.HTTP_201_CREATED)

    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))


# update the chat session title
@chat_router.patch("/api/v1/chat/session/{session_id}/title")
async def create_chat_session(
    session_id:str,
    title:str,
    service: ChatSessionService = Depends(get_chat_session_service)
):
    try:
        # SECURE: Get ID from the token (middleware)
        
        session_id = uuid.UUID(session_id)

        # Pass only the title from the body, user_id from token
        result = await service.update_session_title(session_id=session_id,
                                                    title=title)

        if not result:
            raise ChatNotFound("Not able to update the title")
        
        return JSONResponse(content=result, status_code=status.HTTP_201_CREATED)
    
    except ChatNotFound as ce:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=str(ce))

    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))




# delete the chat session by id

@chat_router.delete("/api/v1/chat/session/{session_id}")
async def delete_chat_session(
    request:Request,
    session_id:str,
    service: ChatSessionService = Depends(get_chat_session_service)
):
    try:
        # SECURE: Get ID from the token (middleware)
        
        session_id = uuid.UUID(session_id)
        employee_id: str = request.state.employee_id  # employee_id (str) from token

        # Pass only the title from the body, employee_id from token
        result = await service.delete_session_by_id(employee_id=employee_id,
                                                    session_id=session_id)
                                                    

        if not result:
            raise ChatNotFound("Not able to delete session id")
        
        return JSONResponse(content=result, status_code=status.HTTP_201_CREATED)
    
    except ChatNotFound as ce:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=str(ce))

    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))







# get the particular session id (message details where result will contains the preview)
@chat_router.get("/api/v1/chat/session/history/{session_id}")
async def get_all_sesion_data(request:Request,
                              session_id:str,
                              limit: int = Query(default=20, ge=1, le=100),
                              before_message_id: Optional[str] = Query(default=None),
                              chat_message_data:ChatMessageService = Depends(get_chat_message_service),
                            ):
    try:
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        session_id = uuid.UUID(session_id)
        before_cursor_uuid = uuid.UUID(before_message_id) if before_message_id else None
        query_list_data = await chat_message_data.get_chat_message(employee_id=employee_id,
                                                          session_id=session_id,
                                                          limit=limit,
                                                          before_message_id=before_cursor_uuid)
        print(f"CHAT HISTORY RESULT FOR SESSION {session_id}:", query_list_data)
        return query_list_data
    except AttributeError:
        raise HTTPException(status_code=400, detail="user_id missing in request state")



    except TypeError:
        raise HTTPException(status_code=400, detail="data must be a string")

    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))




########################$$$$$$$$$$$$$$$$$$$$$$$  CHAT MESSAGE ###########################################




def parse_langgraph_message(message: str):
    blocks = message.split("\n---\n")  # split multiple reports
    results = []

    for block in blocks:
        lines = block.strip().split("\n")
        if not lines:
            continue

        remarks = lines[0].strip()
        items = []

        in_shortage_section = False

        for line in lines:
            line = line.strip()

            # Detect shortage section
            if line.lower().startswith("shortages"):
                in_shortage_section = True
                continue

            if not in_shortage_section:
                continue

            # Match: - Sensors: need 2 more
            match = re.search(r"- (.*?): need (\d+) more", line, re.IGNORECASE)
            if match:
                item_name = match.group(1).strip()
                qty = int(match.group(2))

                items.append({
                    "item": item_name,
                    "qty": qty
                })

        results.append({
            "remarks": remarks,
            "total_item": items
        })

    return results


@chat_router.post("/api/v1/chat/sessions/{session_id}/messages")
async def send_chat_message(
    request: Request,
    session_id: str, # Get from URL
    message_data: SendMessageRequest, # Get question from Body
    message_service:ChatMessageService = Depends(get_chat_message_service),
    query_service:ChatQueryService = Depends(get_chat_query_service),
    # query_agent_service:SQLQueryAgent = Depends(get_query_agent_service), # version 2
    # query_agent_service: "SQLQueryGraphAgent" = Depends(get_graph_query_agent_service),  # application_tables ignored
    # user_db_source:UserDBSourceService = Depends(get_user_db_source_service)  # application_tables ignored
    
):
    '''
    # need to add the projectname

    '''
    try:
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        session_uuid = uuid.UUID(session_id)

        print(f'USRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR IDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDd      {employee_id}')
        

        # model_query_result,query = chat_query(
        #     text=message_data.question
        # )

        last_conversation_history = await message_service.get_last_chat_history(employee_id=employee_id,
                                                                         session_id=session_uuid,
                                                                         query_service=query_service)  # remove this for the version 2
        
        # model_query_result, query = await query_agent_service.run_sql_query_agent(user_id=user_id,
        #                                                                           question=message_data.question,
        #                                                                           user_db_source=user_db_source
        # )
        print("****************************************")
        print(last_conversation_history)
        print("(((((((((((((((((((((())))))))))))))))))))))")
        '''
        "user_question": self.question,              # The final processed question
        "query": last_sql if last_sql else "",        # Raw SQL query executed
        "langgraph_message": ai_message_text,         # The AI's natural language response
        "result": clean_rows,                         # Full tabular data (unprocessed)
        "full_data": clean_rows,                      # Full data set for export
        "columns": columns,                           # Column headers
        "status": status,                             # UI state controller: DATA_LOADED, CHART_LOADED, ERROR
        "active_dashboard": active_db,                # Linked Superset dashboard name
        "dashboard_url": db_url,                      # iframe URL for dashboard
        "chart_url": c_url,                           # iframe URL for specific chart
        "chart_json": chart_json,                     # Plotly JSON for interactive charts
        "chart_name": c_name,                         # Title of the visualization
        "id": c_id,                                   # unique ID for the chart
        "download_url": dl_url,                       # CSV download link (Superset)
        "session_cookie": session_cookie,             # Auth cookie for iframe
        "chart_id": c_id                              # Alias for 'id'

        1. DATA_LOADED
        Triggered when: A standard SQL query successfully executes and returns one or more rows of data.
        UI Action: Tells the PyQT frontend to render the standard Table/Grid view to show the resulting dataset.
        
        2. NO_RESULTS
        Triggered when: A SQL query executes successfully, but the database returns 0 rows (e.g., SELECT * from users where id = 9999).
        UI Action: Tells the frontend to show a descriptive AI message explaining that no data was found, without rendering an empty table.
        
        3. CHART_LOADED
        Triggered when: The user's prompt specifically asked for a chart (pie, bar, line, etc.) and the agent successfully generated the Plotly JSON.
        UI Action: Tells the frontend to initialize the HTML renderer and draw the interactive Plotly graph.
        
        4. DASHBOARD_LOADED
        Triggered when: The user asks a question about Superset dashboards.
        UI Action: Tells the frontend to embed the Superset dashboard (via dashboard_url) inside an iframe using an active session cookie.
        
        5. REPORT
        Triggered when: The user specifically asks for an analysis, summary, or "executive report".
        UI Action: Renders a rich Markdown view (The Analysis View) without forcing a strict tabular or chart format.
        
        6. ERROR
        Triggered when: Things go wrong (e.g., maximum SQL retries exceeded, dangerous SQL detected, database connection failed, or plot generation crashed).
        UI Action: Cancels drawing complex UI elements, stops the loading spinners, and presents the langgraph_message as a warning or error text to the user.

        '''
        if message_data.product_name:
            print(f"Project name received: {message_data.product_name}")
            question = f"{message_data.question} [Project: {message_data.product_name}]"
        else:
            question = message_data.question

        embeddings = getattr(request.app.state, "embeddings", None)
        result = await query_agent_service.run_sql_query_agent(user_id=employee_id,
                                                                                  question=question,
                                                                                  user_db_source=user_db_source,
                                                                                  last_conversation_history=last_conversation_history,
                                                                                  embeddings=embeddings) # remove this for the version 2
        


        if result["query"] is None :
            print("inside here .........................")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Error occured while generaing the response try again..")
        if isinstance(result["query"],dict):
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail=result["query"]["error"])

        created_at = datetime.now(ZoneInfo("Asia/Kolkata"))


        message_id, csv_file_name, csv_file_path = await message_service.create_chat_message(
            employee_id=employee_id,
            session_id=session_uuid,
            result=result
            

        )
        if message_id is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Error occured while generaing the response try again..")

        print(f"STAR AI Message id {message_id}")

        if message_id is not None:
            completed_at = datetime.now(ZoneInfo("Asia/Kolkata"))

            query_id = await query_service.create_chat_query(
                session_id=session_id,
                message_id=message_id,
                sql_query=result["query"],
                response=result["result"],
                created_at=created_at,
                completed_at=completed_at,
                csv_file_name=csv_file_name,
                column_names=result["columns"],

            )
            if query_id is None:
                raise  HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                    detail="Error occured while generaing the response try again..")
                
            
            print(f"query_id here {query_id}")
            
            query_update_result = await message_service.update_query_id(
                query_id=query_id,
                message_id=message_id
            )
            
            print(query_update_result, "QQQQQQQQQQQQQQQQQQQQQQQQQQQQQ")
            
            if query_update_result is None:
                raise ChatNotFound("Error occurred while generating the response try again..")
            
            print(f"RESULT HERE  {result}")
            preview_3 = result["result"][:3] if isinstance(result["result"], list) else []
            preview_10 = result["result"][:10] if isinstance(result["result"], list) else []
            
            if result["status"] == 'DATA_LOADED':
                if csv_file_name:
                    with open(csv_file_path, 'rb') as f:
                        csv_content = f.read()
                    
                    csv_base64 = base64.b64encode(csv_content).decode('utf-8')
                    
                    #  FIX: Wrap content in jsonable_encoder to handle datetimes in 'preview'
                    preview_3 = result["result"][:3] if isinstance(result["result"], list) else []
                    preview_10 = result["result"][:10] if isinstance(result["result"], list) else []
                    response_data = {
                        "type": "csv",
                        "status": result["status"],
                        "message_id": str(message_id),
                        "fileName": csv_file_name,
                        "fileData": csv_base64,
                        "langgraph_message": result.get("langgraph_message"),
                        "preview": preview_3,
                        "preview_expanded": preview_10,
                        "preview_default_rows": 3,
                        "preview_expanded_rows": 10,
                        "columns":result["columns"]
                    }
                    print(response_data,type(response_data))
                    print("888888888888888888888888888")
                    
                    
                    return JSONResponse(
                        content=jsonable_encoder(response_data), 
                        status_code=status.HTTP_201_CREATED
                    )
                else:
                    response_data = {
                        "type": "json",
                        "status": result["status"],
                        "message_id": str(message_id),
                        "langgraph_message": result.get("langgraph_message"),
                        # Do not send full rows by default; UI shows preview (3), expand shows (10)
                        "columns":result["columns"],
                        "result": preview_3,
                        "preview_expanded": preview_10,
                        "preview_default_rows": 3,
                        "preview_expanded_rows": 10,
                        "total_rows": len(result["result"]) if isinstance(result["result"], list) else None,
                    }
                   

                    return JSONResponse(
                        content=jsonable_encoder(response_data),
                        status_code=status.HTTP_201_CREATED
                    )
                
            if result["status"] == 'CHART_LOADED':
                response_data = {
                    "type":"chart",
                    "status": result["status"],
                    "message_id": str(message_id),
                    "langgraph_message": result.get("langgraph_message"),
                    "chart_json":result["chart_json"],
                    "chart_name":result["chart_name"],
                    "preview_data":preview_3,
                    "columns":result["columns"]
                }
                return JSONResponse(
                    content=jsonable_encoder(response_data),
                    status_code=status.HTTP_201_CREATED
                )
            
            if result["status"] == "DASHBOARD_LOADED":
                response_data = {
                    "type": "dashboard",
                    "status": result["status"],
                    "message_id": str(message_id),
                    "langgraph_message": result.get("langgraph_message"),
                    "dashboard_url":result["dashboard_url"],
                    "active_dashboard":result["active_dashboard"],
                    "session_cookie":result["session_cookie"]
                }
                return JSONResponse(
                    content=jsonable_encoder(response_data),
                    status_code=status.HTTP_201_CREATED
                )
                
            if result["status"] == "REPORT":
                if result.get("flag"):
                    data = parse_langgraph_message(result.get("langgraph_message"))
                    response_data = {
                        "type":"report",
                        "status": result["status"],
                        "message_id":str(message_id),
                        "langgraph_message":result.get("langgraph_message"),
                        "flag":result.get("flag"),
                        "report_data":data
                    }
                else:
                    response_data = {
                        "type":"report",
                        "status": result["status"],
                        "message_id":str(message_id),
                        "langgraph_message":result.get("langgraph_message"),
                        "flag":result.get("flag"),
                        "report_data":None
                    }
                return JSONResponse(
                    content=jsonable_encoder(response_data),
                    status_code=status.HTTP_201_CREATED
                )

            # 🚨 CATCH-ALL FOR ERRORS, EMPTY QUERIES & STANDARD CHAT
            if result.get("status") in ["ERROR", "NO_RESULTS", None] or result.get("status") not in ["DATA_LOADED", "CHART_LOADED", "DASHBOARD_LOADED", "REPORT"]:
                response_data = {
                    "type": "text",
                    "status": result.get("status") or "CHAT",
                    "message_id": str(message_id),
                    "langgraph_message": result.get("langgraph_message")
                }
                return JSONResponse(
                    content=jsonable_encoder(response_data),
                    status_code=status.HTTP_201_CREATED
                )

            # return JSONResponse(content={"result":model_query_result}, status_code=status.HTTP_201_CREATED)    

        else:
            raise ChatNotFound("Error while creating the message")

        
      
        


    except ChatNotFound as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=str(e))
    except HTTPException as e:
        print("inside the http execption ",e)
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        import traceback
        print("🔴 ERROR IN CHAT MESSAGE ENDPOINT:")
        print(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))








# get the particular message details (result)
@chat_router.get(
    "/api/v1/chat/message/{message_id}"
)
async def get_message_details_by_id(
    message_id: str,
    chat_query_service: ChatQueryService = Depends(get_chat_query_service),
    chat_message_service: ChatMessageService = Depends(get_chat_message_service)
):
    try:
        # Validate UUID
        message_uuid = uuid.UUID(message_id)

        # Fetch response + CSV file path
        message_response,csv_file_path = await chat_message_service.get_chat_message_by_id(
            message_id=message_uuid,
            query_servicde=chat_query_service
        )
        print(message_response,csv_file_path,"RESPONSEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE")

        # Case 1 — No message found
        if message_response is None and csv_file_path:
            print("case 1")
            return FileResponse(
                path=csv_file_path,
                media_type="text/csv",
                filename="chat_message.csv"
            )

            
        
        if isinstance(message_response, list) and len(message_response) > 0 and csv_file_path is None:
            print("case 2")
            return message_response[0].content.get("model_result")

        # If structure is unexpected
        raise ChatNotFound("Message content is malformed or empty")



    except ChatNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))

    except AttributeError:
        raise HTTPException(status_code=400, detail="message_id missing in request state")
  
    except TypeError:
        raise HTTPException(status_code=400, detail="data must be a string")
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))
    




@chat_router.delete("/api/v1/chat/message/{message_id}")
async def delete_chat_message(
    request:Request,
    message_id:str,
    service: ChatMessageService = Depends(get_chat_message_service)
):
    try:
        # SECURE: Get ID from the token (middleware)
        
        message_id = uuid.UUID(message_id)
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        # Pass only the title from the body, employee_id from token
        result = await service.delete_message_by_id(employee_id=employee_id,
                                                    message_id=message_id)
                                                    

        if not result:
            raise ChatNotFound("Not able to delete message_id")
        
        return JSONResponse(content=result, status_code=status.HTTP_201_CREATED)
    
    except ChatNotFound as e:
        print(e)
        raise HTTPException(status_code=404, detail=str(e))
    
    except HTTPException as e:
        print(e)
        raise HTTPException(status_code=e.status_code,
                            detail=str(e.detail))
    except Exception as e:
        print(e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))
    

