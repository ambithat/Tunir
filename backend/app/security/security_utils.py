from typing import List, Optional
import logging
from cryptography.fernet import Fernet, MultiFernet
from app.config import settings as global_settings

logger = logging.getLogger(__name__)


def normalize_fernet_key(key: str) -> str:
    if not key:
        raise ValueError("Encryption key is empty")
    if isinstance(key, bytes):
        key = key.decode("utf-8")
    key = key.strip()
    if key.startswith('"') and key.endswith('"'):
        key = key[1:-1]
    if key.startswith("'") and key.endswith("'"):
        key = key[1:-1]
    return key


def build_fernet_cipher() -> Fernet:
    primary_key = normalize_fernet_key(global_settings.DB_ENCRYPTION_KEY)
    keys: List[str] = [primary_key]
    legacy_keys = getattr(global_settings, "DB_ENCRYPTION_KEY_LEGACY", None)
    if legacy_keys:
        for raw_key in [key.strip() for key in legacy_keys.replace(";", ",").split(",") if key.strip()]:
            normalized = normalize_fernet_key(raw_key)
            if normalized and normalized not in keys:
                keys.append(normalized)

    if len(keys) == 1:
        return Fernet(keys[0].encode("utf-8"))

    return MultiFernet([Fernet(key.encode("utf-8")) for key in keys])


cipher = build_fernet_cipher()


def encrypt_password(plain_password: str) -> str:
    """Encrypt password using Fernet cipher."""
    if not plain_password:
        return ""
    try:
        return cipher.encrypt(plain_password.encode('utf-8')).decode('utf-8')
    except Exception as e:
        logger.error("Fernet encryption error: %s", e)
        raise ValueError(f"Encryption failed. Please check your DB_ENCRYPTION_KEY.")


def decrypt_password(encrypted_password: str) -> str:
    """Decrypt a Fernet token back to the original password. Handles multiple levels of encryption."""
    if not encrypted_password:
        return ""
    
    # If it's not a Fernet token, assume it's already plaintext (legacy support)
    if not encrypted_password.startswith("gAAAA"):
        return encrypted_password

    try:
        return cipher.decrypt(encrypted_password.encode('utf-8')).decode('utf-8')
    except Exception as e:
        logger.error("Fernet decryption failed: %s", e)
        raise ValueError(f"Decryption failed. Please check your DB_ENCRYPTION_KEY.")
