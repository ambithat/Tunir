from uuid import uuid4

from app.config import settings as global_settings

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import AsyncAdaptedQueuePool
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
try:
    from asyncpg.exceptions import CannotConnectNowError
except ImportError:
    class CannotConnectNowError(Exception):
        pass

# ──────────────────────────────────────────────────────────────────────────────
# POOL SIZING LOGIC
# ──────────────────────────────────────────────────────────────────────────────
#
# Postgres max_connections     = 200  (set in postgresql.conf)
# Reserve for admin/pgAdmin    = 5
# Reserve for pg_listener      = 2    (1 raw conn per worker)
# Usable connections           = 193
#
# Workers                      = 2
# Per worker budget            = 193 / 2 = ~96
#
# Split per worker:
#   main_db:  pool_size=10, max_overflow=10  → max 20 per worker → 2×20 = 40
#
# Total max used = 40 + 2 (pg_listener) + 5 (admin) = 47
# Well under 200 
#
# ──────────────────────────────────────────────────────────────────────────────


# ---- 1. main db configuration (Lazy Loaded) -------------------------
_async_engine = None
_AsyncSessionFactory = None

def get_main_engine():
    global _async_engine
    if _async_engine is None:
        _async_engine = create_async_engine(
            global_settings.asyncpg_url.unicode_string(),
            poolclass=AsyncAdaptedQueuePool,
            pool_size=10,
            max_overflow=20,
            pool_timeout=30,
            pool_recycle=1800,
            pool_pre_ping=True,
            connect_args={
                "server_settings": {"jit": "off"},
                "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
            },
        )
    return _async_engine

def get_main_session_factory():
    global _AsyncSessionFactory
    if _AsyncSessionFactory is None:
        engine = get_main_engine()
        _AsyncSessionFactory = async_sessionmaker(
            engine,
            autoflush=False,
            expire_on_commit=False
        )
    return _AsyncSessionFactory


async def get_db():
    try:
        async with get_main_session_factory()() as session:
            try:
                yield session
                await session.commit()
            except SQLAlchemyError as e:
                await session.rollback()
                raise
    except (CannotConnectNowError, IntegrityError) as e:
        print(f"[DB] Connection error: {e}")
        raise Exception(f"DB Connection error: {str(e)}")
