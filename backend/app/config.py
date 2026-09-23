import os
import re
import json
from pathlib import Path
from pydantic import BaseModel, PostgresDsn, RedisDsn, computed_field
from pydantic_core import MultiHostUrl
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, ClassVar, Dict, Set
from sqlalchemy.engine.url import URL as SAURL

from app.schemas.application_tables.api_key_schema import LlamaDBSchema

# Constants moved outside for safety but also referenced inside
IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
SQL_TYPE_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_]*(\(\s*\d+\s*(,\s*\d+\s*)?\))?$")
ALLOWED_SQL_TYPES = {
    "INT", "INTEGER", "BIGINT", "SMALLINT", "TINYINT",
    "FLOAT", "DOUBLE", "REAL", "DECIMAL", "NUMERIC",
    "BOOLEAN", "CHAR", "VARCHAR", "TEXT",
    "DATE", "TIME", "DATETIME", "TIMESTAMP", "JSON", "BLOB",
}

class SMTPConfig(BaseModel):
    server: str = os.getenv("EMAIL_HOST", "smtp_server")
    port: int = os.getenv("EMAIL_PORT", 587)
    username: str = os.getenv("EMAIL_HOST_USER", "smtp_user")
    password: str = os.getenv("EMAIL_HOST_PASSWORD", "smtp_password")
    template_path: str = os.getenv("EMAIL_TEMPLATE_PATH", "templates")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="app/assets/.env", env_ignore_empty=True, extra="ignore"
    )

    # ClassVars tell Pydantic these are NOT fields
    IDENTIFIER_PATTERN: ClassVar = IDENTIFIER_PATTERN
    SQL_TYPE_PATTERN: ClassVar = SQL_TYPE_PATTERN
    ALLOWED_SQL_TYPES: ClassVar = ALLOWED_SQL_TYPES

    DB_SCHEME_MAP: ClassVar[Dict[str, str]] = {
        # "postgresql": "postgresql+psycopg",#old one with sync
        "postgresql": "postgresql+asyncpg",
        "pg": "postgresql+asyncpg",
        "mysql": "mysql+pymysql",
        "mariadb": "mariadb+pymysql",
        "mssql": "mssql+pyodbc",
        "sqlite": "sqlite"
    }

    # Add sync-compatible map for schema extraction/reflection
    DB_SYNC_SCHEME_MAP: ClassVar[Dict[str, str]] = {
        "postgresql": "postgresql+psycopg2",
        "pg": "postgresql+psycopg2",
        "mysql": "mysql+pymysql",
        "mariadb": "mariadb+pymysql",
        "mssql": "mssql+pyodbc",
        "sqlite": "sqlite"
    }

    
    BASE_STORAGE_DIR: str = "/data"
    JWT_SECRET_KEY: str = "default_unsafe_secret_key_change_me_in_production"

    DB_ENCRYPTION_KEY: str = ""
    DB_ENCRYPTION_KEY_LEGACY: Optional[str] = None

    # ── Llama / AI model paths (Optional — only needed if using local AI features) ──
    SCHEMA_FILE: str = "/data/schema.json"
    STAR_AI_SCHEMA_FILE: str = "/data/star_ai_schema.json"
    SQL_DB_PATH: str = "/data/sql.db"
    CHUNK_SAVE_DIR: str = "/data/chunks"
    STAR_AI_CHUNK_SAVE_DIR: str = "/data/star_ai_chunks"
    VECTORSTORE_PATH: str = "/data/vectorstore"
    STAR_AI_VECTORSTORE_PATH: str = "/data/star_ai_vectorstore"
    EMBED_MODEL: Optional[str] = None
    LLAMA_MODEL_NAME: Optional[str] = None
    RETRIEVER_K: int = 5
    WARMUP_PAYLOAD: Optional[str] = None
    MAX_RETRY: int = 3

    # ── Groq API Keys (Optional — only needed for AI chat features) ──────────
    GROQ_API_KEY_1: Optional[str] = None
    GROQ_API_KEY_2: Optional[str] = None
    GROQ_API_KEY_3: Optional[str] = None

    # ── Token / Auth settings ─────────────────────────────────────────────────
    # TOKEN_PRIVATE_KEY_FILE and TOKEN_PUBLIC_KEY_FILE are NOT needed
    # since we use symmetric JWT (HS256) with JWT_SECRET_KEY
    ACCESS_TOKEN_EXPIRE_MINUTES: Optional[int] = 1
    ACCESS_TOKEN_EXPIRE_SECONDS: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MAX_SESSIONS: int = 3



    LOG_ERROR_FILE_PATH: str = "app/logs/error.log"
    LOG_API_FILE_PATH: str = "app/logs/app.log"

    # POSTGRES_USER: str
    # POSTGRES_PASSWORD: str
    # POSTGRES_HOST: str
    # POSTGRES_DB: str


    DATABASE_URL: Optional[PostgresDsn] = None

    # These are for local development using your .env file
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_HOST: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    POSTGRES_PORT: Optional[int] = 15432



    # Sql Query Agent 
    QUERY_AGENT_HOST: str = ""
    QUERY_AGENT_PORT: str = ""
    QUERY_AGENT_DB: str = ""
    QUERY_AGENT_USER: str = ""
    QUERY_AGENT_PASSWORD: str = ""
    QUERY_AGENT_SCHEME: str = ""
    CONFIG_PATH:Path = Path("app/assets/db_config.json")
    IMAGE_EXTENSIONS: ClassVar[Set[str]] = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    UPLOAD_BASE_DIR: str = "/data/uploads"



    @computed_field
    @property
    def asyncpg_url(self) -> PostgresDsn:
        """
        This is a computed field that generates a PostgresDsn URL for asyncpg.

        The URL is built using the MultiHostUrl.build method, which takes the following parameters:
        - scheme: The scheme of the URL. In this case, it is "postgresql+asyncpg".
        - username: The username for the Postgres database, retrieved from the POSTGRES_USER environment variable.
        - password: The password for the Postgres database, retrieved from the POSTGRES_PASSWORD environment variable.
        - host: The host of the Postgres database, retrieved from the POSTGRES_HOST environment variable.
        - path: The path of the Postgres database, retrieved from the POSTGRES_DB environment variable.

        Returns:
            PostgresDsn: The constructed PostgresDsn URL for asyncpg.
        ------------------------------------------------------------------------------------------------------------------
        Computes the asyncpg database URL.

        If a complete DATABASE_URL is provided as an environment variable (standard for production),
        it will be used directly.

        Otherwise, it constructs the URL from the individual POSTGRES_* variables
        (standard for local development with a .env file).


        """
   
        
        
        if self.DATABASE_URL:
            # In production (Railway), DATABASE_URL is a complete DSN string.
            # Pydantic v2 PostgresDsn does NOT expose .username/.password as direct
            # attributes — so we convert the URL string directly instead.
            db_url_str = str(self.DATABASE_URL)
            # Railway injects "postgresql://" or "postgres://" — replace with asyncpg scheme
            db_url_str = db_url_str.replace("postgresql://", "postgresql+asyncpg://", 1)
            db_url_str = db_url_str.replace("postgres://", "postgresql+asyncpg://", 1)
            return MultiHostUrl(db_url_str)

        elif all([self.POSTGRES_USER, self.POSTGRES_PASSWORD, self.POSTGRES_HOST, self.POSTGRES_DB, self.POSTGRES_PORT]):
            # In local development, build the URL from the .env file parts.
            return MultiHostUrl.build(
                scheme="postgresql+asyncpg",
                username=self.POSTGRES_USER,
                password=self.POSTGRES_PASSWORD,
                host=self.POSTGRES_HOST,
                port=self.POSTGRES_PORT,
                path=f"{self.POSTGRES_DB}",
            )
        else:
            raise ValueError("Database configuration is incomplete. Either provide DATABASE_URL or all POSTGRES_* variables.")


    @computed_field(return_type=SAURL)
    @property
    def query_agent_database_url(self) -> SAURL:
        '''
        Docstring for query_agent_database_url
        Here if the Database is not selected this it will use the default sqlite3 database

        
        '''
        try:

            print(f"DDDDDDDDDDDDDDD {self.SQL_DB_PATH}")
            return SAURL.create(drivername="sqlite", database=self.SQL_DB_PATH)
        
        
         
        except AttributeError as ve:
            raise Exception(f"Database configuration is incomplete for sql_query_agent . Check the Database Configuration ")
        except Exception :
            raise ValueError("Database configuration is incomplete for sql_query_agent ")
    
    
    # ─────────────────────────────────────────────────────────────────────────
    # CROSS-PLATFORM PATH PROPERTIES
    # These convert string paths from .env to Path objects for cross-platform
    # compatibility (Windows & Ubuntu/Linux)
    # ─────────────────────────────────────────────────────────────────────────
    
    @computed_field(return_type=Path)
    @property
    def base_storage_dir_path(self) -> Path:
        """
        Convert BASE_STORAGE_DIR string to Path object.
        Works on both Windows and Unix-like systems (Ubuntu, Linux, etc.)
        """
        # OLD USAGE (string-based):
        #   Previously code used the raw string from settings and converted
        #   it at call sites, e.g.:
        #     Path(global_setting.BASE_STORAGE_DIR) / str(user_id)
        #   or used os.path.join(global_setting.BASE_STORAGE_DIR, ...)
        # NEW: prefer `base_storage_dir_path` (Path) so callers can use
        #   / operator and Path methods cross-platform.
        return Path(self.BASE_STORAGE_DIR)
    
    @computed_field(return_type=Path)
    @property
    def upload_base_dir_path(self) -> Path:
        """
        Convert UPLOAD_BASE_DIR string to Path object.
        Works on both Windows and Unix-like systems.
        """
        # OLD USAGE (string-based):
        #   Previously callers used:
        #     save_dir = global_setting.UPLOAD_BASE_DIR
        #     os.makedirs(save_dir, exist_ok=True)
        #     save_path = os.path.join(save_dir, filename)
        # NEW: prefer `upload_base_dir_path` (Path) and use Path.mkdir()/Path / filename
        return Path(self.UPLOAD_BASE_DIR)
    
    @computed_field(return_type=Path)
    @property
    def csv_file_dir_path(self) -> Path:
        """
        Convert CSV_FILE_PATH string to Path object.
        Works on both Windows and Unix-like systems.
        """
        # OLD USAGE (string-based):
        #   Other modules constructed the CSV path using:
        #     base_path = Path(CSV_FILE_PATH)
     
        # NOTE: CSV_FILE_PATH is defined in app/assets/.env and read via
        # app.core.config; this helper exists to centralize Path conversion.
        # Adjust as needed if you prefer to source CSV path from a different setting.
        return Path(self.SCHEMA_FILE).parent  # Parent directory for CSV files
    
    @computed_field(return_type=Path)
    @property
    def chunk_save_dir_path(self) -> Path:
        """
        Convert CHUNK_SAVE_DIR string to Path object.
        Works on both Windows and Unix-like systems.
        """
        return Path(self.CHUNK_SAVE_DIR)
    
    @computed_field(return_type=Path)
    @property
    def star_ai_chunk_save_dir_path(self) -> Path:
        """
        Convert STAR_AI_CHUNK_SAVE_DIR string to Path object.
        Works on both Windows and Unix-like systems.
        """
        return Path(self.STAR_AI_CHUNK_SAVE_DIR)
    
    @computed_field(return_type=Path)
    @property
    def vectorstore_path_obj(self) -> Path:
        """
        Convert VECTORSTORE_PATH string to Path object.
        Works on both Windows and Unix-like systems.
        """
        return Path(self.VECTORSTORE_PATH)
    
    @computed_field(return_type=Path)
    @property
    def star_ai_vectorstore_path_obj(self) -> Path:
        """
        Convert STAR_AI_VECTORSTORE_PATH string to Path object.
        Works on both Windows and Unix-like systems.
        """
        return Path(self.STAR_AI_VECTORSTORE_PATH)
    
    @computed_field(return_type=Path)
    @property
    def sql_db_path_obj(self) -> Path:
        """
        Convert SQL_DB_PATH string to Path object.
        Works on both Windows and Unix-like systems.
        """
        return Path(self.SQL_DB_PATH)
    
    @computed_field(return_type=Path)
    @property
    def schema_file_path(self) -> Path:
        """
        Convert SCHEMA_FILE string to Path object.
        Works on both Windows and Unix-like systems.
        """
        return Path(self.SCHEMA_FILE)
    
    @computed_field(return_type=Path)
    @property
    def star_ai_schema_file_path(self) -> Path:
        """
        Convert STAR_AI_SCHEMA_FILE string to Path object.
        Works on both Windows and Unix-like systems.
        """
        return Path(self.STAR_AI_SCHEMA_FILE)

    

    def save_db_config(self,cfg: LlamaDBSchema, driver: str):
        self.CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)

        db_data = {
            "driver": driver,
            "host": cfg.host,
            "port": cfg.port,
            "username": cfg.user,
            "password": cfg.password,
            "database": cfg.db,
            "db_scheme": cfg.db_scheme,
        }

        with open(self.CONFIG_PATH, "w") as f:
            json.dump(db_data, f, indent=4)

        return True

    def build_sqlalchemy_url(self, cfg: LlamaDBSchema):
        try:
            driver = self.DB_SCHEME_MAP.get(cfg.driver.lower())
            if not driver:
                raise ValueError(f"Unsupported DB driver: {cfg.driver}")

            #  Save config to file instead of editing settings object
            self.save_db_config(cfg, driver)

          

        except Exception as e:
            print(f"Error in build_sqlalchemy_url: {e}")
            raise e
        
        
    # @computed_field
    # @property
    # def postgres_url(self) -> PostgresDsn:
    #     """
    #     This is a computed field that generates a PostgresDsn URL

    #     The URL is built using the MultiHostUrl.build method, which takes the following parameters:
    #     - scheme: The scheme of the URL. In this case, it is "postgres".
    #     - username: The username for the Postgres database, retrieved from the POSTGRES_USER environment variable.
    #     - password: The password for the Postgres database, retrieved from the POSTGRES_PASSWORD environment variable.
    #     - host: The host of the Postgres database, retrieved from the POSTGRES_HOST environment variable.
    #     - path: The path of the Postgres database, retrieved from the POSTGRES_DB environment variable.

    #     Returns:
    #         PostgresDsn: The constructed PostgresDsn URL.
    #     """
    #     return MultiHostUrl.build(
    #         scheme="postgres",
    #         username=self.POSTGRES_USER,
    #         password=self.POSTGRES_PASSWORD,
    #         host=self.POSTGRES_HOST,
    #         path=self.POSTGRES_DB,
    #     )


    @computed_field
    @property
    def BASE_DIR(self) -> Path:
        """Returns the absolute path to the project root directory."""
        return Path(__file__).resolve().parent.parent



settings = Settings()
