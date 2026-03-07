"""Job queue API endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
import uuid

from models.job import JobCreate, JobState
from services.job_queue import job_queue_service
from services.fe_job_store import fe_job_store
from services.board_manager import board_manager
from services.file_store import file_store

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class JobFileCreate(BaseModel):
    name: str
    order: Optional[int] = None
    vcd: Optional[str] = None  # VCD file name
    erom: Optional[str] = None  # ERoM (BIN) file name
    ulp: Optional[str] = None   # ULP (LIN) file name
    try_count: Optional[int] = None   # Number of test rounds
    testCaseName: Optional[str] = None  # Display name for test case (e.g. from set)


class JobCreatePayload(BaseModel):
    name: str
    tag: Optional[str] = None
    firmware: Optional[str] = None
    boards: Optional[List[str]] = None
    files: Optional[List[JobFileCreate]] = None
    configName: Optional[str] = None
    clientId: Optional[str] = None
    pairsData: Optional[List[dict]] = None  # เก็บ pairs data สำหรับ edit batch


class JobTagUpdate(BaseModel):
    tag: Optional[str] = None


class FileMoveRequest(BaseModel):
    direction: str


class RunCommandPayload(BaseModel):
    name: Optional[str] = None
    command: str
    tag: Optional[str] = None
    boards: Optional[List[str]] = None
    configName: Optional[str] = None
    firmware: Optional[str] = None
    clientId: Optional[str] = None


def _model_to_dict(item: BaseModel) -> dict:
    if hasattr(item, "model_dump"):
        return item.model_dump()
    return item.dict()


def _map_job_state(state: JobState) -> str:
    if state == JobState.PENDING:
        return "pending"
    if state in {JobState.CONFIGURING, JobState.FLASHING, JobState.RUNNING}:
        return "running"
    if state == JobState.COMPLETED:
        return "completed"
    return "stopped"


def _to_iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.isoformat() + "Z"


async def _resolve_boards(job, meta: dict) -> List[str]:
    boards = list(meta.get("boards") or [])
    if boards:
        return boards

    board_ids = [job.assigned_board_id or job.target_board_id]
    resolved = []
    for board_id in board_ids:
        if not board_id:
            continue
        board = await board_manager.get_board(board_id)
        resolved.append(board.name if board else board_id)
    return resolved


def _serialize_files(files) -> List[dict]:
    return [
        {
            "id": file_item.id,
            "name": file_item.name,
            "status": file_item.status,
            "result": file_item.result,
            "order": file_item.order,
            "vcd": getattr(file_item, "vcd", None),  # VCD file name
            "erom": getattr(file_item, "erom", None),  # ERoM (BIN) file name
            "ulp": getattr(file_item, "ulp", None),   # ULP (LIN) file name
            "try_count": getattr(file_item, "try_count", None),  # Number of test rounds
            "testCaseName": getattr(file_item, "test_case_name", None),  # Display name from set
        }
        for file_item in sorted(files, key=lambda f: f.order)
    ]


async def _build_fe_job(job) -> dict:
    meta = fe_job_store.ensure_meta(
        job.id,
        firmware=job.firmware_filename,
        default_file_name=job.vcd_filename,
    )
    status = _map_job_state(job.status.state)
    files = fe_job_store.sync_files_for_status(job.id, status)
    completed_files = sum(1 for f in files if f.status == "completed")
    boards = await _resolve_boards(job, meta)
    return {
        "id": job.id,
        "name": job.name,
        "progress": job.status.progress,
        "status": status,
        "tag": meta.get("tag"),
        "clientId": meta.get("clientId"),
        "totalFiles": len(files),
        "completedFiles": completed_files,
        "firmware": meta.get("firmware") or job.firmware_filename or "",
        "boards": boards,
        "startedAt": _to_iso(job.started_at),
        "completedAt": _to_iso(job.completed_at),
        "files": _serialize_files(files),
    }


@router.get("")
async def list_jobs(
    status: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    clientId: Optional[str] = Query(None),
):
    """Get all jobs in the queue."""
    jobs = await job_queue_service.get_all_jobs()
    payload = []
    for job in jobs:
        payload.append(await _build_fe_job(job))

    if status:
        payload = [job for job in payload if job["status"] == status]
    if tag:
        payload = [job for job in payload if job.get("tag") == tag]
    if clientId:
        payload = [job for job in payload if job.get("clientId") == clientId]
    return payload


@router.get("/{job_id}")
async def get_job(job_id: str):
    """Get a specific job."""
    job = await job_queue_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return await _build_fe_job(job)


@router.post("")
async def create_job(payload: JobCreatePayload):
    """Create a job using the frontend schema."""
    file_payloads = [_model_to_dict(file_item) for file_item in (payload.files or [])]
    vcd_filename = file_payloads[0]["name"] if file_payloads else f"{uuid.uuid4().hex}.vcd"

    job_data = JobCreate(
        name=payload.name,
        vcd_filename=vcd_filename,
        firmware_filename=payload.firmware,
        target_board_id=None,
        priority=0,
        timeout_seconds=60,
    )
    job = await job_queue_service.add_job(job_data)

    fe_job_store.create_from_payload(
        job.id,
        tag=payload.tag,
        firmware=payload.firmware,
        boards=payload.boards,
        files=file_payloads,
        client_id=payload.clientId,
        config_name=payload.configName,
        default_file_name=vcd_filename,
    )
    
    # เก็บ pairs data สำหรับ edit batch
    if payload.pairsData:
        fe_job_store.save_pairs_data(job.id, payload.pairsData)
    
    return await _build_fe_job(job)


@router.put("/{job_id}")
async def update_job(job_id: str, payload: JobCreatePayload):
    """Update an existing job (pending only). Replaces files and meta from payload."""
    job = await job_queue_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    if job.status.state != JobState.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Only pending jobs can be updated. Stop the job first to edit.",
        )
    file_payloads = [_model_to_dict(f) for f in (payload.files or [])]
    vcd_filename = file_payloads[0]["name"] if file_payloads else job.vcd_filename or f"{job_id}.vcd"
    firmware_filename = payload.firmware or ""
    await job_queue_service.update_job_meta(
        job_id,
        name=payload.name,
        vcd_filename=vcd_filename,
        firmware_filename=firmware_filename or None,
    )
    fe_job_store.create_from_payload(
        job_id,
        tag=payload.tag,
        firmware=payload.firmware,
        boards=payload.boards,
        files=file_payloads,
        client_id=payload.clientId,
        config_name=payload.configName,
        default_file_name=vcd_filename,
    )
    if payload.pairsData is not None:
        fe_job_store.save_pairs_data(job_id, payload.pairsData)
    return await _build_fe_job(await job_queue_service.get_job(job_id))


@router.post("/{job_id}/start")
async def start_job(job_id: str):
    """Start a job. Verifies that referenced files have not been modified on disk since upload."""
    job = await job_queue_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    fe_job_store.ensure_meta(job.id, default_file_name=job.vcd_filename)
    job_files = fe_job_store.list_files(job.id)
    file_names = set()
    for f in job_files:
        if getattr(f, "vcd", None):
            file_names.add(f.vcd)
        if getattr(f, "erom", None):
            file_names.add(f.erom)
        if getattr(f, "ulp", None):
            file_names.add(f.ulp)

    modified = []
    if file_names:
        library = await file_store.list_files(set_id=None)
        name_to_id = {f["name"]: f["id"] for f in library}
        for name in file_names:
            fid = name_to_id.get(name)
            if fid and not await file_store.verify_file_checksum(fid):
                modified.append(name)
        if modified:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "FILE_MODIFIED",
                    "message": "One or more files were modified after upload. Re-upload or restore files before running.",
                    "files": modified,
                },
            )

    await job_queue_service.update_job_status(
        job_id, JobState.RUNNING, progress=0, started_at=datetime.utcnow()
    )
    fe_job_store.sync_files_for_status(job_id, "running")
    return {"success": True, "message": "Job started"}


@router.post("/{job_id}/stop")
async def stop_job(job_id: str):
    """Stop a job (mock)."""
    job = await job_queue_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    await job_queue_service.update_job_status(
        job_id, JobState.CANCELLED, progress=job.status.progress, completed_at=datetime.utcnow()
    )
    fe_job_store.sync_files_for_status(job_id, "stopped")
    return {"success": True, "message": "Job stopped"}


@router.post("/stop-all")
async def stop_all_jobs():
    """Stop all running jobs (mock)."""
    jobs = await job_queue_service.get_all_jobs()
    stopped = 0
    for job in jobs:
        if _map_job_state(job.status.state) == "running":
            await job_queue_service.update_job_status(
                job.id, JobState.CANCELLED, progress=job.status.progress, completed_at=datetime.utcnow()
            )
            fe_job_store.sync_files_for_status(job.id, "stopped")
            stopped += 1
    return {"success": True, "stoppedCount": stopped}


@router.get("/{job_id}/export")
async def export_job(job_id: str):
    """Export a job payload as JSON."""
    job = await job_queue_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return await _build_fe_job(job)


@router.patch("/{job_id}")
async def update_job_tag(job_id: str, payload: JobTagUpdate):
    """Update job metadata (tag)."""
    job = await job_queue_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    fe_job_store.update_tag(job_id, payload.tag)
    return {"success": True, "job": await _build_fe_job(job)}


@router.get("/{job_id}/files")
async def get_job_files(job_id: str):
    """Get files in a job."""
    job = await job_queue_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    fe_job_store.ensure_meta(job.id, default_file_name=job.vcd_filename)
    files = fe_job_store.list_files(job.id)
    return _serialize_files(files)


@router.get("/{job_id}/pairs")
async def get_job_pairs(job_id: str):
    """Get pairs data (pair table history) for editing batch."""
    job = await job_queue_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    pairs_data = fe_job_store.get_pairs_data(job.id)
    if pairs_data is None:
        raise HTTPException(status_code=404, detail="Pairs data not found for this job")
    return {"pairsData": pairs_data}


@router.post("/{job_id}/files/{file_id}/stop")
async def stop_job_file(job_id: str, file_id: int):
    """Stop a specific file in a job."""
    job = await job_queue_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    fe_job_store.ensure_meta(job.id, default_file_name=job.vcd_filename)
    file_item = fe_job_store.update_file(job.id, file_id, status="stopped")
    if not file_item:
        raise HTTPException(status_code=404, detail="File not found")
    return {"success": True, "file": {"id": file_item.id, "status": file_item.status}}


@router.post("/{job_id}/files/{file_id}/rerun")
async def rerun_job_file(job_id: str, file_id: int):
    """Set a stopped file back to pending so it can be run again."""
    job = await job_queue_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    fe_job_store.ensure_meta(job.id, default_file_name=job.vcd_filename)
    files = fe_job_store.list_files(job.id)
    file_before = next((f for f in files if f.id == file_id), None)
    if not file_before:
        raise HTTPException(status_code=404, detail="File not found")
    if file_before.status != "stopped":
        raise HTTPException(status_code=400, detail="Only stopped files can be re-run")
    file_item = fe_job_store.update_file(job.id, file_id, status="pending", result=None)
    return {"success": True, "file": {"id": file_item.id, "status": file_item.status}}


@router.post("/{job_id}/files/{file_id}/move")
async def move_job_file(job_id: str, file_id: int, payload: FileMoveRequest):
    """Move a file up/down in the job."""
    job = await job_queue_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    fe_job_store.ensure_meta(job.id, default_file_name=job.vcd_filename)
    files = fe_job_store.move_file(job.id, file_id, payload.direction)
    return {
        "success": True,
        "files": [{"id": f.id, "order": f.order} for f in sorted(files, key=lambda f: f.order)],
    }


@router.post("/upload")
async def upload_files(
    vcd_file: UploadFile = File(...),
    firmware_file: Optional[UploadFile] = File(None),
    name: str = Form(...),
    target_board_id: Optional[str] = Form(None),
    priority: int = Form(0),
    timeout_seconds: int = Form(60),
):
    """Upload VCD/firmware files and create a job."""
    vcd_filename = f"{uuid.uuid4()}_{vcd_file.filename}"
    vcd_path = os.path.join(UPLOAD_DIR, vcd_filename)
    with open(vcd_path, "wb") as f:
        content = await vcd_file.read()
        f.write(content)

    firmware_filename = None
    if firmware_file:
        firmware_filename = f"{uuid.uuid4()}_{firmware_file.filename}"
        firmware_path = os.path.join(UPLOAD_DIR, firmware_filename)
        with open(firmware_path, "wb") as f:
            content = await firmware_file.read()
            f.write(content)

    job_data = JobCreate(
        name=name,
        vcd_filename=vcd_filename,
        firmware_filename=firmware_filename,
        target_board_id=target_board_id,
        priority=priority,
        timeout_seconds=timeout_seconds,
    )
    job = await job_queue_service.add_job(job_data)
    return await _build_fe_job(job)


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Remove a job from the queue."""
    success = await job_queue_service.remove_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return {"message": f"Job {job_id} removed"}


@router.post("/{job_id}/reorder")
async def reorder_job(job_id: str, new_position: int):
    """Move a job to a new position in the queue."""
    success = await job_queue_service.reorder_job(job_id, new_position)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to reorder job")
    return {"message": f"Job {job_id} moved to position {new_position}"}


@router.post("/run-command")
async def run_command(payload: RunCommandPayload):
    """Create a job that represents a command execution."""
    job_name = payload.name or "Run Command"
    vcd_filename = f"{uuid.uuid4().hex[:8]}.cmd"

    job_data = JobCreate(
        name=job_name,
        vcd_filename=vcd_filename,
        firmware_filename=payload.firmware,
        target_board_id=None,
        priority=0,
        timeout_seconds=60,
    )
    job = await job_queue_service.add_job(job_data)

    fe_job_store.create_from_payload(
        job.id,
        tag=payload.tag,
        firmware=payload.firmware,
        boards=payload.boards,
        files=[{"name": f"command_{job.id}.txt", "order": 1}],
        client_id=payload.clientId,
        config_name=payload.configName,
        default_file_name=vcd_filename,
    )
    return await _build_fe_job(job)


@router.post("/start")
async def start_queue():
    """Start processing the job queue."""
    await job_queue_service.start()
    return {"message": "Queue processing started"}


@router.post("/stop")
async def stop_queue():
    """Stop processing the job queue."""
    await job_queue_service.stop()
    return {"message": "Queue processing stopped"}


@router.get("/status/summary")
async def get_queue_status():
    """Get queue processing status."""
    return await job_queue_service.get_status()
