"""WebSocket endpoints for real-time updates."""
from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime
import asyncio

from services.board_manager import board_manager
from services.job_queue import job_queue_service
from routers.jobs import _build_fe_job

router = APIRouter()


@router.websocket("/ws/system")
async def ws_system(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            boards = await board_manager.get_all_boards()
            payload = {
                "type": "system_health",
                "data": {
                    "totalBoards": len(boards),
                    "onlineBoards": sum(1 for b in boards if b.status.state.value == "online"),
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                },
            }
            await websocket.send_json(payload)
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        return


@router.websocket("/ws/boards")
async def ws_boards(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            boards = await board_manager.get_all_boards()
            for board in boards:
                await websocket.send_json(
                    {
                        "type": "board_update",
                        "data": {
                            "id": board.id,
                            "status": board.status.state.value,
                            "voltage": 3.3,
                        },
                    }
                )
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        return


@router.websocket("/ws/jobs")
async def ws_jobs(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            jobs = await job_queue_service.get_all_jobs()
            for job in jobs:
                fe_job = await _build_fe_job(job)
                await websocket.send_json(
                    {
                        "type": "job_progress",
                        "data": {
                            "jobId": fe_job["id"],
                            "progress": fe_job["progress"],
                            "completedFiles": fe_job["completedFiles"],
                        },
                    }
                )
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        return
