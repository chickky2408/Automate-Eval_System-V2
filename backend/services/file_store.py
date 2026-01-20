"""
In-memory file metadata store for uploaded files.
"""
from __future__ import annotations

from typing import Dict, List, Optional
from datetime import datetime
import uuid


class FileStore:
    def __init__(self) -> None:
        self._files: Dict[str, dict] = {}

    def add_file(self, name: str, size: int, file_type: str, path: str) -> dict:
        file_id = uuid.uuid4().hex
        record = {
            "id": file_id,
            "name": name,
            "size": size,
            "type": file_type,
            "uploadDate": datetime.utcnow().isoformat() + "Z",
            "path": path,
        }
        self._files[file_id] = record
        return record

    def list_files(self) -> List[dict]:
        return list(self._files.values())

    def get_file(self, file_id: str) -> Optional[dict]:
        return self._files.get(file_id)

    def delete_file(self, file_id: str) -> Optional[dict]:
        return self._files.pop(file_id, None)


file_store = FileStore()
