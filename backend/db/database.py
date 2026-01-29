"""
Database configuration and session management.
Uses SQLAlchemy with asyncpg for async PostgreSQL access.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import os

# Database configuration
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
    """Initialize database tables."""
    # In production, use Alembic for migrations.
    # checking connection only
    try:
        async with engine.begin() as conn:
            pass
        print(f"[DB] Database connection ready at {DB_HOST}/{DB_NAME}")
    except Exception as e:
        print(f"[DB] Connection failed: {e}")


async def get_session() -> AsyncSession:
    """Get a database session."""
    async with async_session() as session:
        yield session
