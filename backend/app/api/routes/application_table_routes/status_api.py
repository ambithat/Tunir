from fastapi import APIRouter, Query, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import Enum
from app.models import Base

status_router = APIRouter()

@status_router.get("/api/v1/status/all")
async def get_all_status_enums():
    try:
        results = {}
        for mapper in Base.registry.mappers:
            cls = mapper.class_
            t_name = getattr(cls, "__tablename__", None)
            if not t_name:
                continue
            
            
            

            # New code: only return tables/columns that actually have enum values
            columns = mapper.columns
            for col in columns:
                col_name = col.name
                # Check for standard Enum column
                if isinstance(col.type, Enum):
                    values = col.type.enums
                    if t_name not in results:
                        results[t_name] = {}
                    results[t_name][col_name] = values
                # Check for ARRAY of Enum column (like User.teams or Product.teams)
                elif hasattr(col.type, 'item_type') and isinstance(col.type.item_type, Enum):
                    values = col.type.item_type.enums
                    if t_name not in results:
                        results[t_name] = {}
                    results[t_name][col_name] = values
                    
                    # (Removed static level ranges per user request)
                    
        return JSONResponse(content=results)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
