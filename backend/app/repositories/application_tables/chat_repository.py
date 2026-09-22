import uuid
from typing import  Optional,List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, cast, and_, or_
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.exceptions.chat_exception import ChatNotFound
from app.models.application_tables.chat import ChatMessage,ChatSession,QueryExecution
from app.repositories.base_repository import AbstractRepository

'''

create
get_by_id
update_by_id
delete_by_id
delete_all

'''


class ChatSessionRepository(AbstractRepository[ChatSession]):
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, obj_in: ChatSession) -> str:
        try:
            self.session.add(obj_in)
            await self.session.flush()
            await self.session.refresh(obj_in)
            return str(obj_in.session_id)
        except IntegrityError as e:
            print(f"repo {e}")
            await self.session.rollback()
            raise ValueError("Duplicate session id or invalid data")
        except SQLAlchemyError as e:
            print(f"repo sql {e}")
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
    
    async def get_by_id(self, session_id: uuid.UUID) -> Optional[ChatSession]:
        try:
            chat_session = await self.session.get(ChatSession, session_id)
            return chat_session
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
    
    async def get_chat_session_history(self, employee_id: str, limit: int = 10, offset: int = 0) -> List[ChatSession]:  # employee_id (str)
        try:
            stmt = (
                select(ChatSession)
                .where(ChatSession.user_id == employee_id)
                .order_by(ChatSession.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
            chat_session_data = await self.session.execute(stmt)
            return chat_session_data.scalars().all()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")

    async def count_chat_sessions(self, employee_id: str) -> int:  # employee_id (str)
        try:
            stmt = select(ChatSession.session_id).where(ChatSession.user_id == employee_id)
            result = await self.session.execute(stmt)
            return len(result.scalars().all())
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")

    async def update_by_id(self, session_id: uuid.UUID, param: dict) -> Optional[ChatSession]:
        try:
            print(session_id)
            print(param)
            print("**************************")
            stmt = (
                update(ChatSession)
                .where(ChatSession.session_id == session_id)
                .values(**param)
                .returning(ChatSession)
                .execution_options(synchronize_session="fetch")
            )
            # print(1)
            result = await self.session.execute(stmt)
            # print(2)
            await self.session.flush()
            # print(result)
            chat_session_data = result.scalar_one_or_none()
            return chat_session_data
        except SQLAlchemyError as e:
            print(e)
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
    
    async def delete_by_id(self,session_id: uuid.UUID) -> Optional[uuid.UUID]:
        try:
            stmt = delete(ChatSession).where(ChatSession.session_id == session_id)
            result = await self.session.execute(stmt)
            if result.rowcount == 0:
                return None
            await self.session.flush()
            return session_id
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
        
    async def delete_by_user_session_id(self, employee_id: str,
                            session_id: uuid.UUID) -> Optional[uuid.UUID]:  # employee_id (str)
        try:
            stmt = delete(ChatSession).where(ChatSession.session_id == session_id,
                                             ChatSession.user_id == employee_id)
            result = await self.session.execute(stmt)
            if result.rowcount == 0:
                return None
            await self.session.flush()
            return session_id
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
        
    async def delete_all(self) -> bool:
        try:
            stmt = delete(ChatSession)
            await self.session.execute(stmt)
            await self.session.flush()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")


class ChatMessageRepository(AbstractRepository[ChatMessage]):
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, obj_in: ChatMessage) -> uuid.UUID:
        try:
            # print(000000000000000000000000000000000)
            self.session.add(obj_in)
            # print(1)
            await self.session.flush()
            # print(2)
            await self.session.refresh(obj_in)
            # print(3)
            print(f'{obj_in}')
            # result = await self.session.execute(select(ChatMessage).limit(1))
            # row = result.scalar_one_or_none()
            # print(row)
            # print(row.message_id)
            # print(row.content)
            # print(result, "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR")
            return obj_in.message_id
        except IntegrityError as e:
            print(e)
            await self.session.rollback()
            raise ValueError("Duplicate session id or invalid data")
        except SQLAlchemyError as e:
            print(e)
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
        
    async def get_content_by_id(
    self,
    employee_id: str,  # employee_id (str)
    session_id: uuid.UUID
):
        try:
            stmt = (
                select(
                    ChatMessage.content["question"].label("question"),
                    ChatMessage.content["query_id"].label("query_id"),
                    ChatMessage.content["langgraph_message"].label("langgraph_message")
                    # With JSONB, we can access keys directly and get them as native types
                )
                .where(
                    ChatMessage.user_id == employee_id,
                    ChatMessage.session_id == session_id
                )
                .order_by(ChatMessage.created_at.desc())
                .limit(1)
            )
            
            result = await self.session.execute(stmt)
            row = result.one_or_none()  #  Returns Row object or None
            
            return row
            
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
                    
    async def get_by_id(self, message_id: uuid.UUID) -> List[ChatMessage]:
        try:
            stmt = select(ChatMessage).where(ChatMessage.message_id == message_id)
            chat_session = await self.session.execute(stmt)
            return chat_session.scalars().all()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
    
    async def get_by_user_id(self, employee_id: str):  # employee_id (str)
        try:
            stmt = select(ChatMessage).where(ChatMessage.user_id == employee_id)
            chat_messages = await self.session.execute(stmt)
            return chat_messages
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
        
    # async def get_chat_messages(
    #     self,
    #     user_id: uuid.UUID,
    #     session_id: uuid.UUID,
    #     limit: int = 20,
    #     before_message_id: Optional[uuid.UUID] = None,
    # ) -> List[dict]:
    #     try:
    #         before_created_at = None
    #         if before_message_id:
    #             cursor_stmt = (
    #                 select(ChatMessage.created_at)
    #                 .where(
    #                     ChatMessage.user_id == user_id,
    #                     ChatMessage.session_id == session_id,
    #                     ChatMessage.message_id == before_message_id,
    #                 )
    #             )
    #             cursor_result = await self.session.execute(cursor_stmt)
    #             before_created_at = cursor_result.scalar_one_or_none()

    #         stmt = (
    #             select(
    #                 ChatMessage.message_id,
    #                 ChatMessage.content.label("raw_content"),
    #                 # Select from JSONB directly
    #                 ChatMessage.content['question'].label("question"),
    #                 ChatMessage.content['langgraph_message'].label("langgraph_message"),
    #                 ChatMessage.content['model_result'].label("model_result"),
    #                 QueryExecution.result_preview,
    #                 QueryExecution.result_type.label("type"),
    #                 ChatMessage.created_at,
    #             )
    #             # CLEAN JOIN: Use the message_id foreign key instead of looking inside JSON
    #             .outerjoin(QueryExecution, QueryExecution.message_id == ChatMessage.message_id)
    #             .where(
    #                 ChatMessage.user_id == user_id,
    #                 ChatMessage.session_id == session_id
    #             )
    #             .order_by(ChatMessage.created_at.desc(), ChatMessage.message_id.desc())
    #             .limit(limit)
    #         )

    #         if before_message_id and before_created_at is not None:
    #             stmt = stmt.where(
    #                 or_(
    #                     ChatMessage.created_at < before_created_at,
    #                     and_(
    #                         ChatMessage.created_at == before_created_at,
    #                         ChatMessage.message_id < before_message_id,
    #                     ),
    #                 )
    #             )

    #         chat_session_data = await self.session.execute(stmt)
    #         rows = chat_session_data.fetchall()
            
    #         result = []
    #         for row in rows:
    #             row_dict = dict(row._mapping)
    #             raw_content = row_dict.pop("raw_content", {})
                
    #             # If raw_content is actually a string (for very old records)
    #             if isinstance(raw_content, str):
    #                 try:
    #                     import json
    #                     raw_content = json.loads(raw_content)
    #                 except:
    #                     raw_content = {"question": raw_content}

    #             # Fallback for question
    #             if row_dict.get("question") is None and raw_content:
    #                 row_dict["question"] = raw_content.get("question") or raw_content.get("user_query") or raw_content.get("text") or ""
                
    #             # Fallback for langgraph_message
    #             if row_dict.get("langgraph_message") is None and raw_content:
    #                 row_dict["langgraph_message"] = raw_content.get("langgraph_message") or raw_content.get("ai_response") or raw_content.get("response")
                
    #             # Fallback for model_result
    #             if row_dict.get("model_result") is None and raw_content:
    #                 row_dict["model_result"] = raw_content.get("model_result") or raw_content.get("result")

    #             # Fallback for question (including older key names)
    #             if row_dict.get("question") is None and raw_content:
    #                 for key in ["question", "user_query", "text", "query", "user_query_text"]:
    #                     if raw_content.get(key):
    #                         row_dict["question"] = raw_content.get(key)
    #                         break
                
    #             # Fallback for langgraph_message (including misspelled older key)
    #             if row_dict.get("langgraph_message") is None and raw_content:
    #                 for key in ["langgraph_message", "langgrapg_message", "ai_response", "response", "langgraph_msg"]:
    #                     if raw_content.get(key):
    #                         row_dict["langgraph_message"] = raw_content.get(key)
    #                         break
                
    #             # Fallback for model_result (including older key names)
    #             if row_dict.get("model_result") is None and raw_content:
    #                 for key in ["model_result", "result", "model_output", "modelResult"]:
    #                     if raw_content.get(key):
    #                         row_dict["model_result"] = raw_content.get(key)
    #                         break                
    #             result.append(row_dict)
    #         result.reverse()
    #         return result
    #     except SQLAlchemyError as e:
    #         await self.session.rollback()
    #         raise RuntimeError(f"Database error {repr(e)}")

    async def get_chat_messages(
        self,
        employee_id: str,  # employee_id (str)
        session_id: uuid.UUID,
        limit: int = 20,
        before_message_id: Optional[uuid.UUID] = None,
    ) -> List[dict]:
        try:
            before_created_at = None
            if before_message_id:
                cursor_stmt = (
                    select(ChatMessage.created_at)
                    .where(
                        ChatMessage.user_id == employee_id,
                        ChatMessage.session_id == session_id,
                        ChatMessage.message_id == before_message_id,
                    )
                )
                cursor_result = await self.session.execute(cursor_stmt)
                before_created_at = cursor_result.scalar_one_or_none()

            stmt = (
                select(
                    ChatMessage.message_id,
                    ChatMessage.content.label("raw_content"),
                    ChatMessage.content['question'].label("question"),
                    ChatMessage.content['langgraph_message'].label("langgraph_message"),
                    ChatMessage.content['model_result'].label("model_result"),
                    ChatMessage.status,
                    ChatMessage.chat_metadata,
                    QueryExecution.result_preview,
                    QueryExecution.result_type.label("type"),
                    # --- FETCHING COLUMN NAMES FROM QueryExecution ---
                    QueryExecution.column_names.label("column_names"), 
                    ChatMessage.created_at,
                )
                .outerjoin(QueryExecution, QueryExecution.message_id == ChatMessage.message_id)
                .where(
                    ChatMessage.user_id == employee_id,
                    ChatMessage.session_id == session_id
                )
                # .order_by(ChatMessage.created_at.desc(), ChatMessage.message_id.desc())
                .order_by(ChatMessage.created_at.desc())
            )

            if before_message_id and before_created_at is not None:
                stmt = stmt.where(
                    or_(
                        ChatMessage.created_at < before_created_at,
                        and_(
                            ChatMessage.created_at == before_created_at,
                            ChatMessage.message_id < before_message_id,
                        ),
                    )
                )

            # Fetch limit + 1 to determine if there are more messages
            stmt = stmt.limit(limit + 1)
            chat_session_data = await self.session.execute(stmt)
            rows = chat_session_data.fetchall()
            
            has_next = len(rows) > limit
            if has_next:
                rows = rows[:limit]

            result = []
            for row in rows:
                row_dict = dict(row._mapping)
                
                # 1. Handle Status (Convert Enum to string)
                status_obj = row_dict.get("status")
                status_str = status_obj.value if hasattr(status_obj, 'value') else str(status_obj)
                row_dict["status"] = status_str

                # 2. Handle column_names (Ensuring it's passed for everything)
                if row_dict.get("column_names") is None:
                    row_dict["column_names"] = []

                # 3. Handle Metadata for CHART_LOADED
                metadata = row_dict.get("chat_metadata") or {}
                if status_str == "CHART_LOADED":
                    row_dict["chart_json"] = metadata.get("chart_json")
                    row_dict["chart_name"] = metadata.get("chart_name")
                else:
                    row_dict["chart_json"] = None
                    row_dict["chart_name"] = None

                # 4. Content Fallbacks
                raw_content = row_dict.pop("raw_content", {})
                if isinstance(raw_content, str):
                    try:
                        import json
                        raw_content = json.loads(raw_content)
                    except:
                        raw_content = {"question": raw_content}

                # Question Fallback
                if row_dict.get("question") is None:
                    for key in ["question", "user_query", "text"]:
                        if raw_content and raw_content.get(key):
                            row_dict["question"] = raw_content.get(key)
                            break
                
                # Langgraph Fallback
                if row_dict.get("langgraph_message") is None:
                    for key in ["langgraph_message", "ai_response", "response"]:
                        if raw_content and raw_content.get(key):
                            row_dict["langgraph_message"] = raw_content.get(key)
                            break

                # Result Fallback
                if row_dict.get("model_result") is None:
                    for key in ["model_result", "result"]:
                        if raw_content and raw_content.get(key):
                            row_dict["model_result"] = raw_content.get(key)
                            break

                result.append(row_dict)

            return {
                "messages": result,
                "has_next": has_next
            }
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")

    async def update_by_id(self, message_id: uuid.UUID, param: dict) -> Optional[ChatMessage]:
        try:
            stmt = (
                update(ChatMessage)
                .where(ChatMessage.message_id == message_id)
                .values(**param)
                .execution_options(synchronize_session="fetch")
                .returning(ChatMessage)
            )
            result = await self.session.execute(stmt)
            await self.session.flush()
            updated_record = result.scalar_one_or_none()
            print(f"Updated record here is {updated_record}")
            return updated_record
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
    
    async def delete_by_id(self,message_id: uuid.UUID) -> Optional[uuid.UUID]:
        try:
            stmt = delete(ChatMessage).where(ChatMessage.message_id == message_id)
            result = await self.session.execute(stmt)
            if result.rowcount == 0:
                return None
            await self.session.flush()
            return message_id
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
        
    async def delete_by_user_message_id(self, employee_id: str,
                            message_id: uuid.UUID) -> Optional[uuid.UUID]:  # employee_id (str)
        try:
            stmt = delete(ChatMessage).where(ChatMessage.message_id == message_id,
                                             ChatMessage.user_id == employee_id)
            result = await self.session.execute(stmt)
            if result.rowcount == 0:
                return None
            await self.session.flush()
            return message_id
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
        
    async def delete_all(self) -> bool:
        try:
            stmt = delete(ChatMessage)
            await self.session.execute(stmt)
            await self.session.flush()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")


class ChatQueryExecutionRepository(AbstractRepository[QueryExecution]):
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, obj_in: QueryExecution) -> uuid.UUID:
        try:
            print(9999999999)
            self.session.add(obj_in)
            print(8888888888888888)
            await self.session.flush()
            print(777777777777)
            await self.session.refresh(obj_in)
            print(666666666666666)
            return obj_in.query_id
        except IntegrityError as e:
            print(e)
            await self.session.rollback()
            raise ValueError("Duplicate session id or invalid data")
        except SQLAlchemyError as e:
            print(e)
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
    
    async def get_by_id(self, query_id: uuid.UUID) -> List[QueryExecution]:
        try:
            stmt = select(QueryExecution).where(QueryExecution.query_id == query_id)
            chat_session = await self.session.execute(stmt)
            result = chat_session.scalars().all()
            return result
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
    
    async def get_by_user_id(self, query_id: uuid.UUID):
        try:
            stmt = select(QueryExecution).where(QueryExecution.query_id == query_id)
            chat_session_data = await self.session.execute(stmt)
            return chat_session_data
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
        
    async def get_sql_query_only(self, query_id: uuid.UUID) -> Optional[str]:
        try:
            stmt = select(QueryExecution.sql_query).where(QueryExecution.query_id == query_id)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")

    async def update_by_id(self, query_id: uuid.UUID, param: dict) -> uuid.UUID:
        try:
            stmt = (
                update(QueryExecution)
                .where(QueryExecution.session_id == query_id)
                .values(**param)
                .execution_options(synchronize_session="fetch")
            )
            await self.session.execute(stmt)
            await self.session.flush()
            return query_id
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
    
    async def delete_by_id(self, query_id: uuid.UUID) -> Optional[uuid.UUID]:
        try:
            stmt = delete(QueryExecution).where(QueryExecution.query_id == query_id)
            result = await self.session.execute(stmt)
            if result.rowcount == 0:
                return None
            await self.session.flush()
            return query_id
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")
        
    async def delete_all(self) -> bool:
        try:
            stmt = delete(QueryExecution)
            await self.session.execute(stmt)
            await self.session.flush()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Database error {repr(e)}")





























# class ChatSessionRepository(AbstractRepository[ChatSession]):
#     def __init__(self, session: AsyncSession):
#         self.session = session
    
#     async def create(self, obj_in: ChatSession):
#         try:
#             self.session.add(obj_in)
#             await self.session.flush()
#             await self.session.refresh(obj_in)
#             return str(obj_in.session_id)
#         except IntegrityError as e:
#             print(f"repo {e}")
#             await self.session.rollback()  # <--- MUST HAVE 'await'
#             raise ValueError("Duplicate session id or invalid data")
#         except SQLAlchemyError as e:
#             print(f"repo sql {e}")
#             await self.session.rollback()  # <--- MUST HAVE 'await'
#             raise RuntimeError(f"Database error {repr(e)}")
    
#     async def get_by_id(self,
#                                       session_id: uuid.UUID):
#         try:

#             chat_session = await self.session.get(ChatSession, session_id)
#             return chat_session
#         except SQLAlchemyError as e:
#             # Note: get() usually doesn't need rollback, but it's safe to keep
#             await self.session.rollback() 
#             raise RuntimeError(f"Database error {repr(e)}")
    
#     async def get_chat_session_history(self, user_id: uuid.UUID):
#         try:
#             stmt = select(ChatSession).where(ChatSession.user_id == user_id)
#             chat_session_data = await self.session.execute(stmt)
#             return chat_session_data.scalars().all()
#         except SQLAlchemyError as e:
#             # Note: get() usually doesn't need rollback, but it's safe to keep
#             await self.session.rollback() 
#             raise RuntimeError(f"Database error {repr(e)}")

#     async def update_by_id(self, session_id: uuid.UUID, param: dict):
#         try:
#             print(session_id)
#             print(param)
#             print("**************************")
#             stmt = (
#                     update(ChatSession)
#                     .where(ChatSession.session_id == session_id)
#                     .values(**param)
#                     .returning(ChatSession)
#                     .execution_options(synchronize_session="fetch")
#             )
#             print(1)
#             result = await self.session.execute(stmt)
#             print(2)
#             await self.session.flush()
#             print(result)
#             chat_session_data = result.scalar_one_or_none()
#             return chat_session_data
#         except SQLAlchemyError as e:
#             print(e)
#             await self.session.rollback()  # <--- MUST HAVE 'await'
#             raise RuntimeError(f"Database error {repr(e)}")
    
#     async def delete_by_id(self, session_id: uuid.UUID):
#         try:
#             stmt = delete(ChatSession).where(ChatSession.session_id == session_id)
#             result = await self.session.execute(stmt)
            
#             # LOGIC FIX: Check if we actually deleted something
#             if result.rowcount == 0:
#                 return None # Or raise an error, depending on your preference
                
#             return session_id
#         except SQLAlchemyError as e:
#             await self.session.rollback()  # <--- MUST HAVE 'await'
#             raise RuntimeError(f"Database error {repr(e)}")
        
#     async def delete_all(self):
#         try:
#             stmt = delete(ChatSession)
#             await self.session.execute(stmt)
#             await self.session.flush()
#             return True
#         except SQLAlchemyError as e:
#             await self.session.rollback()
#             raise RuntimeError(f"Database error {repr(e)}")



# class ChatMessageRepository(AbstractRepository[ChatMessage]):
#     def __init__(self, session: AsyncSession):
#         self.session = session
    
#     async def create(self, obj_in: ChatMessage):
#         try:
#             self.session.add(obj_in)
#             print(1)
#             await self.session.flush()
#             print(2)
#             await self.session.refresh(obj_in)
#             print(3)
#             print(f'{obj_in}')
#             result = await self.session.execute(select(ChatMessage).limit(1))
#             row = result.scalar_one_or_none()
#             print(row)
#             print(row.message_id)
#             print(row.content)
#             print(result,"RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR")
            
#             return obj_in.message_id
#         except IntegrityError as e:
#             print(e)
#             await self.session.rollback()  # <--- MUST HAVE 'await'
#             raise ValueError("Duplicate session id or invalid data")
#         except SQLAlchemyError as e:
#             print(e)
#             await self.session.rollback()  # <--- MUST HAVE 'await'
#             raise RuntimeError(f"Database error {repr(e)}")
    
#     async def get_by_id(self, message_id: uuid.UUID):
#         try:
#             stmt = select(ChatMessage).where(ChatMessage.message_id == message_id)
#             # chat_session = await self.session.get(ChatMessage, message_id)
#             chat_session = await self.session.execute(stmt)
#             return chat_session.scalars().all()
#             # rows = chat_session.fetchall()
#             # result = [dict(row._mapping) for row in rows]
#             # return result
#         except SQLAlchemyError as e:
#             # Note: get() usually doesn't need rollback, but it's safe to keep
#             await self.session.rollback() 
#             raise RuntimeError(f"Database error {repr(e)}")
    
#     async def get_by_user_id(self, user_id:uuid.UUID):
#         try:
#             stmt = select(ChatMessage).where(ChatMessage.user_id == user_id)
#             chat_messages =  await self.session.execute(stmt)
#             return chat_messages
#         except SQLAlchemyError as e:
#             await self.session.rollback()
#             raise RuntimeError(f"Database error {repr(e)}")
        
    
#     async def get_chat_messages(self, user_id: uuid.UUID,session_id:uuid.UUID):
#         try:
#             stmt = (
#                 select(
#                     # FIX 1: Correct JSON extraction (use ['key'].astext for text)
#                     ChatMessage.message_id,ChatMessage.content['question'].as_string().label("question"),
#                     QueryExecution.result_preview
#                 )
#                 # FIX 2: Use .join() instead of .join_from() (Cleaner, since we select from ChatMessage first)
#                 # Also assuming query_id is a real column on ChatMessage, not inside the JSON
#                 .join(QueryExecution, cast(ChatMessage.content['query_id'].as_string(),UUID) == QueryExecution.query_id)
                
#                 # FIX 3: Use comma ',' instead of 'and'
#                 .where(
#                     ChatMessage.user_id == user_id,
#                     ChatMessage.session_id == session_id
#                 )
#             )

#             # stmt = select(ChatMessage).where(ChatMessage.session_id == session_id  and ChatMessage.user_id == user_id)
#             chat_session_data = await self.session.execute(stmt)
#             rows = chat_session_data.fetchall()

#             result = [dict(row._mapping) for row in rows]


#             return result
#         except SQLAlchemyError as e:
#             # Note: get() usually doesn't need rollback, but it's safe to keep
#             await self.session.rollback() 
#             raise RuntimeError(f"Database error {repr(e)}")

#     async def update_by_id(self, message_id: uuid.UUID, param: dict):
#         try:
            
#             stmt = (
#                     update(ChatMessage)
#                     .where(ChatMessage.message_id == message_id)
#                     .values(**param)
#                     .execution_options(synchronize_session="fetch")
#                     .returning(ChatMessage)
#             )
#             result = await self.session.execute(stmt)
#             await self.session.flush()
#             updated_record = result.scalar_one_or_none()
#             print(f"UPdated record here is {updated_record}")
#             return updated_record
#         except SQLAlchemyError as e:
#             await self.session.rollback()  # <--- MUST HAVE 'await'
#             raise RuntimeError(f"Database error {repr(e)}")
    
#     async def delete_by_id(self, message_id: uuid.UUID):
#         try:
#             stmt = delete(ChatMessage).where(ChatMessage.message_id == message_id)
#             result = await self.session.execute(stmt)
            
#             # LOGIC FIX: Check if we actually deleted something
#             if result.rowcount == 0:
#                 return None # Or raise an error, depending on your preference
                
#             return message_id
#         except SQLAlchemyError as e:
#             await self.session.rollback()  # <--- MUST HAVE 'await'
#             raise RuntimeError(f"Database error {repr(e)}")
        
#     async def delete_all(self):
#         try:
#             stmt = delete(ChatMessage)
#             await self.session.execute(stmt)
#             await self.session.flush()
#             return True
#         except SQLAlchemyError as e:
#             await self.session.rollback()
#             raise RuntimeError(f"Database error {repr(e)}")



# class ChatQueryExecutionRepository(AbstractRepository[QueryExecution]):
#     def __init__(self, session: AsyncSession):
#         self.session = session
    
#     async def create(self, obj_in: QueryExecution):
#         try:
#             print(9999999999        )
#             self.session.add(obj_in)
#             print(8888888888888888)
#             await self.session.flush()
#             print(777777777777)
#             await self.session.refresh(obj_in)
#             print(666666666666666)
#             return obj_in.query_id
#         except IntegrityError as e:
#             print(e)
#             await self.session.rollback()  # <--- MUST HAVE 'await'
#             raise ValueError("Duplicate session id or invalid data")
#         except SQLAlchemyError as e:
#             print(e)
#             await self.session.rollback()  # <--- MUST HAVE 'await'
#             raise RuntimeError(f"Database error {repr(e)}")
    
#     async def get_by_id(self, query_id: uuid.UUID):
#         try:
#             # stmt = select(QueryExecution).where(QueryExecution.query_id.in_(query_id_list))
#             stmt = select(QueryExecution).where(QueryExecution.query_id == query_id)
#             # chat_session = await self.session.get(QueryExecution,query_id)
#             chat_session = await self.session.execute(stmt)
#             result = chat_session.scalars().all()
#             return result
#         except SQLAlchemyError as e:
#             # Note: get() usually doesn't need rollback, but it's safe to keep
#             await self.session.rollback() 
#             raise RuntimeError(f"Database error {repr(e)}")
    
#     async def get_by_user_id(self, query_id: uuid.UUID):
#         try:
#             stmt = select(QueryExecution).where(QueryExecution.query_id == query_id)
#             chat_session_data = await self.session.execute(stmt)
#             return chat_session_data
#         except SQLAlchemyError as e:
#             # Note: get() usually doesn't need rollback, but it's safe to keep
#             await self.session.rollback() 
#             raise RuntimeError(f"Database error {repr(e)}")
        
#     async def get_sql_query_only(self, query_id: uuid.UUID) -> Optional[str]:
#         try:
#             # Select ONLY the specific column
#             stmt = select(QueryExecution.sql_query).where(QueryExecution.query_id == query_id)
#             result = await self.session.execute(stmt)
            
#             # Since we selected a specific column, scalar_one_or_none() returns that value (str)
#             return result.scalar_one_or_none()
#         except SQLAlchemyError as e:
#             await self.session.rollback()
#             raise RuntimeError(f"Database error {repr(e)}")

#     async def update_by_id(self, query_id: uuid.UUID, param: dict):
#         try:
#             stmt = (
#                     update(QueryExecution)
#                     .where(QueryExecution.session_id == query_id)
#                     .values(**param)
#                     .execution_options(synchronize_session="fetch")
#             )
#             await self.session.execute(stmt)
#             await self.session.flush()
#             return query_id
#         except SQLAlchemyError as e:
#             await self.session.rollback()  # <--- MUST HAVE 'await'
#             raise RuntimeError(f"Database error {repr(e)}")
    
#     async def delete_by_id(self, query_id: uuid.UUID):
#         try:
#             stmt = delete(QueryExecution).where(QueryExecution.query_id == query_id)
#             result = await self.session.execute(stmt)
            
#             # LOGIC FIX: Check if we actually deleted something
#             if result.rowcount == 0:
#                 return None # Or raise an error, depending on your preference
                
#             return query_id
#         except SQLAlchemyError as e:
#             await self.session.rollback()  # <--- MUST HAVE 'await'
#             raise RuntimeError(f"Database error {repr(e)}")
        
#     async def delete_all(self):
#         try:
#             stmt = delete(QueryExecution)
#             await self.session.execute(stmt)
#             await self.session.flush()
#             return True
#         except SQLAlchemyError as e:
#             await self.session.rollback()
#             raise RuntimeError(f"Database error {repr(e)}")
              

