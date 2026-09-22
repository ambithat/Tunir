from app.db.base import get_db
from app.repositories.application_tables.chat_repository import ChatSessionRepository,ChatMessageRepository,ChatQueryExecutionRepository
# from app.services.application_tables.chat_service import ChatSessionService,ChatMessageService,ChatQueryService  # application_tables ignored
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends



async def get_chat_session_repo(db:AsyncSession = Depends(get_db)):
    return ChatSessionRepository(db)



async def get_chat_session_service(repo:ChatSessionRepository = Depends(get_chat_session_repo)
                           ):
    # application_tables ignored — returning None stub
    # return ChatSessionService(repo=repo)
    return None


async def get_chat_message_repo(db:AsyncSession = Depends(get_db)):
    return ChatMessageRepository(db)

async def get_chat_message_service(repo:ChatMessageRepository = Depends(get_chat_message_repo)):
    # application_tables ignored — returning None stub
    # return ChatMessageService(repo=repo)
    return None



async def get_chat_query_repo(db:AsyncSession = Depends(get_db)):
    return ChatQueryExecutionRepository(session=db)

async def get_chat_query_service(repo:ChatQueryExecutionRepository = Depends(get_chat_query_repo)):
    # application_tables ignored — returning None stub
    # return ChatQueryService(repo=repo)
    return None
    
    

