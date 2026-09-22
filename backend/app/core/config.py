import ast
import json
import logging
from starlette.config import Config
from typing import Dict,List
from pathlib import Path

APP_VERSION = "0.3"
APP_NAME = "STAR-AI"
API_PREFIX = "/api"

logger = logging.getLogger("uvicorn.error")


# import the .env file from the Assets folder
config = Config("app/assets/.env")

# Convert to Path objects for cross-platform reliability
LOG_ERROR_FILE_PATH = Path(config("LOG_ERROR_FILE_PATH", default="app/logs/error.log"))
LOG_API_FILE_PATH = Path(config("LOG_API_FILE_PATH", default="app/logs/api.log"))
CSV_FILE_PATH = Path(config("CSV_FILE_PATH", default="app/assets/csv"))
MAX_CSV_ROWS: int = config("MAX_CSV_ROWS", cast=int, default=1000)
SEAWEEDFS_FILER_URL: str = config("SEAWEEDFS_FILER_URL", default="http://starai.local:8888")

# DB_USER:str = config("DB_USER")
# DB_PASSWORD:str = config("DB_PASSWORD")
# DB_HOST:str = config("DB_HOST")
# DB_PORT:str = config("DB_PORT")
# DB_DATABASE:str = config("DB_DATABASE")

# SSL_KEY_FILE:str = config("SSL_KEY_FILE")
# SSL_CRT_FILE:str = config("SSL_CRT_FILE")
# SECRET_KEY:str = config("SECRET_KEY")
# ALGORITHM:str = config("ALGORITHM")





# TRAINCLASSLIST: Dict[int, str] = {int(k): v for k, v in json.loads(train_class_list_json).items()}

# ELEPHANT_KEY_VALUES_ZONE_CLOSE: List = ast.literal_eval(config("ELEPHANT_KEY_VALUES_ZONE_CLOSE"))

# COLOR_MAP: dict = ast.literal_eval(config("COLOR_MAP"))




print(f"configuration completed ...")
