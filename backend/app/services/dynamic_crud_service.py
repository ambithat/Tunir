import uuid
import asyncio
from datetime import datetime, date
from sqlalchemy import and_, update, delete, inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.base import get_main_session_factory
from app.repositories.dynamic_crud_repository import DynamicCrudRepository
from app.repositories.dashboard_repository import DashboardRepository
from app.repositories.tracking.notification_repository import NotificationRepository
from app.repositories.tracking.tracker_repository import TrackerRepository
from app.utils.dynamic_crud_utils import _reflect_table_async, _build_column_sql, _validate_identifier
from app.schemas.dynamic_crud_schema import (
    CreateTableRequest, InsertRequest, UpdateActionRequest, DeleteRequest
)
from app.config import settings as global_setting
from app.services.dashboard_service import DashboardService
from app.services.tracking.tracker_service import TrackerService


class DynamicCrudService:
    def __init__(self, repo: DynamicCrudRepository):
        self.repo = repo

    # ── tables / columns ─────────────────────────────────────────────────────

    async def get_all_tables(self):
        tables = await self.repo._list_tables()          # ← direct await, no to_thread
        return {"tables": tables}

    async def get_table_columns(self, table_name: str, action: str | None):
        _validate_identifier(table_name, "table name")
        columns = await self.repo._list_columns(table_name)  # ← direct await

        # async inspect for pk
        async with self.repo.session.bind.connect() as conn:
            def get_pk(c):
                return inspect(c).get_pk_constraint(table_name)["constrained_columns"]
            pk_columns = await conn.run_sync(get_pk)

        def should_exclude_column(c):
            default = c.get("default")
            default_str = str(default).lower() if default else ""
            autoincrement = c.get("autoincrement", False)
            name = c.get("name")
            if action == "insert":
                if name == 'created_at' :
                    return True
                if "nextval" in default_str or autoincrement or name in pk_columns:
                    return True
            if "current_timestamp" in default_str:
                return True
            return False

        def clean_default(default):
            if not default:
                return None
            default_str = str(default).lower()
            if "nextval" in default_str or "current_timestamp" in default_str:
                return None
            return default

        return {
            "table": table_name,
            "columns": [
                {
                    "name": c["name"],
                    "type": str(c["type"]),
                    "nullable": c.get("nullable", True),
                    "default": clean_default(c.get("default")),
                }
                for c in columns
                if not should_exclude_column(c)
            ],
        }

    # ── create table ──────────────────────────────────────────────────────────

    async def create_table(self, payload: CreateTableRequest):
        dialect_name = await self._get_dialect_name()
        col_defs = []
        seen_names = set()
        auto_inc_used, primary_keys = False, 0

        for col in payload.columns:
            if col.name in seen_names:
                raise ValueError(f"Duplicate column name: {col.name}")
            seen_names.add(col.name)

            if col.auto_increment:
                if auto_inc_used:
                    raise ValueError("Only one auto increment column is allowed")
                auto_inc_used = True

            col_sql, has_pk = _build_column_sql(col, dialect_name, allow_auto_increment=True)
            if has_pk:
                primary_keys += 1
            col_defs.append(col_sql)

        if primary_keys > 1:
            raise ValueError("Duplicate PRIMARY KEY definition is not allowed")

        create_stmt = f'CREATE TABLE "{payload.table_name}" ({", ".join(col_defs)})'

        try:
            await self.repo._execute_raw_sql(create_stmt)    # ← direct await
            return {"message": f"Table {payload.table_name} created successfully"}
        except Exception as e:
            await self.repo.session.rollback()
            raise ValueError(f"Create table failed: {str(e)}")

    # ── helpers ───────────────────────────────────────────────────────────────

    async def _get_dialect_name(self) -> str:
        async with self.repo.session.bind.connect() as conn:
            return conn.dialect.name

    def parse_date(self, value):
        if isinstance(value, date):
            return value
        formats = ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"]
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Invalid date format: {value}")

    async def dashboard_broadcast(
        self,
        table_name: str,
        dashboard_service: DashboardService,
        tracker_service: TrackerService | None = None
    ):
        async def _background_broadcast():
            try:
                engine = self.repo.session.bind
                if engine is None:
                    raise RuntimeError("Unable to derive engine for dashboard broadcast")

                # Use a fresh async session for the user's DB in the background task.
                # Previous implementation reused the injected request-scoped service/session:
                # asyncio.create_task(
                #     dashboard_service.broadcast_dashboard_update(tracker_service=tracker_service)
                # )
                # That could fail once the original request scope closes.
                async_session_local = async_sessionmaker(
                    bind=engine,
                    autoflush=False,
                    expire_on_commit=True,
                    class_=AsyncSession,
                )

                async with async_session_local() as user_db_session, get_main_session_factory()() as main_db_session:
                    dashboard_repo = DashboardRepository(user_db_session)
                    notification_repo = NotificationRepository(main_db_session)
                    tracker_repo = TrackerRepository(main_db_session)

                    dashboard_service_bg = DashboardService(
                        dashboard_repository=dashboard_repo,
                        notification_repository=notification_repo,
                    )
                    tracker_service_bg = TrackerService(tracker_repository=tracker_repo)

                    await dashboard_service_bg.broadcast_dashboard_update(
                        tracker_service=tracker_service_bg
                    )
            except Exception as inner_exc:
                print(f"[Internal] Background dashboard broadcast failed: {inner_exc}")

        try:
            asyncio.create_task(_background_broadcast())
            print(f"[Internal] Broadcast triggered for {table_name}")
        except Exception as e:
            print(f"Failed to broadcast dashboard update: {e}")

    # ── get table info ────────────────────────────────────────────────────────

    async def get_table_info(self, table_name: str, limit: int, offset: int, product_name: str):
        try:
            table = await _reflect_table_async(self.repo.session, table_name)
            table_data = await self.repo._get_tale_info(table, limit, offset, product_name)  # ← direct await
            return table_data
        except Exception as e:
            raise ValueError(f"get table info failed: {str(e)}")

    # ___________________ employee info ----------------------------------

    async def get_employee_info(self):
        try:
            data = await self.repo._execute_emp_sql(    # ← direct await
                    f'SELECT * FROM  employees'
                )
            print(data)
            return data
        except Exception as e:
            raise ValueError(f"get table employee info failed: {str(e)}")
    
    async def get_vendor_info(self):
        try:
            data = await self.repo._execute_emp_sql(    # ← direct await
                    f'SELECT vendor_name FROM  procurement_table group by vendor_name'
                )
            print(data)
            return data
        except Exception as e:
            raise ValueError(f"get table employee info failed: {str(e)}")
    async def get_parts_info(self):
        try:
            data = await self.repo._execute_emp_sql(    # ← direct await
                    f'SELECT part_number,part_name FROM  procurement_table group by (part_name,part_number)'
                )
            print(data)
            return data
        except Exception as e:
            raise ValueError(f"get table employee info failed: {str(e)}")
    # ── insert ────────────────────────────────────────────────────────────────

    async def insert_record(
        self,
        payload: InsertRequest,
        dashboard_service: DashboardService | None = None,
        tracker_service: TrackerService | None = None
    ):
        table = await _reflect_table_async(self.repo.session, payload.table_name)

        values_list = payload.values
        if isinstance(values_list, dict):
            values_list = [values_list]

        processed_rows = []
        for row in values_list:
            invalid_cols = [k for k in row.keys() if k not in table.c]
            if invalid_cols:
                raise ValueError(f"Invalid columns: {invalid_cols}")

            new_row = {}
            for col_name, value in row.items():
                col = table.c[col_name]
                col_type = str(col.type).lower()

                if value in ("", None):
                    new_row[col_name] = None
                    continue

                try:
                    if "uuid" in col_type:
                        new_row[col_name] = uuid.UUID(str(value))
                    elif "date" in col_type:
                        new_row[col_name] = self.parse_date(value)
                    else:
                        new_row[col_name] = value
                except Exception as e:
                    raise ValueError(
                        f"Invalid value '{value}' for column '{col_name}' "
                        f"of type '{col_type}': {str(e)}"
                    )
            processed_rows.append(new_row)

        try:
            p_keys = await self.repo._execute_insert(table, processed_rows)  # ← direct await

            if payload.table_name == "lead_register":
                await self._sync_lead_register_contacts(processed_rows)

            if payload.table_name in ("lead_register", "product_register"):
                await self.repo.notify_sales_lead_update("lead_updated")

            if payload.table_name == "procurement_table" and dashboard_service:
                await self.dashboard_broadcast(payload.table_name, dashboard_service, tracker_service)
            return {
                "message": "Records inserted",
                "inserted_primary_keys": p_keys,
            }
        except Exception as e:
            await self.repo.session.rollback()
            raise ValueError(f"Insert failed: {str(e)}")




    async def _sync_lead_register_contacts(self, lead_rows: list[dict]) -> None:
        """Create matching contacts for inserted lead register rows."""
        contact_table = await _reflect_table_async(self.repo.session, "contacts")
        contacts_to_insert = []

        for row in lead_rows:
            company = row.get("company")
            contact_name = row.get("contact_name") or company or "Unknown Contact"
            phone_no_1 = row.get("phone_no") or ""
            email = row.get("email") or ""

            if not company:
                continue

            contacts_to_insert.append({
                "company": company,
                "contact_name": contact_name,
                "designation": row.get("designation"),
                "phone_no_1": phone_no_1,
                "phone_no_2": None,
                "email": email,
                "country": row.get("country"),
                "region": None,
                "is_active": True,
            })

        if contacts_to_insert:
            await self.repo._execute_insert(contact_table, contacts_to_insert)

    # ── update ────────────────────────────────────────────────────────────────

    async def update_record(
        self,
        payload: UpdateActionRequest,
        dashboard_service: DashboardService | None = None,
        tracker_service: TrackerService | None = None
    ):
        table = await _reflect_table_async(self.repo.session, payload.table_name)
        dialect_name = await self._get_dialect_name()

        try:
            if payload.action == "row_update":
                if not payload.where or not payload.values:
                    raise ValueError("WHERE and VALUES required for row_update")

                invalid_cols = [k for k in payload.values.keys() if k not in table.c]
                if invalid_cols:
                    raise ValueError(f"Invalid update columns: {invalid_cols}")

                for cond in payload.where:
                    _validate_identifier(cond.column, "where column")
                    if cond.column not in table.c:
                        raise ValueError(f"Invalid where column: {cond.column}")

                filters = [table.c[c.column] == c.value for c in payload.where]
                stmt = update(table).where(and_(*filters)).values(**payload.values)
                rows_affected = await self.repo._execute_update(stmt)    # ← direct await

                if payload.table_name in ("lead_register", "product_register"):
                    await self.repo.notify_sales_lead_update("lead_updated")

                if payload.table_name == "procurement_table" and dashboard_service:
                    await self.dashboard_broadcast(payload.table_name, dashboard_service, tracker_service)
                return {"message": "Record(s) updated", "rows_affected": rows_affected}

            if payload.action == "rename_table":
                if not payload.rename_to:
                    raise ValueError("rename_to is required")
                _validate_identifier(payload.rename_to, "new table name")
                await self.repo._execute_raw_sql(    # ← direct await
                    f'ALTER TABLE "{payload.table_name}" RENAME TO "{payload.rename_to}"'
                )
                return {"message": f"Table renamed to {payload.rename_to}"}

            if payload.action == "rename_column":
                if not payload.target_column or not payload.rename_to:
                    raise ValueError("target_column and rename_to required")
                if payload.target_column not in table.c:
                    raise ValueError(f"Column not found: {payload.target_column}")
                _validate_identifier(payload.target_column, "target column")
                _validate_identifier(payload.rename_to, "new column name")
                await self.repo._execute_raw_sql(    # ← direct await
                    f'ALTER TABLE "{payload.table_name}" RENAME COLUMN "{payload.target_column}" TO "{payload.rename_to}"'
                )
                return {"message": f"Column renamed to {payload.rename_to}"}

            if payload.action == "add_column":
                if not payload.new_column:
                    raise ValueError("new_column required")
                if payload.new_column.name in table.c:
                    raise ValueError(f"Column already exists: {payload.new_column.name}")
                new_col_sql, has_pk = _build_column_sql(
                    payload.new_column, dialect_name, allow_auto_increment=False
                )
                if has_pk:
                    raise ValueError("PRIMARY KEY cannot be added via add_column")
                await self.repo._execute_raw_sql(    # ← direct await
                    f'ALTER TABLE "{payload.table_name}" ADD COLUMN {new_col_sql}'
                )
                return {"message": f"Column added: {payload.new_column.name}"}

            raise ValueError(f"Unsupported action: {payload.action}")

        except Exception as e:
            await self.repo.session.rollback()
            raise ValueError(f"Update failed: {str(e)}")

    # ── delete ────────────────────────────────────────────────────────────────

    async def delete_record(
        self,
        payload: DeleteRequest,
        dashboard_service: DashboardService | None = None,
        tracker_service: TrackerService | None = None
    ):
        table = await _reflect_table_async(self.repo.session, payload.table_name)

        try:
            if payload.action == "truncate":
                rows_affected = await self.repo._execute_raw_sql(   # ← direct await
                    f'DELETE FROM "{payload.table_name}"'
                )
                if payload.table_name in ("lead_register", "product_register"):
                    await self.repo.notify_sales_lead_update("lead_updated")

                if payload.table_name == "procurement_table" and dashboard_service:
                    await self.dashboard_broadcast(payload.table_name, dashboard_service, tracker_service)
                return {"message": f"Table {payload.table_name} truncated", "rows_affected": rows_affected}

            if payload.action == "drop":
                status, e = await self.repo._execute_drop(          # ← direct await
                    f'DROP TABLE "{payload.table_name}"'
                )
                if not status:
                    raise ValueError(e)
                return {"message": f"Table {payload.table_name} dropped"}

            if not payload.where:
                raise ValueError("At least one where condition is required")

            for cond in payload.where:
                _validate_identifier(cond.column, "where column")
                if cond.column not in table.c:
                    raise ValueError(f"Invalid where column: {cond.column}")

            filters = [table.c[c.column] == c.value for c in payload.where]
            stmt = delete(table).where(and_(*filters))
            rows_affected = await self.repo._execute_delete(stmt)   # ← direct await

            if payload.table_name in ("lead_register", "product_register"):
                await self.repo.notify_sales_lead_update("lead_updated")

            return {"message": "Record(s) deleted", "rows_affected": rows_affected}




        except Exception as e:
            await self.repo.session.rollback()
            raise ValueError(f"Delete failed: {str(e)}")












################################## SYNC CODE (commented) ##################################


# import uuid
# import os
# import shutil
# from app.services.tracker_service import TrackerService
# from fastapi import UploadFile

# from datetime import datetime, date
# import asyncio
# from sqlalchemy import and_, update, delete,inspect
# from app.repositories.dynamic_crud_repository import DynamicCrudRepository
# from app.utils.dynamic_crud_utils import _reflect_table_async, _build_column_sql, _validate_identifier
# from app.schemas.dynamic_crud_schema import (
#     CreateTableRequest, InsertRequest, UpdateActionRequest, DeleteRequest
# )
# from app.config import settings as global_setting

# from app.services.dashboard_service import DashboardService

# class DynamicCrudService:
#     def __init__(self, repo: DynamicCrudRepository):
#         self.repo = repo

#     async def get_all_tables(self):
#         """Returns a list of all tables in the database."""
#         tables = await asyncio.to_thread(self.repo._list_tables)
#         return {"tables": tables}

#     # async def get_table_columns(self, table_name: str):
#     #     """Returns metadata for all columns in a specific table."""
#     #     _validate_identifier(table_name, "table name")
#     #     columns = await asyncio.to_thread(self.repo._list_columns, table_name)
#     #     return {
#     #         "table": table_name,
#     #         "columns": [
#     #             {
#     #                 "name": c["name"],
#     #                 "type": str(c["type"]),
#     #                 "nullable": c.get("nullable", True),
#     #                 "default": c.get("default")
#     #             }
#     #             for c in columns
#     #         ],
#     #     }

    
#     async def get_table_columns(self, table_name: str,action: str|None):
#         """Returns metadata for all columns in a specific table."""
#         _validate_identifier(table_name, "table name")
#         columns = await asyncio.to_thread(self.repo._list_columns, table_name)

#         # def should_exclude_column(c):
#         #     default = c.get("default")

#         #     if not default:
#         #         return False

#         #     default_str = str(default).lower()

#         #     # Auto-increment columns
#         #     if action ==  'insert':
#         #         if "nextval" in default_str:
#         #             return True

#         #     # Auto timestamp columns
#         #     if "current_timestamp" in default_str:
#         #         return True

#         #     return False
#         inspector = inspect(self.repo.session.bind)
#         pk_columns = inspector.get_pk_constraint(table_name)["constrained_columns"]
#         def should_exclude_column(c):
#             default = c.get("default")
#             default_str = str(default).lower() if default else ""
#             autoincrement = c.get("autoincrement", False)
#             name = c.get("name")

#             if action == "insert":
#                 if (
#                     "nextval" in default_str or
#                     autoincrement or
#                     name in pk_columns
#                 ):
#                     return True

#             if "current_timestamp" in default_str:
#                 return True

#             return False
#         def clean_default(default):
#             if not default:
#                 return None

#             default_str = str(default).lower()

#             # Remove unwanted defaults
#             if "nextval" in default_str or "current_timestamp" in default_str:
#                 return None

#             return default

#         return {
#             "table": table_name,
#             "columns": [
#                 {
#                     "name": c["name"],
#                     "type": str(c["type"]),
#                     "nullable": c.get("nullable", True),
#                     "default": clean_default(c.get("default")),
#                 }
#                 for c in columns
#                 if not should_exclude_column(c)   #  filter applied here
#             ],
#         }

#     async def create_table(self, payload: CreateTableRequest):
#         """Creates a new table with the specified schema."""
#         dialect_name = self.repo.session.bind.dialect.name
#         col_defs = []
#         seen_names = set()
#         auto_inc_used, primary_keys = False, 0

#         for col in payload.columns:
#             if col.name in seen_names:
#                 raise ValueError(f"Duplicate column name: {col.name}")
#             seen_names.add(col.name)

#             if col.auto_increment:
#                 if auto_inc_used:
#                     raise ValueError("Only one auto increment column is allowed")
#                 auto_inc_used = True

#             col_sql, has_pk = _build_column_sql(col, dialect_name, allow_auto_increment=True)
#             if has_pk:
#                 primary_keys += 1
#             col_defs.append(col_sql)

#         if primary_keys > 1:
#             raise ValueError("Duplicate PRIMARY KEY definition is not allowed")

#         create_stmt = f'CREATE TABLE "{payload.table_name}" ({", ".join(col_defs)})'
        
#         try:
#             await asyncio.to_thread(self.repo._execute_raw_sql, create_stmt)
#             return {"message": f"Table {payload.table_name} created successfully"}
#         except Exception as e:
#             self.repo.session.rollback()
#             raise ValueError(f"Create table failed: {str(e)}")

#     # async def insert_record(self, payload: InsertRequest):
#     #     """Inserts a new record into the specified table."""
#     #     table = await asyncio.to_thread(_reflect_table, self.repo.session, payload.table_name)
#     #     invalid_cols = [k for k in payload.values.keys() if k not in table.c]
        
#     #     if invalid_cols:
#     #         raise ValueError(f"Invalid columns: {invalid_cols}")
        
       
#     #     try:
            
#     #         p_keys = await asyncio.to_thread(self.repo._execute_insert, table, payload.values)
#     #         return {"message": "Record inserted", "inserted_primary_key": p_keys}
#     #     except Exception as e:
#     #         self.repo.session.rollback()
#     #         raise ValueError(f"Insert failed: {str(e)}")


#     def parse_date(self,value):
#         from datetime import datetime

#         if isinstance(value, date):
#             return value

#         formats = [
#             "%Y-%m-%d",  # 2026-05-22
#             "%d-%m-%Y",  # 22-05-2026
#             "%d/%m/%Y",  # 22/05/2026
#             "%Y/%m/%d",  # 2026/05/22
#         ]

#         for fmt in formats:
#             try:
#                 data= datetime.strptime(value, fmt).date()
#                 print("returned data ",data)
#                 return data
#             except ValueError:
#                 continue

#         raise ValueError(f"Invalid date format: {value}")


#     # async def insert_record(self, payload: InsertRequest):
#     #     """Inserts a new record into the specified table."""
#     #     table = await asyncio.to_thread(_reflect_table, self.repo.session, payload.table_name)

#     #     invalid_cols = [k for k in payload.values.keys() if k not in table.c]
#     #     if invalid_cols:
#     #         raise ValueError(f"Invalid columns: {invalid_cols}")

#     #     #  Dynamic type conversion
#     #     for col_name, value in payload.values.items():
#     #         if value is None:
#     #             continue

#     #         col = table.c[col_name]
#     #         col_type = str(col.type).lower()
#     #         print(f"colname :: {col_name} and type is {col_type}  and value is {value}")

#     #         try:
#     #             # UUID conversion
#     #             if "uuid" in col_type:
#     #                 payload.values[col_name] = uuid.UUID(str(value))

#     #             # DATE conversion
#     #             elif "date" in col_type:
#     #                 payload.values[col_name] = self.parse_date(value)
#     #                 # print(payload.values)


#     #         except Exception:
#     #             raise ValueError(f"Invalid value for column '{col_name}' of type '{col_type}'")

#     #     try:
#     #         p_keys = await asyncio.to_thread(
#     #             self.repo._execute_insert, table, payload.values
#     #         )
#     #         return {"message": "Record inserted", "inserted_primary_key": p_keys}

#     #     except Exception as e:
#     #         self.repo.session.rollback()
#     #         raise ValueError(f"Insert failed: {str(e)}")

#     async def dashboard_broadcast(self,table_name:str,dashboard_service:DashboardService,tracker_service:TrackerService | None = None):
#         try:
#             # Create a temporary instance just for fetching tracker counts
#                 # We use create_task so the API returns fast without waiting for the SSE broadcast to finish
#             asyncio.create_task(dashboard_service.broadcast_dashboard_update(tracker_service=tracker_service))
#             print(f"[Internal] Broadcast triggered for {table_name}")
#         except Exception as e:
#             print(f"Failed to broadcast dashboard update: {e}")
#     async def get_table_info(self,table_name:str,limit:int,offset:int,product_name:str):
#         try:
#             # table = await asyncio.to_thread(_reflect_table, self.repo.session,table_name)
#             table = await _reflect_table_async(self.repo.session, payload.table_name)
#             table_data = await asyncio.to_thread(self.repo._get_tale_info,table,limit,offset,product_name)
#             return table_data
#         except Exception as e:
#             raise ValueError(f"get table info failed: {str(e)}")

#     async def insert_record(self, payload: InsertRequest,dashboard_service:DashboardService | None = None,tracker_service:TrackerService | None = None):
#         """Supports single + bulk insert with type conversion."""
#         print(111111111111111111111111111)
#         # sync connection
#         # table = await asyncio.to_thread(
#         #     _reflect_table, self.repo.session, payload.table_name
#         # )  

#         table = await _reflect_table_async(self.repo.session, payload.table_name)
#         print(2)
#         values_list = payload.values

#         #  Normalize → always list
#         if isinstance(values_list, dict):
#             values_list = [values_list]

#         processed_rows = []

#         for row in values_list:
#             invalid_cols = [k for k in row.keys() if k not in table.c]
#             if invalid_cols:
#                 raise ValueError(f"Invalid columns: {invalid_cols}")

#             new_row = {}

#             for col_name, value in row.items():
#                 col = table.c[col_name]
#                 col_type = str(col.type).lower()

#                 # Handle empty values
#                 if value in ("", None):
#                     new_row[col_name] = None
#                     continue

#                 try:
#                     # UUID conversion
#                     if "uuid" in col_type:
#                         new_row[col_name] = uuid.UUID(str(value))

#                     # DATE conversion
#                     elif "date" in col_type:
#                         new_row[col_name] = self.parse_date(value)

#                     else:
#                         new_row[col_name] = value

#                 except Exception as e:
#                     raise ValueError(
#                         f"Invalid value '{value}' for column '{col_name}' "
#                         f"of type '{col_type}': {str(e)}"
#                     )

#             processed_rows.append(new_row)

#         try:
#             p_keys = await asyncio.to_thread(
#                 self.repo._execute_insert, table, processed_rows
#             )
#             if payload.table_name == "procurement_table" and dashboard_service:
#                 await self.dashboard_broadcast(payload.table_name, dashboard_service, tracker_service)
#             return {
#                 "message": "Records inserted",
#                 "inserted_primary_keys": p_keys,
#             }

#         except Exception as e:
#             self.repo.session.rollback()
#             raise ValueError(f"Insert failed: {str(e)}")

#     # async def insert_record(self, payload: InsertRequest, file_map: dict[str, UploadFile] = {}):
#     #     """
#     #     Handles single + bulk insert with optional image uploads.
#     #     - Images are saved to /app/assets/images/{user_id}/{filename}
#     #     - Only the path is stored in DB
#     #     - If DB insert fails, saved files are deleted (rollback)
#     #     """
#     #     table = await asyncio.to_thread(
#     #         _reflect_table, self.repo.session, payload.table_name
#     #     )

#     #     values_list = payload.values
#     #     if isinstance(values_list, dict):
#     #         values_list = [values_list]

#     #     processed_rows = []
#     #     saved_files = []  # track saved files for rollback if DB insert fails

#     #     for row in values_list:
#     #         # Validate columns
#     #         invalid_cols = [k for k in row.keys() if k not in table.c]
#     #         if invalid_cols:
#     #             raise ValueError(f"Invalid columns: {invalid_cols}")

#     #         new_row = {}
#     #         for col_name, value in row.items():
#     #             col = table.c[col_name]
#     #             col_type = str(col.type).lower()

#     #             # Handle empty values
#     #             if value in ("", None):
#     #                 new_row[col_name] = None
#     #                 continue

#     #             # --- IMAGE HANDLING ---
#     #             if (
#     #                 isinstance(value, str)
#     #                 and os.path.splitext(value)[-1].lower() in global_setting.IMAGE_EXTENSIONS
#     #             ):
#     #                 if value not in file_map:
#     #                     raise ValueError(
#     #                         f"File '{value}' referenced in column '{col_name}' but not uploaded"
#     #                     )

#     #                 # user_id is required to create the folder
#     #                 user_id = row.get("user_id")
#     #                 if not user_id:
#     #                     raise ValueError(
#     #                         f"'user_id' is required in the row when uploading an image"
#     #                     )

#     #                 upload_file = file_map[value]
#     #                 # Convert UPLOAD_BASE_DIR string to Path object for cross-platform compatibility
#     #                 save_dir = global_setting.upload_base_dir_path
#     #                 save_dir.mkdir(parents=True, exist_ok=True)
#     #                 # Use Path / operator instead of os.path.join() for cross-platform safety
#     #                 save_path = save_dir / f"{user_id}_{value}"

#     #                 # OLD CODE (commented):
#     #                 # save_dir = global_setting.UPLOAD_BASE_DIR
#     #                 # os.makedirs(save_dir, exist_ok=True)
#     #                 # save_path = os.path.join(save_dir, f"{user_id}_{value}")  # /app/assets/images/123_photo.jpg

#     #                 try:
#     #                     with open(save_path, "wb") as f:
#     #                         shutil.copyfileobj(upload_file.file, f)
#     #                     saved_files.append(str(save_path))  # Convert Path to string for storage
#     #                 except Exception as e:
#     #                     # Clean up any files saved so far before raising
#     #                     for file_path in saved_files:
#     #                         path_obj = Path(file_path)
#     #                         if path_obj.exists():
#     #                             path_obj.unlink()
#     #                     # OLD CODE (commented):
#     #                     # for path in saved_files:
#     #                     #     if os.path.exists(path):
#     #                     #         os.remove(path)
#     #                     raise ValueError(f"Failed to save file '{value}': {str(e)}")

#     #                 new_row[col_name] = save_path  # store path in DB
#     #                 continue

#     #             # --- EXISTING TYPE CONVERSIONS ---
#     #             try:
#     #                 if "uuid" in col_type:
#     #                     new_row[col_name] = uuid.UUID(str(value))
#     #                 elif "date" in col_type:
#     #                     new_row[col_name] = self.parse_date(value)
#     #                 else:
#     #                     new_row[col_name] = value
#     #             except Exception as e:
#     #                 raise ValueError(
#     #                     f"Invalid value '{value}' for column '{col_name}' "
#     #                     f"of type '{col_type}': {str(e)}"
#     #                 )

#     #         processed_rows.append(new_row)

#     #     # --- DB INSERT ---
#     #     try:
#     #         p_keys = await asyncio.to_thread(
#     #             self.repo._execute_insert, table, processed_rows
#     #         )
#     #         return {
#     #             "message": "Records inserted",
#     #             "inserted_primary_keys": p_keys,
#     #         }
#     #     except Exception as e:
#     #         self.repo.session.rollback()
#     #         # Rollback: delete all saved files since DB insert failed
#     #         for path in saved_files:
#     #             if os.path.exists(path):
#     #                 os.remove(path)
#     #         raise ValueError(f"Insert failed: {str(e)}")



#     async def update_record(self, payload: UpdateActionRequest,dashboard_service:DashboardService | None = None,tracker_service:TrackerService | None = None):
#         """Handles row updates, table/column renames, and adding columns."""
#         # table = await asyncio.to_thread(_reflect_table, self.repo.session, payload.table_name)
#         table = await _reflect_table_async(self.repo.session, payload.table_name)
#         dialect_name = self.repo.session.bind.dialect.name

#         try:
#             if payload.action == "row_update":
#                 if not payload.where or not payload.values:
#                     raise ValueError("WHERE conditions and VALUES are required for row update")
                
#                 invalid_update_cols = [k for k in payload.values.keys() if k not in table.c]
#                 if invalid_update_cols:
#                     raise ValueError(f"Invalid update columns: {invalid_update_cols}")
                
#                 for cond in payload.where:
#                     _validate_identifier(cond.column, "where column")
#                     if cond.column not in table.c:
#                         raise ValueError(f"Invalid where column: {cond.column}")

#                 filters = [table.c[c.column] == c.value for c in payload.where]
#                 stmt = update(table).where(and_(*filters)).values(**payload.values)
                
#                 rows_affected = await asyncio.to_thread(self.repo._execute_update, stmt)

#                 if payload.table_name == "procurement_table" and dashboard_service:
#                     await self.dashboard_broadcast(payload.table_name, dashboard_service, tracker_service   )
#                 return {"message": "Record(s) updated", "rows_affected": rows_affected}

#             if payload.action == "rename_table":

#                 if not payload.rename_to:
#                     raise ValueError("rename_to is required for rename_table")
#                 _validate_identifier(payload.rename_to, "new table name")
#                 await asyncio.to_thread(self.repo._execute_raw_sql, f'ALTER TABLE "{payload.table_name}" RENAME TO "{payload.rename_to}"')
             
#                 return {"message": f"Table renamed from {payload.table_name} to {payload.rename_to}"}

#             if payload.action == "rename_column":
#                 if not payload.target_column or not payload.rename_to:
#                     raise ValueError("target_column and rename_to are required for rename_column")
#                 if payload.target_column not in table.c:
#                     raise ValueError(f"Column not found: {payload.target_column}")
#                 _validate_identifier(payload.target_column, "target column")
#                 _validate_identifier(payload.rename_to, "new column name")
#                 await asyncio.to_thread(self.repo._execute_raw_sql, f'ALTER TABLE "{payload.table_name}" RENAME COLUMN "{payload.target_column}" TO "{payload.rename_to}"')
                
#                 return {"message": f"Column renamed from {payload.target_column} to {payload.rename_to}"}

#             if payload.action == "add_column":
#                 if not payload.new_column:
#                     raise ValueError("new_column is required for add_column")
#                 if payload.new_column.name in table.c:
#                     raise ValueError(f"Column already exists: {payload.new_column.name}")
#                 new_col_sql, has_primary_key = _build_column_sql(payload.new_column, dialect_name, allow_auto_increment=False)
#                 if has_primary_key:
#                     raise ValueError("PRIMARY KEY cannot be added via add_column")
#                 await asyncio.to_thread(self.repo._execute_raw_sql, f'ALTER TABLE "{payload.table_name}" ADD COLUMN {new_col_sql}')
#                 return {"message": f"Column added: {payload.new_column.name}"}

#             raise ValueError(f"Unsupported update action: {payload.action}")
#         except Exception as e:
#             self.repo.session.rollback()
#             raise ValueError(f"Update failed: {str(e)}")

#     async def delete_record(self, payload: DeleteRequest, dashboard_service: DashboardService | None = None,tracker_service:TrackerService | None = None):
#         """Deletes rows or truncates the table."""
#         # table = await asyncio.to_thread(_reflect_table, self.repo.session, payload.table_name)
#         table = await _reflect_table_async(self.repo.session, payload.table_name)
#         try:
#             if payload.action == "truncate":
#                 rows_affected = await asyncio.to_thread(self.repo._execute_raw_sql, f'DELETE FROM "{payload.table_name}"')
#                 if payload.table_name == "procurement_table" and dashboard_service:
#                     await self.dashboard_broadcast(payload.table_name, dashboard_service, tracker_service)
#                 return {"message": f"Table {payload.table_name} truncated", "rows_affected": rows_affected}
#             if payload.action == "drop":
#                 status,e = await asyncio.to_thread(self.repo._execute_drop,f'DROP TABLE "{payload.table_name}"')
#                 if not status:
#                     raise e
#                 else :
                    
#                     return {"message":f"Table {payload.table_name} dropped"} 

#             if not payload.where:
#                 raise ValueError("At least one where condition is required")

#             for cond in payload.where:
#                 _validate_identifier(cond.column, "where column")
#                 if cond.column not in table.c:
#                     raise ValueError(f"Invalid where column: {cond.column}")

#             filters = [table.c[c.column] == c.value for c in payload.where]
#             stmt = delete(table).where(and_(*filters))
            
#             rows_affected = await asyncio.to_thread(self.repo._execute_delete, stmt)
#             return {"message": "Record(s) deleted", "rows_affected": rows_affected}
#         except Exception as e:
#             self.repo.session.rollback()
#             raise ValueError(f"Delete failed: {str(e)}")
