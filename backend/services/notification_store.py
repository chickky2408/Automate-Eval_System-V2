"""
In-memory notification store.
"""
from __future__ import annotations

from typing import List, Optional
from datetime import datetime


class NotificationStore:
    def __init__(self) -> None:
        self._notifications: List[dict] = []
        self._next_id = 1
        self._seed_defaults()

    def _seed_defaults(self) -> None:
        self.add_notification(
            title="System Ready",
            message="Backend service is running",
            notif_type="info",
        )

    def add_notification(self, title: str, message: str, notif_type: str) -> dict:
        record = {
            "id": self._next_id,
            "title": title,
            "message": message,
            "time": "just now",
            "type": notif_type,
            "read": False,
            "createdAt": datetime.utcnow().isoformat() + "Z",
        }
        self._next_id += 1
        self._notifications.insert(0, record)
        return record

    def list_notifications(self, read: Optional[bool] = None, limit: Optional[int] = None) -> List[dict]:
        records = self._notifications
        if read is not None:
            records = [n for n in records if n["read"] == read]
        if limit is not None:
            records = records[:limit]
        return records

    def mark_read(self, notif_id: int) -> Optional[dict]:
        for record in self._notifications:
            if record["id"] == notif_id:
                record["read"] = True
                return record
        return None

    def mark_all_read(self) -> int:
        count = 0
        for record in self._notifications:
            if not record["read"]:
                record["read"] = True
                count += 1
        return count


notification_store = NotificationStore()
