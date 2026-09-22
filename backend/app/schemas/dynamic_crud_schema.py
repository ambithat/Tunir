from typing import Optional, List, Dict, Any, Literal,Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, AliasChoices

from app.config import settings as global_setting


def _validate_sql_type(col_type: str) -> None:
    if not global_setting.SQL_TYPE_PATTERN.fullmatch(col_type.strip()):
        raise ValueError(f"Invalid datatype format: {col_type}")

    base_type = col_type.strip().split("(", 1)[0].upper()
    if base_type not in global_setting.ALLOWED_SQL_TYPES:
        raise ValueError(f"Datatype not allowed: {col_type}")
        
class ColumnDefinition(BaseModel):
    name: str
    col_type: str = Field(description="Example: INTEGER, VARCHAR(255), TEXT, TIMESTAMP")
    constraints: List[Literal["PRIMARY KEY", "UNIQUE"]] = Field(default_factory=list)
    nullable: bool = True
    auto_increment: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not global_setting.IDENTIFIER_PATTERN.fullmatch(value):
            raise ValueError("Invalid column name")
        return value

    @field_validator("col_type")
    @classmethod
    def validate_col_type(cls, value: str) -> str:
        _validate_sql_type(value)
        return value


class CreateTableRequest(BaseModel):
    table_name: str
    columns: List[ColumnDefinition]

    @field_validator("table_name")
    @classmethod
    def validate_table_name(cls, value: str) -> str:
        if not global_setting.IDENTIFIER_PATTERN.fullmatch(value):
            raise ValueError("Invalid table name")
        return value


# class InsertRequest(BaseModel):
#     table_name: str
#     values: Dict[str, Any]


class InsertRequest(BaseModel):
    table_name: str
    values: Union[Dict[str, Any], List[Dict[str, Any]]]

class WhereCondition(BaseModel):
    column: str
    value: Any


class UpdateActionRequest(BaseModel):
    table_name: str
    action: Literal["row_update", "rename_table", "rename_column", "add_column"] = "row_update"
    values: Dict[str, Any] = Field(default_factory=dict)
    where: List[WhereCondition] = Field(default_factory=list)
    rename_to: Optional[str] = None
    target_column: Optional[str] = None
    new_column: Optional[ColumnDefinition] = None

    @field_validator("table_name")
    @classmethod
    def validate_table_name(cls, value: str) -> str:
        if not global_setting.IDENTIFIER_PATTERN.fullmatch(value):
            raise ValueError("Invalid table name")
        return value

    @field_validator("rename_to")
    @classmethod
    def validate_rename_to(cls, value: Optional[str]) -> Optional[str]:
        if value and not global_setting.IDENTIFIER_PATTERN.fullmatch(value):
            raise ValueError("Invalid rename target")
        return value

    @field_validator("target_column")
    @classmethod
    def validate_target_column(cls, value: Optional[str]) -> Optional[str]:
        if value and not global_setting.IDENTIFIER_PATTERN.fullmatch(value):
            raise ValueError("Invalid target column")
        return value


class DeleteRequest(BaseModel):
            # print(1)
    table_name: str
    action: Literal["where", "truncate","drop"] = "where"
    where: List[WhereCondition] = Field(default_factory=list)

    @field_validator("table_name")
    @classmethod
    def validate_table_name(cls, value: str) -> str:
        if not global_setting.IDENTIFIER_PATTERN.fullmatch(value):
            raise ValueError("Invalid table name")
        return value