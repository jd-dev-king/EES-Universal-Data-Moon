from __future__ import annotations

from fastapi import APIRouter, Depends

from .schemas import (
    AiInteractionEvent,
    AlertEvent,
    BatchIngestRequest,
    DiagnosticEvent,
    LogEvent,
    SnapshotEvent,
    TelemetryEvent,
)
from .service import ingest_batch, require_ingest_key, store_event


router = APIRouter(prefix="/api/ingest", tags=["ees-ingest"])


@router.get("/health")
def ingest_health():
    return {
        "status": "ok",
        "service": "EES Universal Ingest Gateway",
        "event_types": [
            "telemetry",
            "alert",
            "diagnostic",
            "snapshot",
            "log",
            "ai_interaction",
        ],
        "batch_limit": 500,
    }


@router.post("/telemetry")
def ingest_telemetry(body: TelemetryEvent, _: str = Depends(require_ingest_key)):
    result = store_event(
        event_type="telemetry",
        payload=body.model_dump(exclude_none=True),
    )
    return {"success": True, **result}


@router.post("/alerts")
def ingest_alert(body: AlertEvent, _: str = Depends(require_ingest_key)):
    result = store_event(
        event_type="alert",
        payload=body.model_dump(exclude_none=True),
    )
    return {"success": True, **result}


@router.post("/diagnostics")
def ingest_diagnostic(
    body: DiagnosticEvent,
    _: str = Depends(require_ingest_key),
):
    result = store_event(
        event_type="diagnostic",
        payload=body.model_dump(exclude_none=True),
    )
    return {"success": True, **result}


@router.post("/snapshots")
def ingest_snapshot(
    body: SnapshotEvent,
    _: str = Depends(require_ingest_key),
):
    result = store_event(
        event_type="snapshot",
        payload=body.model_dump(exclude_none=True),
    )
    return {"success": True, **result}


@router.post("/logs")
def ingest_log(body: LogEvent, _: str = Depends(require_ingest_key)):
    result = store_event(
        event_type="log",
        payload=body.model_dump(exclude_none=True),
    )
    return {"success": True, **result}


@router.post("/ai-interactions")
def ingest_ai_interaction(
    body: AiInteractionEvent,
    _: str = Depends(require_ingest_key),
):
    result = store_event(
        event_type="ai_interaction",
        payload=body.model_dump(exclude_none=True),
    )
    return {"success": True, **result}


@router.post("/batch")
def batch_ingest(
    body: BatchIngestRequest,
    _: str = Depends(require_ingest_key),
):
    # Use model_dump(mode="json") so Literal/string values stay plain strings.
    events = [
        event.model_dump(mode="json")
        for event in body.events
    ]

    return ingest_batch(
        system_key=body.system_key,
        system_id=body.system_id,
        events=events,
    )
