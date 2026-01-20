"""Initial schema for jobs, results, and boards."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def _table_exists(conn, table_name: str) -> bool:
    result = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    )
    return result.first() is not None


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    result = conn.execute(text(f"PRAGMA table_info({table_name})"))
    return any(row[1] == column_name for row in result)


def upgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, "jobs"):
        op.create_table(
            "jobs",
            sa.Column("id", sa.String(length=32), primary_key=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("vcd_filename", sa.String(length=255), nullable=False),
            sa.Column("firmware_filename", sa.String(length=255), nullable=True),
            sa.Column("target_board_id", sa.String(length=32), nullable=True),
            sa.Column("assigned_board_id", sa.String(length=32), nullable=True),
            sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("queue_position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("timeout_seconds", sa.Integer(), nullable=False, server_default="60"),
            sa.Column("retries", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("enable_picoscope", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("save_to_db", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("state", sa.String(length=32), nullable=False, server_default="pending"),
            sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("current_step", sa.String(length=255), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
        )

    if not _table_exists(conn, "results"):
        op.create_table(
            "results",
            sa.Column("id", sa.String(length=32), primary_key=True),
            sa.Column("job_id", sa.String(length=32), nullable=False),
            sa.Column("job_name", sa.String(length=255), nullable=False),
            sa.Column("board_id", sa.String(length=32), nullable=False),
            sa.Column("board_name", sa.String(length=255), nullable=False),
            sa.Column("passed", sa.Boolean(), nullable=False),
            sa.Column("started_at", sa.DateTime(), nullable=False),
            sa.Column("completed_at", sa.DateTime(), nullable=False),
            sa.Column("duration_seconds", sa.Float(), nullable=False),
            sa.Column("vcd_filename", sa.String(length=255), nullable=False),
            sa.Column("firmware_filename", sa.String(length=255), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("packet_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("crc_errors", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("console_log", sa.Text(), nullable=True),
            sa.Column("waveform_data", sa.JSON(), nullable=True),
        )

    if not _table_exists(conn, "boards"):
        op.create_table(
            "boards",
            sa.Column("id", sa.String(length=64), primary_key=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("ip_address", sa.String(length=64), nullable=False, server_default=""),
            sa.Column("mac_address", sa.String(length=64), nullable=True),
            sa.Column("firmware_version", sa.String(length=128), nullable=True),
            sa.Column("model", sa.String(length=128), nullable=True),
            sa.Column("tag", sa.String(length=128), nullable=True),
            sa.Column("connections", sa.JSON(), nullable=True),
            sa.Column("state", sa.String(length=32), nullable=False, server_default="offline"),
            sa.Column("cpu_temp", sa.Float(), nullable=True),
            sa.Column("cpu_load", sa.Float(), nullable=True),
            sa.Column("ram_usage", sa.Float(), nullable=True),
            sa.Column("current_job_id", sa.String(length=32), nullable=True),
            sa.Column("last_heartbeat", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        )
    else:
        for column, col_type in [
            ("model", sa.String(length=128)),
            ("tag", sa.String(length=128)),
            ("connections", sa.JSON()),
        ]:
            if not _column_exists(conn, "boards", column):
                op.add_column("boards", sa.Column(column, col_type, nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    if _table_exists(conn, "boards"):
        op.execute(text("DROP TABLE IF EXISTS boards"))
    if _table_exists(conn, "results"):
        op.execute(text("DROP TABLE IF EXISTS results"))
    if _table_exists(conn, "jobs"):
        op.execute(text("DROP TABLE IF EXISTS jobs"))
