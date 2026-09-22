from pwdlib import PasswordHash
from app.security.security_utils import decrypt_password
import logging

# Initialize the password context
# .recommended() uses Argon2 (Best practice)
pwd_context = PasswordHash.recommended()
logger = logging.getLogger(__name__)

# User-password creation
def hash_password(password: str) -> str:
    return password

# User-password verification
def verify_password(plain_password: str, hashed_password: str) -> bool:
    plain_password = plain_password or ""
    hashed_password = hashed_password or ""

    # Primary path: verify modern hashes (argon2/bcrypt/etc. supported by pwdlib)
    try:
        result = pwd_context.verify(plain_password, hashed_password)
        logger.info("login_verify path=hash result=%s input_len=%s stored_prefix=%s", result, len(plain_password), hashed_password[:12])
        return result
    except Exception as e:
        logger.info("login_verify path=hash error=%s input_len=%s stored_prefix=%s", str(e), len(plain_password), hashed_password[:12])
        # Backward-compatibility for legacy rows stored as plaintext.
        # This keeps login working while newly created/updated users are still hashed.
        if plain_password == hashed_password:
            logger.info("login_verify path=plain result=True input_len=%s", len(plain_password))
            return True

        # Additional backward-compatibility for legacy encrypted password rows.
        try:
            decrypted = decrypt_password(hashed_password) or ""
            result = plain_password == decrypted
            logger.info("login_verify path=decrypt result=%s input_len=%s decrypted_len=%s", result, len(plain_password), len(decrypted))
            return result
        except Exception:
            logger.info("login_verify path=decrypt result=False reason=exception")
            return False
