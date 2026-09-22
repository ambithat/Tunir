from pydantic import BaseModel, Field
import uuid


class NotificationModel(BaseModel):
    id: str | None = Field(None, description="ID of the  associated with the notification")
    user_id:str = Field(..., description="ID of the notification recipient")
    approver_id:str | None = Field(None,description="ID of the approver associated with the notification") 
    notification_type:str = Field(...,description="Type of the notification")
    

