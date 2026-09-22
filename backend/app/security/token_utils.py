import jwt
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pwdlib import PasswordHash
from pathlib import Path
from app.config import settings as global_setting

# Load keys
SECRET_KEY = getattr(global_setting, "JWT_SECRET_KEY", "default_unsafe_secret_key_change_me_in_production")

# === REPLACE PASSLIB WITH PWDLIB ===
# PasswordHash.recommended() defaults to Argon2 (more secure/modern than bcrypt)
# If you STRICTLY need bcrypt, use: PasswordHash.recommended() but ensure bcrypt is installed
pwd_context = PasswordHash.recommended()

# === Access Token (ES256 JWT) ===
def create_access_token(employee_id: str, role: str, name: str, leader_id: str = None):
    try:
        ist = ZoneInfo("Asia/Kolkata")
        now = datetime.now(ist)
        expire_seconds = getattr(global_setting, "ACCESS_TOKEN_EXPIRE_SECONDS", 60) or 60
        expire = now + timedelta(seconds=expire_seconds)
        
        payload = {
            "sub": employee_id,
            "leader_id": leader_id,
            "name": name,
            "role": role,
            "exp": expire,
            "iat": now
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
        return token
    except Exception as e:
        raise RuntimeError(f"Failed to create access token: {e}") from e

def verify_access_token(token: str):
    try:
        # Check algorithms
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return {"valid": True, "payload": payload}
    except jwt.ExpiredSignatureError:
        return {"valid": False, "reason": "expired"}
    except jwt.InvalidTokenError:
        return {"valid": False, "reason": "invalid"}

# === Refresh Token (UUID + Hashing) ===
def create_refresh_token():
    token = str(uuid.uuid4())
    
    # pwdlib usage is almost identical to passlib
    token_hash = pwd_context.hash(token).encode('utf-8') 
    ist = ZoneInfo("Asia/Kolkata")
    refresh_token_expiry = datetime.now(ist) + timedelta(days=15)
    refresh_token_expiry = refresh_token_expiry.replace(tzinfo=None)
    return token, token_hash, refresh_token_expiry

def verify_refresh_token(token, token_hash ) -> bool:
    # pwdlib verifies securely
    print(f"token {token}, type {type(token)}")
    print(f"token_hash  {token_hash }, type  {type(token_hash)}")
    return pwd_context.verify(token, token_hash)

# This function is redundant if you use create_refresh_token, 
# but here is how to do it just in case:
def hash_refresh_token(token: str) -> str:
    return pwd_context.hash(token)
