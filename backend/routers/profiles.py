"""Profile management API endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import async_session
from db.orm_models import ProfileORM

router = APIRouter()


class ProfileCreate(BaseModel):
    name: str
    data: Optional[Dict[str, Any]] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


@router.get("")
async def list_profiles():
    """Get all profiles."""
    async with async_session() as session:
        result = await session.execute(select(ProfileORM))
        profiles = result.scalars().all()
        return [
            {
                "id": p.id,
                "name": p.name,
                "data": p.data,
                "updated_at": p.updated_at.isoformat() + "Z",
            }
            for p in profiles
        ]


@router.post("")
async def create_profile(payload: ProfileCreate):
    """Create a new profile."""
    profile_id = str(uuid.uuid4())
    async with async_session() as session:
        orm = ProfileORM(
            id=profile_id,
            name=payload.name,
            data=payload.data,
            updated_at=datetime.utcnow(),
        )
        session.add(orm)
        await session.commit()
        await session.refresh(orm)
        
        return {
            "id": orm.id,
            "name": orm.name,
            "data": orm.data,
            "updated_at": orm.updated_at.isoformat() + "Z",
        }


@router.get("/{profile_id}")
async def get_profile(profile_id: str):
    """Get a specific profile."""
    async with async_session() as session:
        result = await session.execute(
            select(ProfileORM).where(ProfileORM.id == profile_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return {
            "id": profile.id,
            "name": profile.name,
            "data": profile.data,
            "updated_at": profile.updated_at.isoformat() + "Z",
        }


@router.get("/{profile_id}/data")
async def get_profile_data(profile_id: str):
    """Get profile data only."""
    async with async_session() as session:
        result = await session.execute(
            select(ProfileORM.data).where(ProfileORM.id == profile_id)
        )
        data = result.scalar_one_or_none()
        if data is None:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return data


@router.patch("/{profile_id}")
async def update_profile(profile_id: str, payload: ProfileUpdate):
    """Update a profile."""
    async with async_session() as session:
        values = {}
        if payload.name is not None:
            values["name"] = payload.name
        if payload.data is not None:
            values["data"] = payload.data
        values["updated_at"] = datetime.utcnow()
        
        result = await session.execute(
            update(ProfileORM).where(ProfileORM.id == profile_id).values(**values)
        )
        await session.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return {"success": True}


@router.delete("/{profile_id}")
async def delete_profile(profile_id: str):
    """Delete a profile."""
    async with async_session() as session:
        result = await session.execute(
            delete(ProfileORM).where(ProfileORM.id == profile_id)
        )
        await session.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return {"success": True}
