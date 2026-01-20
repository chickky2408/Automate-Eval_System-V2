"""Notification endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from services.notification_store import notification_store

router = APIRouter()


@router.get("")
async def list_notifications(
    read: Optional[bool] = Query(None),
    limit: Optional[int] = Query(None, ge=1),
):
    return notification_store.list_notifications(read=read, limit=limit)


@router.post("/{notification_id}/read")
async def mark_notification_read(notification_id: int):
    record = notification_store.mark_read(notification_id)
    if not record:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.post("/read-all")
async def mark_all_read():
    count = notification_store.mark_all_read()
    return {"success": True, "count": count}
