from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


EventType = Literal[
    "telemetry",
    "alert",
    "diagnostic",
    "snapshot",
    "log",
    "ai_interaction",
]


class BaseIngestEvent(BaseModel):
    model_config = ConfigDict(extra="allow")

    system_key: str | None = Field(default=None, max_length=200)
    system_id: str | None = Field(default=None, max_length=200)
    asset_id: str | None = Field(default=None, max_length=250)
    timestamp: datetime | None = None
    source: str | None = Field(default=None, max_length=250)
    environment: str | None = Field(default=None, max_length=100)
    correlation_id: str | None = Field(default=None, max_length=250)
    tags: dict[str, Any] = Field(default_factory=dict)


class TelemetryEvent(BaseIngestEvent):
    metric: str = Field(min_length=1, max_length=200)
    value: Any
    unit: str | None = Field(default=None, max_length=80)
    severity: str | None = Field(default=None, max_length=50)


class AlertEvent(BaseIngestEvent):
    severity: str = Field(min_length=1, max_length=50)
    message: str = Field(min_length=1, max_length=5000)
    alert_code: str | None = Field(default=None, max_length=200)
    status: str | None = Field(default=None, max_length=100)


class DiagnosticEvent(BaseIngestEvent):
    diagnostic_type: str = Field(min_length=1, max_length=200)
    status: str | None = Field(default=None, max_length=100)
    payload: dict[str, Any] = Field(default_factory=dict)


class SnapshotEvent(BaseIngestEvent):
    state: dict[str, Any] = Field(default_factory=dict)
    snapshot_type: str | None = Field(default=None, max_length=200)


class LogEvent(BaseIngestEvent):
    level: str = Field(min_length=1, max_length=50)
    message: str = Field(min_length=1, max_length=10000)
    service: str | None = Field(default=None, max_length=250)


class AiInteractionEvent(BaseIngestEvent):
    session_id: str | None = Field(default=None, max_length=250)
    role: str = Field(min_length=1, max_length=50)
    content: str = Field(min_length=1, max_length=20000)
    context: dict[str, Any] = Field(default_factory=dict)


class BatchEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: EventType
    data: dict[str, Any] = Field(default_factory=dict)


class BatchIngestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    system_key: str | None = Field(default=None, max_length=200)
    system_id: str | None = Field(default=None, max_length=200)
    events: list[BatchEvent] = Field(min_length=1, max_length=500)
