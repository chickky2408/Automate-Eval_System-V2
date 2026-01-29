"""
File Store Service with PostgreSQL and Disk persistence.
"""
from __future__ import annotations
from typing import List, Optional
from datetime import datetime
import os
import uuid
import hashlib
import aiofiles
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import async_session
from db.orm_models import FileORM, FileType

class FileStore:
    def __init__(self, base_path: str = "uploads") -> None:
        self.base_path = base_path
        os.makedirs(self.base_path, exist_ok=True)

    def _get_storage_path(self, file_type: str, filename: str, file_uuid: str) -> str:
        """Generate a structured path: uploads/TYPE/YYYY/MM/uid_filename"""
        now = datetime.utcnow()
        type_dir = file_type.upper()
        year_dir = now.strftime("%Y")
        month_dir = now.strftime("%m")
        
        directory = os.path.join(self.base_path, type_dir, year_dir, month_dir)
        os.makedirs(directory, exist_ok=True)
        
        safe_filename = "".join(c for c in filename if c.isalnum() or c in "._-")
        return os.path.join(directory, f"{file_uuid}_{safe_filename}")

    async def calculate_checksum(self, file_path: str) -> str:
        """Calculate SHA256 checksum of a file asynchronously."""
        sha256 = hashlib.sha256()
        async with aiofiles.open(file_path, "rb") as f:
            while chunk := await f.read(8192):
                sha256.update(chunk)
        return sha256.hexdigest()

    async def add_file(self, name: str, file_type: str, content: bytes) -> dict:
        """Save file to disk and DB."""
        file_uuid = str(uuid.uuid4())
        
        # Determine paths
        try:
            ftype = FileType(file_type.upper())
        except ValueError:
            ftype = FileType.OTHER
            
        storage_path = self._get_storage_path(ftype.value, name, file_uuid)
        
        # Write to disk
        async with aiofiles.open(storage_path, "wb") as f:
            await f.write(content)
            
        # Calculate Checksum
        checksum = await self.calculate_checksum(storage_path)
        size = len(content)
        
        # Save to DB
        async with async_session() as session:
            orm = FileORM(
                id=file_uuid,
                filename=name,
                file_type=ftype,
                storage_path=storage_path,
                checksum_sha256=checksum,
                size_bytes=size,
                uploaded_at=datetime.utcnow()
            )
            session.add(orm)
            await session.commit()
            await session.refresh(orm)
            
            return {
                "id": orm.id,
                "name": orm.filename,
                "size": orm.size_bytes,
                "type": orm.file_type.value,
                "uploadDate": orm.uploaded_at.isoformat() + "Z",
                "checksum": orm.checksum_sha256
            }

    async def list_files(self) -> List[dict]:
        """List all files from DB."""
        async with async_session() as session:
            result = await session.execute(select(FileORM).order_by(FileORM.uploaded_at.desc()))
            files = result.scalars().all()
            return [
                {
                    "id": f.id,
                    "name": f.filename,
                    "size": f.size_bytes,
                    "type": f.file_type.value,
                    "uploadDate": f.uploaded_at.isoformat() + "Z",
                    "checksum": f.checksum_sha256
                }
                for f in files
            ]

    async def get_file(self, file_id: str) -> Optional[dict]:
        """Get file metadata by ID."""
        async with async_session() as session:
            result = await session.execute(select(FileORM).where(FileORM.id == file_id))
            f = result.scalar_one_or_none()
            if not f:
                return None
            return {
                "id": f.id,
                "name": f.filename,
                "size": f.size_bytes,
                "type": f.file_type.value,
                "uploadDate": f.uploaded_at.isoformat() + "Z",
                "path": f.storage_path, # Internal use only
                "checksum": f.checksum_sha256
            }

    async def delete_file(self, file_id: str) -> bool:
        """Delete file from DB and Disk."""
        async with async_session() as session:
            result = await session.execute(select(FileORM).where(FileORM.id == file_id))
            f = result.scalar_one_or_none()
            if not f:
                return False
                
            storage_path = f.storage_path
            await session.delete(f)
            await session.commit()
            
            # Remove from disk
            if os.path.exists(storage_path):
                try:
                    os.remove(storage_path)
                except OSError:
                    pass # Log warning
            return True

file_store = FileStore()
