"""
Result Store Service with SQLite persistence.
Manages storage and retrieval of test results.
"""
from typing import List, Optional
from datetime import datetime
import uuid
import random
import json

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.result import TestResult, WaveformData, WaveformChannel
from db.database import async_session
from db.orm_models import ResultORM


class ResultStore:
    """Manages test result storage with SQLite persistence."""

    def _orm_to_model(self, orm: ResultORM) -> TestResult:
        """Convert ORM object to Pydantic model."""
        return TestResult(
            id=orm.id,
            job_id=orm.job_id,
            job_name=orm.job_name,
            board_id=orm.board_id,
            board_name=orm.board_name,
            passed=orm.passed,
            started_at=orm.started_at,
            completed_at=orm.completed_at,
            duration_seconds=orm.duration_seconds,
            vcd_filename=orm.vcd_filename,
            firmware_filename=orm.firmware_filename,
            error_message=orm.error_message,
            packet_count=orm.packet_count,
            crc_errors=orm.crc_errors,
            console_log=orm.console_log,
            waveform_available=orm.waveform_data is not None,
        )

    def _waveform_from_json(self, data: dict) -> WaveformData:
        """Convert JSON to WaveformData model."""
        channels = [
            WaveformChannel(name=ch["name"], color=ch["color"], data=ch["data"])
            for ch in data.get("channels", [])
        ]
        return WaveformData(
            channels=channels,
            time_unit=data.get("time_unit", "us"),
            total_duration=data.get("total_duration", 0.0),
        )

    async def get_results(
        self,
        board_id: Optional[str] = None,
        passed: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[TestResult]:
        """Get filtered results."""
        async with async_session() as session:
            query = select(ResultORM).order_by(ResultORM.completed_at.desc())
            
            if board_id:
                query = query.where(ResultORM.board_id == board_id)
            if passed is not None:
                query = query.where(ResultORM.passed == passed)
            
            query = query.offset(offset).limit(limit)
            result = await session.execute(query)
            results = result.scalars().all()
            return [self._orm_to_model(r) for r in results]

    async def get_result(self, result_id: str) -> Optional[TestResult]:
        """Get a specific result."""
        async with async_session() as session:
            result = await session.execute(
                select(ResultORM).where(ResultORM.id == result_id)
            )
            orm = result.scalar_one_or_none()
            return self._orm_to_model(orm) if orm else None

    async def get_waveform(self, result_id: str) -> Optional[WaveformData]:
        """Get waveform data for a result."""
        async with async_session() as session:
            result = await session.execute(
                select(ResultORM.waveform_data).where(ResultORM.id == result_id)
            )
            data = result.scalar_one_or_none()
            if data:
                return self._waveform_from_json(data)
            return None

    async def add_result(
        self, 
        result: TestResult, 
        waveform: Optional[WaveformData] = None
    ) -> str:
        """Add a new result."""
        async with async_session() as session:
            waveform_json = None
            if waveform:
                waveform_json = {
                    "channels": [
                        {"name": ch.name, "color": ch.color, "data": ch.data}
                        for ch in waveform.channels
                    ],
                    "time_unit": waveform.time_unit,
                    "total_duration": waveform.total_duration,
                }
            
            orm = ResultORM(
                id=result.id,
                job_id=result.job_id,
                job_name=result.job_name,
                board_id=result.board_id,
                board_name=result.board_name,
                passed=result.passed,
                started_at=result.started_at,
                completed_at=result.completed_at,
                duration_seconds=result.duration_seconds,
                vcd_filename=result.vcd_filename,
                firmware_filename=result.firmware_filename,
                error_message=result.error_message,
                packet_count=result.packet_count,
                crc_errors=result.crc_errors,
                console_log=result.console_log,
                waveform_data=waveform_json,
            )
            session.add(orm)
            await session.commit()
            return result.id

    async def delete_result(self, result_id: str) -> bool:
        """Delete a result."""
        async with async_session() as session:
            result = await session.execute(
                delete(ResultORM).where(ResultORM.id == result_id)
            )
            await session.commit()
            return result.rowcount > 0


# Singleton instance
result_store = ResultStore()
