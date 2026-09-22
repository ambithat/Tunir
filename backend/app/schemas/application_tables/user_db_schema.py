from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, AliasChoices

from app.security.security_utils import decrypt_password


class UserDBSchema(BaseModel):
    # print(1)
    database_type: str = Field(default="PostgreSQL")
    driver: str = Field(default="asyncpg")
    db_scheme: str = Field(default="public")
    host: str = Field(default="localhost")
    port: str = Field(default=5432)
    username: str = Field(validation_alias=AliasChoices("username", "userName", "user_name"))
    password: str
    db_name: str = Field(validation_alias=AliasChoices("db_name", "dbName", "dbname", "databaseName", "database_name", "database"))
    display_name: str = Field(validation_alias=AliasChoices("display_name", "displayName"))
    is_active: bool = Field(default=True)
    # @field_validator("password", mode="after")
    # @classmethod
    # def decode_password(cls, v: str) -> str:
    #     print(2)
    #     decrypted = decrypt_password(v)
    #     print(3)
    #     return decrypted if decrypted else v
    
    # @field_validator("port", mode="before")
    # @classmethod
    # def parse_port(cls, v):
    #     print(4)
    #     if v == "" or v is None:
    #         print(5)
    #         return 5432
    #     return int(v)

# class UserDBSchema(BaseModel):
#     scheme:str
#     host:str
#     port:str
#     user_name:str
#     password:str
#     db_name:str
#     display_name:str

class UserDBUpdateSchema(BaseModel):
    database_type: Optional[str] = None
    driver: Optional[str] = None
    db_scheme: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    db_name: Optional[str] = None
    display_name: Optional[str] = None


class UserDBSchemaDTO(BaseModel):
    database_type: str
    driver: str
    db_scheme: str
    host: str
    port: int
    username: str = Field(validation_alias=AliasChoices("username", "user_name"))
    password: str
    db_name: str
    display_name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @field_validator("password", mode="before")
    @classmethod
    def mask_password(cls, v: str) -> str:
        real_pass = decrypt_password(v)
        if real_pass and len(real_pass) > 3:
            return "*****"
        return "***"
