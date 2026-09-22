from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text

class SqlQueryAgentRepository:
    def __init__(self, db_session: AsyncSession):
        self.session = db_session

    @property
    def db_drive(self):
        try:
            return self.session.bind.dialect.name
        except Exception:
            print("db drive exception here ..........")
            return "sqlite"

    async def generate_sql_query_result(self, sql):
        try:
            print(f"sql here is  {sql}")
            print(f"database drive here is {self.db_drive}")
            result = await self.session.execute(text(sql))
            rows = result.mappings().all()
            output = [dict(row) for row in rows]
            print(output)
            # Old sync code preserved as comments for reference:
            # sync_result = self.session.execute(text(sql))
            # columns = sync_result.keys()
            # output = [dict(zip(columns, row)) for row in sync_result.fetchall()]
            return output
        except SQLAlchemyError as se:
            print(se)
            raise Exception(f"Database error occured {se}")
        except Exception as e:
            print(e)
            raise Exception(f"Database error occured {e}")

    async def fetch_scalar(self, sql):
        try:
            result = await self.session.execute(text(sql))
            return result.scalar()
        except SQLAlchemyError as se:
            print(se)
            raise Exception(f"Database error occured {se}")
        except Exception as e:
            print(e)
            raise Exception(f"Database error occured {e}")