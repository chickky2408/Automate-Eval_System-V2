"""
Job Queue Service with PostgreSQL persistence.
Manages the test job queue and execution scheduling.
"""
from typing import List, Optional, Dict
from datetime import datetime
import asyncio
import uuid
import os

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.job import Job, JobCreate, JobStatus, JobState
from services.board_manager import board_manager
from services.file_store import file_store
from services.result_store import result_store
from models.result import TestResult, WaveformData
from db.database import async_session
from db.orm_models import JobORM

class JobQueueService:
    """Manages the job queue and execution with SQLite persistence."""

    def __init__(self):
        self._running: bool = False
        self._current_task: Optional[asyncio.Task] = None
        self._loop_mode: bool = False

    async def initialize(self):
        """Initialize the service (called on app startup)."""
        print("[JobQueue] Service initialized with PostgreSQL persistence")
        # Auto-restart queue if needed, or just leave it modifying

    async def shutdown(self):
        """Shutdown the service (called on app shutdown)."""
        if self._current_task:
            self._current_task.cancel()
        print("[JobQueue] Service shutdown")

    def _orm_to_model(self, orm: JobORM) -> Job:
        """Convert ORM object to Pydantic model."""
        return Job(
            id=orm.id,
            name=orm.name,
            vcd_filename=orm.vcd_filename, # Legacy support
            firmware_filename=orm.firmware_filename, # Legacy support
            target_board_id=orm.target_board_id,
            assigned_board_id=orm.assigned_board_id,
            priority=orm.priority,
            timeout_seconds=orm.timeout_seconds,
            retries=orm.retries,
            enable_picoscope=orm.enable_picoscope,
            save_to_db=orm.save_to_db,
            status=JobStatus(
                state=JobState(orm.state),
                progress=orm.progress,
                current_step=orm.current_step,
                error_message=orm.error_message,
            ),
            created_at=orm.created_at,
            started_at=orm.started_at,
            completed_at=orm.completed_at,
        )

    async def get_all_jobs(self) -> List[Job]:
        """Get all jobs in queue order."""
        async with async_session() as session:
            result = await session.execute(
                select(JobORM).order_by(JobORM.priority.desc(), JobORM.queue_position)
            )
            jobs = result.scalars().all()
            return [self._orm_to_model(j) for j in jobs]

    async def get_job(self, job_id: str) -> Optional[Job]:
        """Get a specific job."""
        async with async_session() as session:
            result = await session.execute(
                select(JobORM).where(JobORM.id == job_id)
            )
            orm = result.scalar_one_or_none()
            return self._orm_to_model(orm) if orm else None

    async def add_job(self, job_data: JobCreate) -> Job:
        """Add a new job to the queue."""
        job_id = str(uuid.uuid4())[:8]
        
        async with async_session() as session:
            # Get max queue position
            result = await session.execute(
                select(JobORM.queue_position).order_by(JobORM.queue_position.desc()).limit(1)
            )
            max_pos = result.scalar() or 0
            
            # TODO: Map filenames to IDs if possible, for now duplicate to legacy
            orm = JobORM(
                id=job_id,
                name=job_data.name,
                vcd_filename=job_data.vcd_filename, # TODO: Use FileID
                firmware_filename=job_data.firmware_filename, # TODO: Use FileID
                target_board_id=job_data.target_board_id,
                priority=job_data.priority,
                queue_position=max_pos + 1,
                timeout_seconds=job_data.timeout_seconds,
                retries=job_data.retries,
                enable_picoscope=job_data.enable_picoscope,
                save_to_db=job_data.save_to_db,
                state="pending",
                progress=0,
                created_at=datetime.utcnow(),
            )
            session.add(orm)
            await session.commit()
            await session.refresh(orm)
            return self._orm_to_model(orm)

    async def remove_job(self, job_id: str) -> bool:
        """Remove a job from the queue."""
        async with async_session() as session:
            result = await session.execute(
                delete(JobORM).where(JobORM.id == job_id)
            )
            await session.commit()
            return result.rowcount > 0

    async def reorder_job(self, job_id: str, new_position: int) -> bool:
        """Move a job to a new position (0-based index). Reassigns queue_position for all jobs."""
        async with async_session() as session:
            result = await session.execute(
                select(JobORM).order_by(JobORM.priority.desc(), JobORM.queue_position)
            )
            jobs = list(result.scalars().all())
            idx = next((i for i, j in enumerate(jobs) if j.id == job_id), -1)
            if idx < 0 or new_position < 0 or new_position >= len(jobs):
                return False
            moved = jobs.pop(idx)
            jobs.insert(new_position, moved)
            for i, orm in enumerate(jobs):
                orm.queue_position = i
            await session.commit()
            return True

    async def update_job_meta(
        self, job_id: str, *, name: Optional[str] = None,
        vcd_filename: Optional[str] = None, firmware_filename: Optional[str] = None
    ) -> bool:
        """Update job metadata (name, vcd_filename, firmware_filename). Only for pending jobs."""
        async with async_session() as session:
            values = {}
            if name is not None:
                values["name"] = name
            if vcd_filename is not None:
                values["vcd_filename"] = vcd_filename
            if firmware_filename is not None:
                values["firmware_filename"] = firmware_filename
            if not values:
                return True
            result = await session.execute(
                update(JobORM).where(JobORM.id == job_id).values(**values)
            )
            await session.commit()
            return result.rowcount > 0

    async def update_job_status(
        self, 
        job_id: str, 
        state: JobState, 
        progress: int = 0, 
        current_step: Optional[str] = None,
        error_message: Optional[str] = None,
        assigned_board_id: Optional[str] = None,
        started_at: Optional[datetime] = None,
        completed_at: Optional[datetime] = None,
    ):
        """Update job status in database."""
        async with async_session() as session:
            values = {
                "state": state.value,
                "progress": progress,
                "current_step": current_step,
                "error_message": error_message,
            }
            if assigned_board_id:
                values["assigned_board_id"] = assigned_board_id
            if started_at:
                values["started_at"] = started_at
            if completed_at:
                values["completed_at"] = completed_at
                
            await session.execute(
                update(JobORM).where(JobORM.id == job_id).values(**values)
            )
            await session.commit()
            
            # Broadcast via WebSocket (if WS service provided)
            # await ws_manager.broadcast("job_update", {...})

    async def start(self):
        """Start queue processing."""
        if self._running:
            return
        self._running = True
        self._current_task = asyncio.create_task(self._process_queue())
        print("[JobQueue] Started processing")

    async def stop(self):
        """Stop queue processing."""
        self._running = False
        if self._current_task:
            self._current_task.cancel()
            self._current_task = None
        print("[JobQueue] Stopped processing")

    async def _process_queue(self):
        """Main queue processing loop."""
        while self._running:
            try:
                # Find next pending job
                async with async_session() as session:
                    result = await session.execute(
                        select(JobORM)
                        .where(JobORM.state == "pending")
                        .order_by(JobORM.priority.desc(), JobORM.queue_position)
                        .limit(1)
                    )
                    pending_orm = result.scalar_one_or_none()
                    # Detach from session to avoid expiration
                    if pending_orm:
                        pending_job = self._orm_to_model(pending_orm)
                    else:
                        pending_job = None
                        
                if pending_job:
                    await self._execute_job(pending_job)
                else:
                    await asyncio.sleep(1)
            except Exception as e:
                print(f"[JobQueue] Loop Error: {e}")
                await asyncio.sleep(1)

    async def _execute_job(self, job: Job):
        """Execute a single job (Real Implementation)."""
        print(f"[JobQueue] Executing job: {job.name}")

        # 1. Find available board
        if job.target_board_id:
            board = await board_manager.get_available_board(target_board_id=job.target_board_id)
        else:
            board = await board_manager.get_available_board()

        if not board:
            print(f"[JobQueue] No available board for job {job.id}")
            await asyncio.sleep(5) # Wait before retrying logic or skipping
            return

        # 2. Lock Board
        await board_manager.set_board_busy(board.id, job.id)

        try:
            # 3. Start Execution
            await self.update_job_status(
                job.id, JobState.CONFIGURING, 10, "Initializing board...",
                assigned_board_id=board.id, started_at=datetime.utcnow()
            )

            # TODO: Resolve file paths from DB if passing ID
            # vcd_path = ...
            
            # 4. Flash Firmware (if needed)
            if job.firmware_filename:
                await self.update_job_status(job.id, JobState.FLASHING, 30, "Programming EROM...")
                # await board_manager.flash_firmware(board.id, job.firmware_filename)

            # 5. Run Test
            await self.update_job_status(job.id, JobState.RUNNING, 50, "Executing test...")
            
            # NOTE: For now still simulating the Agent Call until Agent API is fully integrated
            await asyncio.sleep(2) 
            
            # 6. Save Result (Mock Result for now)
            result = TestResult(
                id=uuid.uuid4().hex,
                job_id=job.id,
                job_name=job.name,
                board_id=board.id,
                board_name=board.name,
                passed=True,
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow(),
                duration_seconds=5.0,
                vcd_filename=job.vcd_filename,
                firmware_filename=job.firmware_filename,
                packet_count=1000,
                crc_errors=0
            )
            await result_store.add_result(result)

            # 7. Complete
            await self.update_job_status(
                job.id, JobState.COMPLETED, 100, "Done",
                completed_at=datetime.utcnow()
            )
            print(f"[JobQueue] Job {job.id} completed successfully")

        except Exception as e:
            await self.update_job_status(
                job.id, JobState.FAILED, 0, None, str(e),
                completed_at=datetime.utcnow()
            )
            print(f"[JobQueue] Job {job.id} failed: {e}")

        finally:
            await board_manager.set_board_idle(board.id)

    async def get_status(self) -> dict:
        """Get queue status summary."""
        async with async_session() as session:
            result = await session.execute(select(JobORM))
            jobs = result.scalars().all()
            
        states = {}
        for job in jobs:
            states[job.state] = states.get(job.state, 0) + 1

        return {
            "running": self._running,
            "loop_mode": self._loop_mode,
            "total_jobs": len(jobs),
            "jobs_by_state": states,
        }


# Singleton instance
job_queue_service = JobQueueService()
