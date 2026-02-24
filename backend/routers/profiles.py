"""
Profiles API (Option B1: no login).
Profile id is the share key; anyone with the id can read. Write overwrites profile data.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Any, Optional
from sqlalchemy import select
from db.database import async_session
from db.orm_models import ProfileORM

router = APIRouter()


class CreateProfileBody(BaseModel):
    name: str


class ProfileDataBody(BaseModel):
    savedTestCases: Optional[List[Any]] = None
    savedTestCaseSets: Optional[List[Any]] = None


class UpdateProfileNameBody(BaseModel):
    name: str


@router.post("", status_code=201)
async def create_profile(body: CreateProfileBody):
    """Create a new profile. Returns { id, name }. No auth; id is the share key."""
    name = (body.name or "").strip() or "Unnamed"
    async with async_session() as session:
        profile = ProfileORM(name=name, data={"savedTestCases": [], "savedTestCaseSets": []})
        session.add(profile)
        await session.commit()
        await session.refresh(profile)
        return {"id": profile.id, "name": profile.name}


@router.get("/{profile_id}")
async def get_profile(profile_id: str):
    """Get profile metadata (id, name, updated_at). For display when viewing shared profile."""
    if not profile_id.strip():
        raise HTTPException(status_code=400, detail="profile_id required")
    async with async_session() as session:
        result = await session.execute(select(ProfileORM).where(ProfileORM.id == profile_id))
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        return {
            "id": profile.id,
            "name": profile.name,
            "updatedAt": profile.updated_at.isoformat() + "Z" if profile.updated_at else None,
        }


@router.get("/{profile_id}/data")
async def get_profile_data(profile_id: str):
    """Get profile data (savedTestCases, savedTestCaseSets). Read-only; for viewing shared profile."""
    if not profile_id.strip():
        raise HTTPException(status_code=400, detail="profile_id required")
    async with async_session() as session:
        result = await session.execute(select(ProfileORM).where(ProfileORM.id == profile_id))
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        data = profile.data or {}
        return {
            "savedTestCases": data.get("savedTestCases", []),
            "savedTestCaseSets": data.get("savedTestCaseSets", []),
        }


@router.put("/{profile_id}/data")
async def put_profile_data(profile_id: str, body: ProfileDataBody):
    """Overwrite profile data. Used when saving from "my" profile on this device."""
    if not profile_id.strip():
        raise HTTPException(status_code=400, detail="profile_id required")
    async with async_session() as session:
        result = await session.execute(select(ProfileORM).where(ProfileORM.id == profile_id))
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        data = profile.data or {}
        if body.savedTestCases is not None:
            data["savedTestCases"] = body.savedTestCases
        if body.savedTestCaseSets is not None:
            data["savedTestCaseSets"] = body.savedTestCaseSets
        profile.data = data
        await session.commit()
        return {"ok": True}


@router.put("/{profile_id}")
async def update_profile_name(profile_id: str, body: UpdateProfileNameBody):
    """Rename profile."""
    if not profile_id.strip():
        raise HTTPException(status_code=400, detail="profile_id required")
    name = (body.name or "").strip() or "Unnamed"
    async with async_session() as session:
        result = await session.execute(select(ProfileORM).where(ProfileORM.id == profile_id))
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        profile.name = name
        await session.commit()
        return {"id": profile.id, "name": profile.name}
