from pydantic import BaseModel, ConfigDict,Field
from typing import Optional
import uuid
from datetime import datetime

# Schema for CREATING a session
class CreateSessionRequest(BaseModel):
    title: str = Field(..., min_length=1, description="The title of the chat")

# Schema for SENDING a message
class SendMessageRequest(BaseModel):
    question: str = Field(..., min_length=1, description="The user's message/query")
    product_name: Optional[str] = Field(None, description="The name of the project associated with the chat")
    # product_name:Optional[str] = None

class ChatResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    session_id: uuid.UUID
    title: str
    created_at: datetime 
    

    # IMPORTANT: This config tells Pydantic "It's okay to read data from an ORM object"
    


class ChatMessageResponseDTO(BaseModel):
    message_id: uuid.UUID
    content: dict
    created_at: datetime 

    # IMPORTANT: This config tells Pydantic "It's okay to read data from an ORM object"
    model_config = ConfigDict(from_attributes=True)


class ChatQueryResponseDTO(BaseModel):
    query_id: uuid.UUID
    sql_query: str
    result_preview:dict

    model_config = ConfigDict(from_attributes=True)