from typing import Any

from pydantic import BaseModel

from ..connections.schemas import ConnectionTestRequest


class QueryRunRequest(BaseModel):
    connection: ConnectionTestRequest
    sql: str


class QueryRunResponse(BaseModel):
    success: bool
    message: str | None = None

    columns: list[str] = []
    rows: list[list[Any]] = []

    row_count: int = 0
    duration_ms: float = 0