"""
Board Manager Service
Handles discovery, status tracking, and control of boards.
Loads board inventory from SQLite.
"""
from typing import List, Optional
import asyncio

from sqlalchemy import select, update, delete

from models.board import BoardInfo, BoardStatus, BoardState
from db.database import async_session
from db.orm_models import BoardORM


class BoardManager:
    """Manages the fleet of Zybo boards."""

    def __init__(self):
        pass

    def _orm_to_model(self, orm: BoardORM) -> BoardInfo:
        """Convert ORM object to BoardInfo."""
        try:
            state = BoardState(orm.state)
        except ValueError:
            state = BoardState.OFFLINE

        return BoardInfo(
            id=orm.id,
            name=orm.name,
            ip_address=orm.ip_address,
            mac_address=orm.mac_address,
            firmware_version=orm.firmware_version,
            model=orm.model,
            tag=orm.tag,
            connections=orm.connections or [],
            status=BoardStatus(
                state=state,
                cpu_temp=orm.cpu_temp,
                cpu_load=orm.cpu_load,
                ram_usage=orm.ram_usage,
                current_job_id=orm.current_job_id,
                last_heartbeat=orm.last_heartbeat,
            ),
        )

    async def get_all_boards(self) -> List[BoardInfo]:
        """Get all registered boards."""
        async with async_session() as session:
            result = await session.execute(select(BoardORM))
            boards = result.scalars().all()
            return [self._orm_to_model(b) for b in boards]

    async def get_board(self, board_id: str) -> Optional[BoardInfo]:
        """Get a specific board by ID."""
        async with async_session() as session:
            result = await session.execute(select(BoardORM).where(BoardORM.id == board_id))
            board = result.scalar_one_or_none()
            return self._orm_to_model(board) if board else None

    async def create_board(
        self,
        *,
        board_id: str,
        name: str,
        ip_address: str,
        mac_address: Optional[str],
        firmware_version: Optional[str],
        model: Optional[str],
        tag: Optional[str],
        connections: Optional[list],
        state: BoardState,
    ) -> BoardInfo:
        async with async_session() as session:
            orm = BoardORM(
                id=board_id,
                name=name,
                ip_address=ip_address,
                mac_address=mac_address,
                firmware_version=firmware_version,
                model=model,
                tag=tag,
                connections=connections or [],
                state=state.value,
            )
            session.add(orm)
            await session.commit()
            await session.refresh(orm)
            return self._orm_to_model(orm)

    async def update_board(self, board_id: str, updates: dict) -> Optional[BoardInfo]:
        async with async_session() as session:
            result = await session.execute(
                update(BoardORM).where(BoardORM.id == board_id).values(**updates)
            )
            await session.commit()
            if result.rowcount <= 0:
                return None
            refreshed = await session.execute(select(BoardORM).where(BoardORM.id == board_id))
            orm = refreshed.scalar_one_or_none()
            return self._orm_to_model(orm) if orm else None

    async def delete_board(self, board_id: str) -> bool:
        async with async_session() as session:
            result = await session.execute(delete(BoardORM).where(BoardORM.id == board_id))
            await session.commit()
            return result.rowcount > 0

    async def get_available_board(self) -> Optional[BoardInfo]:
        """Get the first available (online, not busy) board."""
        async with async_session() as session:
            result = await session.execute(
                select(BoardORM).where(BoardORM.state == BoardState.ONLINE.value).limit(1)
            )
            board = result.scalar_one_or_none()
            return self._orm_to_model(board) if board else None

    async def update_board_status(self, board_id: str, status: BoardStatus) -> bool:
        """Update a board's status."""
        async with async_session() as session:
            result = await session.execute(
                update(BoardORM)
                .where(BoardORM.id == board_id)
                .values(
                    state=status.state.value,
                    cpu_temp=status.cpu_temp,
                    cpu_load=status.cpu_load,
                    ram_usage=status.ram_usage,
                    current_job_id=status.current_job_id,
                    last_heartbeat=status.last_heartbeat,
                )
            )
            await session.commit()
            return result.rowcount > 0

    async def set_board_busy(self, board_id: str, job_id: str) -> bool:
        """Mark a board as busy with a job."""
        async with async_session() as session:
            result = await session.execute(
                update(BoardORM)
                .where(BoardORM.id == board_id)
                .values(state=BoardState.BUSY.value, current_job_id=job_id)
            )
            await session.commit()
            return result.rowcount > 0

    async def set_board_idle(self, board_id: str) -> bool:
        """Mark a board as idle (online)."""
        async with async_session() as session:
            result = await session.execute(
                update(BoardORM)
                .where(BoardORM.id == board_id)
                .values(state=BoardState.ONLINE.value, current_job_id=None)
            )
            await session.commit()
            return result.rowcount > 0

    async def reboot_board(self, board_id: str) -> bool:
        """Send reboot command to a board (MOCK)."""
        board = await self.get_board(board_id)
        if not board:
            return False
        print(f"[MOCK] Rebooting board {board_id}...")
        # In real implementation: SSH to board and execute reboot
        await asyncio.sleep(0.5)  # Simulate network delay
        return True

    async def ping_board(self, board_id: str) -> bool:
        """Check if a board is reachable (MOCK)."""
        board = await self.get_board(board_id)
        if not board:
            return False
        return board.status.state != BoardState.OFFLINE


# Singleton instance
board_manager = BoardManager()
