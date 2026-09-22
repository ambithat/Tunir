from sqlalchemy import inspect, text, func, select, Table
from sqlalchemy.ext.asyncio import AsyncSession


class DynamicCrudRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _list_tables(self) -> list:
        def sync_list(conn):
            return inspect(conn).get_table_names()
        async with self.session.bind.connect() as conn:
            return await conn.run_sync(sync_list)

    async def _list_columns(self, table_name: str) -> list:
        def sync_columns(conn):
            return inspect(conn).get_columns(table_name)
        async with self.session.bind.connect() as conn:
            return await conn.run_sync(sync_columns)

    async def _execute_raw_sql(self, sql_stmt: str):
        result = await self.session.execute(text(sql_stmt))
        # ← no commit here
        return getattr(result, 'rowcount', 0)

    async def _execute_emp_sql(self, sql_stmt: str):
        result = await self.session.execute(text(sql_stmt))
        return result.mappings().all()
    async def _execute_insert(self, table: Table, values: list):
        stmt = table.insert().returning(*table.primary_key)
        result = await self.session.execute(stmt, values)
        # ← no commit here
        if result.returns_rows:
            return [dict(row) for row in result.mappings().all()]
        return []

    async def _get_tale_info(self, table: Table, limit: int, offset: int, product_name: str = None):
        count_stmt = select(func.count()).select_from(table)
        stmt = table.select()

        if product_name:
            search_pattern = f"%{product_name}%"
            stmt = stmt.where(table.c.product_name.ilike(search_pattern))
            count_stmt = count_stmt.where(table.c.product_name.ilike(search_pattern))

        count_result = await self.session.execute(count_stmt)
        total_count = count_result.scalar() or 0

        if "procurrement_id" in table.c:
            stmt = stmt.order_by(table.c.procurrement_id.asc())
        elif "created_at" in table.c:
            stmt = stmt.order_by(table.c.created_at.asc())
        elif "id" in table.c:
            stmt = stmt.order_by(table.c.id.asc())

        stmt = stmt.limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        items = [dict(row) for row in result.mappings().all()]

        return {
            "items": items,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_next": (offset + limit) < total_count
        }

    async def _execute_update(self, stmt) -> int:
        result = await self.session.execute(stmt)
        # ← no commit here
        return result.rowcount

    async def _execute_delete(self, stmt) -> int:
        result = await self.session.execute(stmt)
        # ← no commit here
        return result.rowcount


    async def _execute_drop(self, stmt) -> tuple:
        try:
            await self.session.execute(text(stmt))
            # ← no commit here
            return True, None
        except Exception as e:
            print(e)
            return False, str(e)


################ SYNC REPO (for reference) ################

# from sqlalchemy import inspect, text, update, delete
# from sqlalchemy.orm import Session
# from sqlalchemy import Table
# from sqlalchemy import Table,func, select


# class DynamicCrudRepository:
#     def __init__(self, session: Session):
#         self.session = session

#     # Blocking Sync Methods
#     def _list_tables(self) -> list:
#         inspector = inspect(self.session.bind)
#         return inspector.get_table_names()

#     def _list_columns(self, table_name: str) -> list:
#         inspector = inspect(self.session.bind)
#         return inspector.get_columns(table_name)

#     def _execute_raw_sql(self, sql_stmt: str):
#         result = self.session.execute(text(sql_stmt))
#         self.session.commit()
#         return getattr(result, 'rowcount', 0)

#     # def _execute_insert(self, table: Table, values: dict) -> list:
#     #     result = self.session.execute(table.insert().values(**values))
#     #     self.session.commit()
#     #     return list(result.inserted_primary_key)

#     # def _execute_insert(self, table: Table, values: list):
#     #     """Handles bulk insert with RETURNING (Postgres)."""

#     #     # RETURNING primary keys
#     #     stmt = table.insert().returning(*table.primary_key)

#     #     result = self.session.execute(stmt, values)
#     #     self.session.commit()

#     #     # Convert Row objects → list of dicts
#     #     return [dict(row._mapping) for row in result.fetchall()]

#     def _execute_insert(self, table: Table, values: list):
#         stmt = table.insert().returning(*table.primary_key)

#         result = self.session.execute(stmt, values)
#         self.session.commit()

#         if result.returns_rows:
#             return [dict(row) for row in result.mappings().all()]
        
#         return []




#     # def _get_tale_info(self, table: Table, limit: int, offset: int):
#     #     # 1. Get total count for pagination logic
#     #     count_stmt = select(func.count()).select_from(table)
#     #     total_count = self.session.execute(count_stmt).scalar()

#     #     # 2. Prepare the data query
#     #     stmt = table.select()

#     #     # Apply ordering by created_at ASC as requested
#     #     if "procurrement_id" in table.c:
#     #         stmt = stmt.order_by(table.c.procurrement_id.asc())
#     #     elif "created_at" in table.c:
#     #         stmt = stmt.order_by(table.c.created_at.asc())
#     #     elif "id" in table.c:
#     #         stmt = stmt.order_by(table.c.id.asc())

#     #     # Apply pagination
#     #     stmt = stmt.limit(limit).offset(offset)
        
#     #     result = self.session.execute(stmt)
#     #     items = [dict(row) for row in result.mappings().all()]

#     #     # 3. Return structured data
#     #     return {
#     #         "items": items,
#     #         "total_count": total_count,
#     #         "limit": limit,
#     #         "offset": offset,
#     #         "has_next": (offset + limit) < total_count
#     #     }



#     def _get_tale_info(self, table: Table, limit: int, offset: int, product_name: str = None):
#         # 1. Prepare Base Statements
#         count_stmt = select(func.count()).select_from(table)
#         stmt = table.select()

#         # 2. Apply ILIKE filter if product_name is provided
#         if product_name:
#             # Create the search pattern (e.g., "Meg" becomes "%Meg%")
#             search_pattern = f"%{product_name}%"
            
#             # Apply to the data query
#             stmt = stmt.where(table.c.product_name.ilike(search_pattern))
            
#             # Apply to the count query so pagination metadata is accurate
#             count_stmt = count_stmt.where(table.c.product_name.ilike(search_pattern))

#         # 3. Execute Count (after filtering)
#         total_count = self.session.execute(count_stmt).scalar() or 0

#         # 4. Apply ordering (Priority: procurrement_id -> created_at -> id)
#         if "procurrement_id" in table.c:
#             stmt = stmt.order_by(table.c.procurrement_id.asc())
#         elif "created_at" in table.c:
#             stmt = stmt.order_by(table.c.created_at.asc())
#         elif "id" in table.c:
#             stmt = stmt.order_by(table.c.id.asc())

#         # 5. Apply pagination
#         stmt = stmt.limit(limit).offset(offset)
        
#         # 6. Fetch data
#         result = self.session.execute(stmt)
#         items = [dict(row) for row in result.mappings().all()]

#         # 7. Return structured data
#         return {
#             "items": items,
#             "total_count": total_count,
#             "limit": limit,
#             "offset": offset,
#             "has_next": (offset + limit) < total_count
#         }

#     def _execute_update(self, stmt) -> int:
#         result = self.session.execute(stmt)
#         self.session.commit()
#         return result.rowcount

#     def _execute_delete(self, stmt) -> int:
#         result = self.session.execute(stmt)
#         self.session.commit()
#         return result.rowcount
#     def _execute_drop(self,stmt) -> bool:
#         try:
#             result = self.session.execute(text(stmt))
#             self.session.commit()
#             return True,None
#         except Exception as e:
#             print(e)
#             return False,str(e)
