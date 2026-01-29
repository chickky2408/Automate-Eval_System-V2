"""File upload and management endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from datetime import datetime
import os

from services.file_store import file_store

router = APIRouter()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), metadata: Optional[str] = Form(None)):
    content = await file.read()
    filename = file.filename or "upload.bin"
    file_type = (os.path.splitext(filename)[1] or "").lstrip(".") or (file.content_type or "bin")
    
    # New logic: Pass content directly to service
    record = await file_store.add_file(name=filename, file_type=file_type, content=content)
    
    return {
        "id": record["id"],
        "name": record["name"],
        "size": record["size"],
        "type": record["type"],
        "uploadDate": record["uploadDate"],
    }


@router.get("")
async def list_files():
    # No need to sync_with_dir anymore, effectively handled by DB
    files = await file_store.list_files()
    return [
        {
            "id": f["id"],
            "name": f["name"],
            "size": f["size"],
            "type": f["type"],
            "uploadDate": f["uploadDate"],
        }
        for f in files
    ]


@router.get("/{file_id}")
async def get_file(file_id: str):
    record = await file_store.get_file(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    return {
        "id": record["id"],
        "name": record["name"],
        "size": record["size"],
        "type": record["type"],
        "uploadDate": record["uploadDate"],
    }


@router.delete("/{file_id}")
async def delete_file(file_id: str):
    success = await file_store.delete_file(file_id)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    return {"success": True}
