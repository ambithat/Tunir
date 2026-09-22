from sqlalchemy.engine import URL
from app.models.application_tables. user_data_source_db import UserDbSource
from app.security.security_utils import decrypt_password
from app.config import settings as global_setting



def build_db_url_from_source(db_source, sync: bool = False) -> URL:
    """
    Centralized logic to convert a UserDbSource object into a SQLAlchemy URL.
    """
    if not isinstance(db_source, UserDbSource):
        raise TypeError("db_source must be a UserDbSource instance")

    driver_key = (db_source.database_type or "").strip().lower()
    if not driver_key:
        raise ValueError("UserDbSource.database_type is required")

    print(driver_key, f"DRIVER KEY EXTRACTED FROM DB SOURCE (sync={sync})")
    
    # Use sync map if requested, otherwise default async map
    scheme_map = global_setting.DB_SYNC_SCHEME_MAP if sync else global_setting.DB_SCHEME_MAP
    driver = scheme_map.get(driver_key)
    
    if not driver:
        raise ValueError(
            f"Unknown scheme '{driver_key}' in UserDbSource. Supported schemes: {', '.join(scheme_map.keys())}"
        )
    print(driver, "MAPPED DRIVER FOR SQLALCHEMY URL")
    real_password = db_source.password or ""
    print(real_password, "REAL PASSWORD FROM DB SOURCE")
    try:
        real_password = decrypt_password(real_password)
        print(real_password, "DECRYPTED REAL PASSWORD FROM DB SOURCE")
    except Exception as e:
        raise ValueError(
            f"Failed to decrypt password for UserDbSource id={db_source._id} user_id={db_source.user_id}: {e}"
        ) from e
    # if real_password.startswith("gAAAA"):
    #     try:
    #         real_password = decrypt_password(real_password)
    #     except Exception as e:
    #         raise ValueError(
    #             f"Failed to decrypt password for UserDbSource id={db_source._id} user_id={db_source.user_id}: {e}"
    #         ) from e
    # Strip whitespace/newlines that Fernet may add, which causes TCP auth failures
    real_password = real_password.strip()
    print(driver, "FINAL DRIVER")
    print(real_password, "FINAL REAL PASSWORD")
    print(db_source.host, "DB SOURCE HOST")
    print(db_source.port, "DB SOURCE PORT")
    print(db_source.db_name, "DB SOURCE NAME")  
    
    url = URL.create(
        drivername=driver,
        username=db_source.user_name,
        password=real_password,
        host=db_source.host,
        port=db_source.port,
        database=db_source.db_name,
    )
    

    return url

