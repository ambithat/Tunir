from pydantic import BaseModel, Field
from typing import List, Union


class BulkDeleteRequest(BaseModel):
    ids: List[Union[str, int]] = Field(..., min_items=1, description="List of record IDs to delete")
