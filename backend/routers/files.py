"""File upload and management endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from typing import Optional, Set
from datetime import datetime
from pydantic import BaseModel
import os

from services.file_store import file_store
from services.job_queue import job_queue_service
from services.fe_job_store import fe_job_store
from models.job import JobState

router = APIRouter()

ACTIVE_JOB_STATES = {JobState.PENDING, JobState.CONFIGURING, JobState.FLASHING, JobState.RUNNING}


async def _file_names_in_use_by_active_jobs() -> Set[str]:
    """Return set of file names (vcd/erom/ulp) referenced by any pending or running job."""
    names: Set[str] = set()
    jobs = await job_queue_service.get_all_jobs()
    for job in jobs:
        if job.status.state not in ACTIVE_JOB_STATES:
            continue
        for f in fe_job_store.list_files(job.id):
            if f.vcd:
                names.add(f.vcd)
            if f.erom:
                names.add(f.erom)
            if f.ulp:
                names.add(f.ulp)
    return names


class FileCheckPayload(BaseModel):
    """Metadata only: for compare-before-upload. Frontend sends filename, signature (checksum), size, modifyDate."""
    filename: Optional[str] = None
    signature: Optional[str] = None  # SHA-256 checksum (or MD5/CRC per requirement)
    size: Optional[int] = None
    modifyDate: Optional[str] = None


@router.post("/check")
async def check_file(payload: FileCheckPayload):
    """Compare by signature (checksum) before upload. Returns duplicate + existing file if found."""
    checksum = (payload.signature or "").strip()
    if not checksum:
        return {"duplicate": False}
    existing = await file_store.find_by_checksum(checksum, set_id=None)
    if existing:
        return {
            "duplicate": True,
            "existing": {
                "id": existing["id"],
                "name": existing["name"],
                "size": existing["size"],
                "type": existing["type"],
                "uploadDate": existing["uploadDate"],
                "checksum": existing.get("checksum"),
            },
        }
    return {"duplicate": False}


@router.get("/{file_id}/content")
async def get_file_content(file_id: str):
    """Return raw file content (for copying to set storage or download)."""
    content = await file_store.get_file_content(file_id)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found")
    record = await file_store.get_file(file_id)
    name = record.get("name", "file") if record else "file"
    return Response(content=content, media_type="application/octet-stream", headers={"Content-Disposition": f"inline; filename={name}"})

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    metadata: Optional[str] = Form(None),
    force_new: Optional[str] = Form(None),
    owner_id: Optional[str] = Form(None),
    visibility: Optional[str] = Form(None),
):
    """Upload file. If force_new is 'true', save a new copy even when content (checksum) already exists.
    owner_id: client_id or profile_id of uploader. visibility: 'private' | 'team' | 'public'."""
    content = await file.read()
    filename = file.filename or "upload.bin"
    file_type = (os.path.splitext(filename)[1] or "").lstrip(".") or (file.content_type or "bin")
    force_save_new = str(force_new or "").lower() in ("true", "1", "yes")
    vis = (visibility or "public").lower()
    if vis not in ("private", "team", "public"):
        vis = "public"

    record = await file_store.add_file(
        name=filename,
        file_type=file_type,
        content=content,
        force_new=force_save_new,
        owner_id=owner_id,
        visibility=vis,
    )

    response = {
        "id": record["id"],
        "name": record["name"],
        "size": record["size"],
        "type": record["type"],
        "uploadDate": record["uploadDate"],
        "checksum": record.get("checksum"),
        "ownerId": record.get("ownerId"),
        "visibility": record.get("visibility", "public"),
    }
    if record.get("duplicateByContent"):
        response["duplicateByContent"] = True
    if record.get("duplicateByName"):
        response["duplicateByName"] = True
    return response


@router.get("")
async def list_files():
    files = await file_store.list_files()
    result = [
        {
            "id": f["id"],
            "name": f["name"],
            "size": f["size"],
            "type": f["type"],
            "uploadDate": f["uploadDate"],
            "checksum": f.get("checksum"),
            "ownerId": f.get("ownerId"),
            "visibility": f.get("visibility", "public"),
        }
        for f in files
    ]
    return result


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
    record = await file_store.get_file(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    in_use = await _file_names_in_use_by_active_jobs()
    if record.get("name") and record["name"] in in_use:
        raise HTTPException(
            status_code=409,
            detail="File is in use by a running or pending batch. Wait for the batch to finish or remove the batch first.",
        )
    success = await file_store.delete_file(file_id)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    return {"success": True}
