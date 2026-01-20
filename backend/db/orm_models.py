"""
SQLAlchemy ORM Models for database tables.
"""
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON
from datetime import datetime
from db.database import Base


class JobORM(Base):
    """Job table for persisting job queue."""
    __tablename__ = "jobs"

    id = Column(String(32), primary_key=True)
    name = Column(String(255), nullable=False)
    vcd_filename = Column(String(255), nullable=False)
    firmware_filename = Column(String(255), nullable=True)
    target_board_id = Column(String(32), nullable=True)
    assigned_board_id = Column(String(32), nullable=True)
    priority = Column(Integer, default=0)
    queue_position = Column(Integer, default=0)
    timeout_seconds = Column(Integer, default=60)
    retries = Column(Integer, default=0)
    enable_picoscope = Column(Boolean, default=False)
    save_to_db = Column(Boolean, default=True)
    
    # Status fields
    state = Column(String(32), default="pending")
    progress = Column(Integer, default=0)
    current_step = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class ResultORM(Base):
    """Result table for persisting test results."""
    __tablename__ = "results"

    id = Column(String(32), primary_key=True)
    job_id = Column(String(32), nullable=False)
    job_name = Column(String(255), nullable=False)
    board_id = Column(String(32), nullable=False)
    board_name = Column(String(255), nullable=False)
    passed = Column(Boolean, nullable=False)
    
    # Timing
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=False)
    duration_seconds = Column(Float, nullable=False)
    
    # Test details
    vcd_filename = Column(String(255), nullable=False)
    firmware_filename = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    packet_count = Column(Integer, default=0)
    crc_errors = Column(Integer, default=0)
    console_log = Column(Text, nullable=True)
    
    # Waveform data (stored as JSON)
    waveform_data = Column(JSON, nullable=True)


class BoardORM(Base):
    """Board inventory and status table."""
    __tablename__ = "boards"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    ip_address = Column(String(64), default="")
    mac_address = Column(String(64), nullable=True)
    firmware_version = Column(String(128), nullable=True)
    model = Column(String(128), nullable=True)
    tag = Column(String(128), nullable=True)
    connections = Column(JSON, nullable=True)

    # Status fields
    state = Column(String(32), default="offline")
    cpu_temp = Column(Float, nullable=True)
    cpu_load = Column(Float, nullable=True)
    ram_usage = Column(Float, nullable=True)
    current_job_id = Column(String(32), nullable=True)
    last_heartbeat = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
