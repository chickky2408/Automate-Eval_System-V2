"""
In-memory file metadata store for uploaded files.
"""
from __future__ import annotations

from typing import Dict, List, Optional
from datetime import datetime
import os
import uuid


class FileStore:
    def __init__(self) -> None:
        self._files: Dict[str, dict] = {}
        self._files_by_path: Dict[str, str] = {}

    def add_file(self, name: str, size: int, file_type: str, path: str) -> dict:
        existing_id = self._files_by_path.get(path)
        upload_date = datetime.utcnow().isoformat() + "Z"
        if existing_id:
            record = self._files[existing_id]
            record.update(
                name=name,
                size=size,
                type=file_type,
                uploadDate=upload_date,
                path=path,
            )
            return record

        file_id = uuid.uuid4().hex
        record = {
            "id": file_id,
            "name": name,
            "size": size,
            "type": file_type,
            "uploadDate": upload_date,
            "path": path,
        }
        self._files[file_id] = record
        self._files_by_path[path] = file_id
        return record

    def list_files(self) -> List[dict]:
        return list(self._files.values())

    def get_file(self, file_id: str) -> Optional[dict]:
        return self._files.get(file_id)

    def delete_file(self, file_id: str) -> Optional[dict]:
        record = self._files.pop(file_id, None)
        if record:
            self._files_by_path.pop(record.get("path", ""), None)
        return record

    def sync_with_dir(self, upload_dir: str) -> None:
        existing_paths = set()
        try:
            for entry in os.scandir(upload_dir):
                if not entry.is_file():
                    continue
                path = entry.path
                existing_paths.add(path)
                file_id = self._files_by_path.get(path)
                stat = entry.stat()
                upload_date = datetime.utcfromtimestamp(stat.st_mtime).isoformat() + "Z"
                file_type = (os.path.splitext(entry.name)[1] or "").lstrip(".") or "bin"
                if file_id and file_id in self._files:
                    self._files[file_id].update(
                        name=entry.name,
                        size=stat.st_size,
                        type=file_type,
                        uploadDate=upload_date,
                        path=path,
                    )
                    continue
                record_id = uuid.uuid4().hex
                self._files[record_id] = {
                    "id": record_id,
                    "name": entry.name,
                    "size": stat.st_size,
                    "type": file_type,
                    "uploadDate": upload_date,
                    "path": path,
                }
                self._files_by_path[path] = record_id
        except FileNotFoundError:
            return

        stale_paths = [path for path in self._files_by_path if path not in existing_paths]
        for path in stale_paths:
            record_id = self._files_by_path.pop(path, None)
            if record_id:
                self._files.pop(record_id, None)


file_store = FileStore()
