"""
Database configuration and session management.
Uses SQLAlchemy with aiosqlite for async SQLite access.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, Enum
from datetime import datetime
import os

# Database file location
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "eval_system.db")
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

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
    async with engine.begin():
        pass
    print(f"[DB] Database connection ready at {DB_PATH}")


async def get_session() -> AsyncSession:
    """Get a database session."""
    async with async_session() as session:
        yield session
