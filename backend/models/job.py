"""Job-related Pydantic models."""
from pydantic import BaseModel
from enum import Enum
from typing import Optional, List
from datetime import datetime


class JobState(str, Enum):
    PENDING = "pending"
    CONFIGURING = "configuring"
    FLASHING = "flashing"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobStatus(BaseModel):
    """Job execution status."""
    state: JobState
    progress: int = 0  # 0-100
    current_step: Optional[str] = None
    error_message: Optional[str] = None


class JobCreate(BaseModel):
    """Schema for creating a new job."""
    name: str
    vcd_filename: str
    firmware_filename: Optional[str] = None
    target_board_id: Optional[str] = None  # None = auto-assign
    priority: int = 0  # Higher = more priority
    timeout_seconds: int = 60
    retries: int = 0
    enable_picoscope: bool = False
    save_to_db: bool = True


class Job(BaseModel):
    """Full job information."""
    id: str
    name: str
    vcd_filename: str
    firmware_filename: Optional[str] = None
    target_board_id: Optional[str] = None
    assigned_board_id: Optional[str] = None
    priority: int = 0
    timeout_seconds: int = 60
    retries: int = 0
    enable_picoscope: bool = False
    save_to_db: bool = True
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
