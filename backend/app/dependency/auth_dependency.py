
import uuid
from app.db.base import get_db
from app.repositories.auth_repository import AuthRepository
from app.security.token_utils import verify_access_token
from app.services.auth_service import AuthService
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends,Request,status,HTTPException


from datetime import datetime
from zoneinfo import ZoneInfo

async def get_user_auth_repo(db:AsyncSession = Depends(get_db)):
    return AuthRepository(db)


async def get_user_auth(repo:AuthRepository = Depends(get_user_auth_repo)):
    return AuthService(repo=repo)



from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
security = HTTPBearer(auto_error=False)

async def verify_access_token_dep(request: Request,
                                  # Adding this 'Depends(security)' is what makes the button appear in Swagger
                                  token_data: HTTPAuthorizationCredentials |None = Depends(security),
                                  db: AsyncSession = Depends(get_db)
                                  ):
    """Dependency to check JWT access token on protected routes."""
   
    token = token_data.credentials if token_data else None

    # Fallback token extraction from headers, query params, or cookies
    if not token:
        auth_hdr = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth_hdr and auth_hdr.lower().startswith("bearer "):
            token = auth_hdr.split(" ", 1)[1].strip()
        elif auth_hdr:
            token = auth_hdr.strip()

    if not token:
        token = request.query_params.get("token") or request.query_params.get("access_token")

    if not token:
        token = request.cookies.get("access_token") or request.cookies.get("token")

    if not token:
        try:
            body_bytes = await request.body()
            if body_bytes:
                import json
                body_json = json.loads(body_bytes)
                if isinstance(body_json, dict):
                    token = body_json.get("token") or body_json.get("access_token")
        except Exception:
            pass

    # 1. Get the result (which contains "valid" and "payload")
    verification_result = verify_access_token(token) if token else {"valid": False, "reason": "missing_token"}
    print(f"[AuthDep Debug] Token present: {bool(token)}, Result: {verification_result}")
    
    # 2. Check validity
    if not verification_result or verification_result.get("valid") is False:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid or missing access token ({verification_result.get('reason', 'unauthorized')})")

    # 3. EXTRACT THE INNER PAYLOAD
    token_payload = verification_result.get("payload") # <--- THIS WAS MISSING

    emp_id = token_payload.get("sub")

    # Query leader directly from DB
    from app.models.sales.leader import Leader
    stmt = select(Leader).where(Leader.emp_id == emp_id)
    result = await db.execute(stmt)
    leader_obj = result.scalar_one_or_none()

    if not leader_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Leader not found"
        )

    if not leader_obj.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Leader is inactive"
        )

    role_value = getattr(leader_obj, "role", "user") or "user"

    request.state.emp_id = leader_obj.emp_id
    request.state.employee_id = leader_obj.emp_id
    request.state.user = leader_obj
    request.state.role = role_value
    request.state.designation = leader_obj.designation
    return leader_obj


async def verify_cfo_access(
    current_user = Depends(verify_access_token_dep)
):
    """Dependency enforcing that only super admin role can perform privileged administrative operations."""
    role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    if role != "super admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Only super admin role is authorized to perform this operation."
        )
    return current_user


async def verify_user_status(employee_id:str,
                             user_service):
        # . db check for the user 
    print(employee_id)
    print(user_service)
    
    user = await user_service.get_user_profile_by_id(employee_id=employee_id)
    print(user)
    print(user["user_data"])
    if  user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="user account deleted")
    if not user["user_data"]["is_active"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="user account deleted")
    


async def verify_access_token_dep_sse(
    request: Request,
    token_data: HTTPAuthorizationCredentials | None = Depends(security),
):
    token = None
    if token_data and token_data.credentials:
        token = token_data.credentials
    else:
        token = request.query_params.get("token")

    if not token:
        raise HTTPException(status_code=401, detail="Missing token")

    verification_result = verify_access_token(token)

    if not verification_result or not verification_result.get("valid"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    token_payload = verification_result["payload"]
    employee_id = token_payload["sub"]

    # Query Leader directly from DB with a short-lived session so it doesn't stay open for the whole SSE stream
    from app.db.base import get_main_session_factory
    from app.models.sales.leader import Leader
    async with get_main_session_factory()() as db:

        # Query leader directly from DB
        stmt = select(Leader).where(Leader.emp_id == employee_id)
        result = await db.execute(stmt)
        leader_obj = result.scalar_one_or_none()

        if leader_obj is None or not leader_obj.is_active:
            raise HTTPException(status_code=401, detail="Leader account inactive or deleted")

        role_value = getattr(leader_obj, "role", "user") or "user"

    request.state.emp_id = leader_obj.emp_id
    request.state.employee_id = leader_obj.emp_id
    request.state.user = leader_obj
    request.state.role = role_value
    request.state.designation = leader_obj.designation



# async def verify_access_token_dep(request: Request):
#     """Dependency to check JWT access token on protected routes."""
#     auth_header = request.headers.get("Authorization")
#     if not auth_header or not auth_header.startswith("Bearer "):
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token header")

#     token = auth_header.split(" ")[1]
#     payload = verify_access_token(token)
#     if not payload:
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token")

#     # Attach user info to request.state
#     request.state.user_id = payload.get("sub")
#     request.state.role = payload.get("role")
