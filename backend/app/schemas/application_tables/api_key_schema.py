from pydantic import BaseModel,ConfigDict
from app.models.application_tables.api_key import KeyStatus
from datetime import datetime

class ApiKeySchema(BaseModel):
    api_key:str
    priority:int

class ApiKeyDTO(BaseModel):
    id:int              
    api_key:str            
    status:KeyStatus
    rate_limited_at:datetime|None = None  
    next_available_at :datetime|None = None 
    last_used_at :datetime|None = None     
    priority  :int|None = None        
    fail_count :int|None = None


    model_config = ConfigDict(from_attributes=True)

class LlamaDBSchema(BaseModel):
    driver:str
    host:str
    port:int
    user:str
    password:str
    db:str
    db_scheme:str
    
    
