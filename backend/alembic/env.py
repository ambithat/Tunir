import sys
from pathlib import Path

# Add project root directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool, text as sa_text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Alembic Config object
config = context.config

if config.config_file_name is not None:
    try:
        fileConfig(config.config_file_name)
    except Exception:
        pass

# Import app settings to dynamically construct database URL
from app.config import settings
config.set_main_option("sqlalchemy.url", str(settings.asyncpg_url))

# Import Base and all models so Alembic can detect all tables
from app.models.base import Base
import app.models  # Registers all models with Base.metadata
from app.models.sales.leader import Leader  # Ensures Leader model is registered

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_column_size=128,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
        version_column_size=128,
    )

    # Expand alembic_version.version_num column if it was previously created as VARCHAR(32)
    connection.execute(sa_text("ALTER TABLE IF EXISTS alembic_version ALTER COLUMN version_num TYPE VARCHAR(128);"))

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
