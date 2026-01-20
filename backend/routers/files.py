"""File upload and management endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from datetime import datetime
import os

from services.file_store import file_store

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), metadata: Optional[str] = Form(None)):
    content = await file.read()
    filename = file.filename or "upload.bin"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(content)

    file_type = (os.path.splitext(filename)[1] or "").lstrip(".") or (file.content_type or "bin")
    record = file_store.add_file(name=filename, size=len(content), file_type=file_type, path=path)
    record["uploadDate"] = datetime.utcnow().isoformat() + "Z"
    return {
        "id": record["id"],
        "name": record["name"],
        "size": record["size"],
        "type": record["type"],
        "uploadDate": record["uploadDate"],
    }


@router.get("")
async def list_files():
    return [
        {
            "id": f["id"],
            "name": f["name"],
            "size": f["size"],
            "type": f["type"],
            "uploadDate": f["uploadDate"],
        }
        for f in file_store.list_files()
    ]


@router.get("/{file_id}")
async def get_file(file_id: str):
    record = file_store.get_file(file_id)
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
    record = file_store.delete_file(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        if os.path.exists(record["path"]):
            os.remove(record["path"])
    except OSError:
        pass
    return {"success": True}
