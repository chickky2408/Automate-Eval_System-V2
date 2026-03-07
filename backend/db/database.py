"""
Database configuration and session management.

For the fastest local demo (no PostgreSQL required), this module defaults to
using a local SQLite file via ``sqlite+aiosqlite``. You can still switch back
to PostgreSQL later by setting the environment variable
``USE_SQLITE_DEMO=0``.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import os

# Toggle between SQLite demo mode and PostgreSQL
USE_SQLITE_DEMO = os.getenv("USE_SQLITE_DEMO", "1") == "1"

if USE_SQLITE_DEMO:
    # Single-file SQLite DB for quick demo runs (no external service needed)
    DATABASE_URL = "sqlite+aiosqlite:///./eval_system_demo.db"
else:
    # PostgreSQL configuration (production / real deployment)
    DB_USER = os.getenv("DB_USER", "eval_admin")
    DB_PASS = os.getenv("DB_PASS", "secure_pass")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_NAME = os.getenv("DB_NAME", "eval_system")
    DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}"

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Set True for SQL debugging
    future=True,
)

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def init_db():
    """Initialize database tables (create if not present). Runs migration to add set_id to files if needed."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Migration: add set_id to files if not present
        async with engine.begin() as conn:
            def _add_set_id(sync_conn):
                if "sqlite" in DATABASE_URL:
                    cur = sync_conn.execute(text("PRAGMA table_info(files)"))
                    cols = [row[1] for row in cur.fetchall()]
                    if "set_id" not in cols:
                        sync_conn.execute(text("ALTER TABLE files ADD COLUMN set_id VARCHAR(128)"))
                else:
                    try:
                        sync_conn.execute(text("ALTER TABLE files ADD COLUMN set_id VARCHAR(128)"))
                    except Exception:
                        pass
            await conn.run_sync(_add_set_id)

        # Migration: add missing job columns (target_board_ids, tag, client_id, config_name, pairs_data)
        async with engine.begin() as conn:
            def _add_job_columns(sync_conn):
                is_sqlite = "sqlite" in DATABASE_URL
                if is_sqlite:
                    cur = sync_conn.execute(text("PRAGMA table_info(jobs)"))
                    cols = [row[1] for row in cur.fetchall()]
                # (col_name, sqlite_type, pg_type)
                to_add = [
                    ("target_board_ids", "TEXT", "JSONB"),
                    ("tag", "VARCHAR(255)", "VARCHAR(255)"),
                    ("client_id", "VARCHAR(128)", "VARCHAR(128)"),
                    ("config_name", "VARCHAR(255)", "VARCHAR(255)"),
                    ("pairs_data", "TEXT", "JSONB"),
                ]
                for col_name, sqlite_type, pg_type in to_add:
                    if is_sqlite:
                        if col_name not in cols:
                            sync_conn.execute(text(f"ALTER TABLE jobs ADD COLUMN {col_name} {sqlite_type}"))
                    else:
                        try:
                            sync_conn.execute(text(f"ALTER TABLE jobs ADD COLUMN {col_name} {pg_type}"))
                        except Exception:
                            pass
            await conn.run_sync(_add_job_columns)

        print(f"[DB] Database ready at {DATABASE_URL}")
    except Exception as e:
        print(f"[DB] Connection failed: {e}")


async def get_session() -> AsyncSession:
    """Get a database session."""
    async with async_session() as session:
        yield session
