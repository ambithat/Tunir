from pydantic import BaseModel, Field
from typing import Annotated, Sequence, TypedDict, List, Dict, Any, Optional
import operator
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages



class AgentStateScehma(TypedDict): # Class to provide it to the graph as State and the values to be stored and each step
    # messages: Annotated[list[AnyMessage], operator.add]
    # user_question: str
    # intent: Literal["DB_QUERY", "FOLLOW_UP", "FOLLOW_UP_NON_SQL", "CHAT", None]
    # chunks_text: str | None      # From schema node
    # sql_query: str | None        # From sql_gen node  
    # last_sql: str | None         # Final validated SQL

    messages: Annotated[list, add_messages]
    user_question: str
    intent: Optional[str]
    user_id: str
    session_id: str
    message_id: str
    target_db_url: str
    schema_path: str
    vector_path: str
    chunks_text: str
    sql_query: str
    last_sql: Optional[str]
    query_id: Optional[str]
    result: List[dict]
    error: Optional[str]
    status: Optional[str]
    active_dashboard: Optional[str]
    dashboard_url: Optional[str]
    chart_url: Optional[str]
    chart_name: Optional[str]
    chart_image: Optional[str]
    chart_json: Optional[str] 
    id: Optional[int]
    download_url: Optional[str]
    session_cookie: Optional[dict]
    active_chart_id: Optional[int]
    active_chart_name: Optional[str]
    analysis_plan: Optional[dict]
    analysis_evidence: Optional[str]
    flag: Optional[bool]

class RetreiveSchema(BaseModel): # Class to provide reference to the llm regarding the arguements to be passed in the hybrid_retrieve tool
    question: str = Field(description="user question")

class GenerateSqlScehma(BaseModel): # # Class to provide reference to the llm regarding the arguements to be passed in the generate_sql tool
    question: str = Field(description="user question")
    chunks_text: str = Field(description="schema chunks to generate sql query")
    
class VerifyQuerySchema(BaseModel): # # Class to provide reference to the llm regarding the arguements to be passed in the verify_query tool
    query: str = Field(description="to verify the query")




# ══════════════════════════════════════════════════════════════════════════════
#  PYDANTIC SCHEMAS FOR @TOOLS
# ══════════════════════════════════════════════════════════════════════════════
class RetreiveSchemaSchema(BaseModel):
    question: str = Field(description="user question")

class GenerateSQLSchema(BaseModel):
    question: str = Field(description="user question")
    chunks_text: str = Field(description="schema chunks to generate sql query")

class FixSQLSchema(BaseModel):
    user_question: str = Field(description="original user question")
    sql: str = Field(description="incorrect sql query")
    error: str = Field(description="error message returned by database")
    chunks_text: str = Field(description="database schema")

class AnalysisMode(BaseModel):
    intent_summary: str = Field(description="A short 1-sentence plain-English summary of what the user actually wants to know.")
    time_context: Optional[str] = Field(default=None, description="Any time reference extracted from the question.")
    data_needed: list[str] = Field(description="A plain-English list of 3-5 data points that need to be fetched.")
    sub_questions: list[str] = Field(description="3-5 plain-English questions, each answerable by a single SQL query")
    reasoning: str = Field(description="1-2 sentences explaining what data you are collecting and why.")
