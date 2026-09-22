from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from sqlalchemy.orm import Session
from app.repositories.application_tables.query_agent_repository import SqlQueryAgentRepository
from app.repositories.application_tables.llm_api_key_repository import ApiKeyRepository
# from app.services.llama_model_version_2 import SQLQueryAgent

# from app.services.llama_model_version_3 import SQLQueryGraphAgent
from app.services.llama_api_key_service import ApiKeyService
from fastapi import Depends

############## FOR SYNC CONNECTION
# def get_query_agent_repo(db:Session = Depends(get_db)):
#     return SqlQueryAgentRepository(db_session=db)

def get_query_agent_repo(db:AsyncSession = Depends(get_db)):
    return SqlQueryAgentRepository(db_session=db)

def get_api_key_repo(db:AsyncSession = Depends(get_db)):
    return ApiKeyRepository(session=db)
def get_api_key_service(repo:ApiKeyRepository = Depends(get_api_key_repo)):
    return ApiKeyService(repo=repo)

# def get_query_agent_service(repo:SqlQueryAgentRepository = Depends(get_query_agent_repo),
#                             service:ApiKeyService = Depends(get_api_key_service)):
#     return SQLQueryAgent(repo=repo,
#                          api_key_service=service)

def get_graph_query_agent_service(repo:SqlQueryAgentRepository = Depends(get_query_agent_repo),
                            service:ApiKeyService = Depends(get_api_key_service)):
    # application_tables ignored — returning None stub so routes won't crash at import
    # from app.services.application_tables.llama_model_version_3 import SQLQueryGraphAgent
    # return SQLQueryGraphAgent(repo=repo, api_key_service=service)
    return None




                         