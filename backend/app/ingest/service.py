from __future__ import annotations

import hmac
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any

import psycopg
from fastapi import HTTPException, Request
from psycopg import sql

from ..documents.service import database, serialize_document


COLLECTION_BY_EVENT_TYPE = {
    "telemetry": "telemetry_events",
    "alert": "alert_events",
    "diagnostic": "diagnostic_payloads",
    "snapshot": "simulation_snapshots",
    "log": "application_logs",
    "ai_interaction": "ai_interactions",
}

SAFE_KEY = re.compile(r"^[A-Za-z0-9_.:-]+$")


def require_ingest_key(request: Request) -> str:
    configured = os.getenv("EES_INGEST_API_KEY", "").strip()
    if not configured:
        raise HTTPException(
            status_code=503,
            detail="EES ingest gateway is not configured. Set EES_INGEST_API_KEY.",
        )

    supplied = (request.headers.get("X-EES-Ingest-Key") or "").strip()

    if not supplied:
        auth = (request.headers.get("Authorization") or "").strip()
        if auth.lower().startswith("bearer "):
            supplied = auth[7:].strip()

    if not supplied or not hmac.compare_digest(supplied, configured):
        raise HTTPException(status_code=401, detail="Invalid EES ingest key.")

    return "ees-system"


def _registry_database_url() -> str:
    return (
        os.getenv("EES_REGISTRY_DATABASE_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("EES_DATABASE_URL")
        or ""
    ).strip()


def _require_registry_validation() -> bool:
    return os.getenv("EES_INGEST_REQUIRE_REGISTRY", "true").strip().lower() not in {
        "0",
        "false",
        "no",
        "off",
    }


def _safe_identity(value: str | None) -> str | None:
    if value is None:
        return None

    value = value.strip()

    if not value:
        return None

    if len(value) > 200 or not SAFE_KEY.fullmatch(value):
        raise HTTPException(
            status_code=400,
            detail="Invalid EES system identifier.",
        )

    return value


def resolve_registered_system(
    *,
    system_key: str | None = None,
    system_id: str | None = None,
) -> dict[str, Any]:
    system_key = _safe_identity(system_key)
    system_id = _safe_identity(system_id)

    if not system_key and not system_id:
        raise HTTPException(
            status_code=400,
            detail="system_key or system_id is required.",
        )

    registry_url = _registry_database_url()

    if not registry_url:
        if _require_registry_validation():
            raise HTTPException(
                status_code=503,
                detail="EES registry database is not configured for ingest validation.",
            )

        return {
            "system_id": system_id,
            "system_key": system_key or system_id,
            "system_name": system_key or system_id,
            "registry_validated": False,
        }

    try:
        with psycopg.connect(
            registry_url,
            connect_timeout=5,
        ) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'ees_registry'
                      AND table_name = 'systems'
                    """
                )

                columns = {
                    row[0]
                    for row in cur.fetchall()
                }

                if not columns:
                    if _require_registry_validation():
                        raise HTTPException(
                            status_code=503,
                            detail="EES registry table ees_registry.systems is unavailable.",
                        )

                    return {
                        "system_id": system_id,
                        "system_key": system_key or system_id,
                        "system_name": system_key or system_id,
                        "registry_validated": False,
                    }

                id_column = next(
                    (
                        name
                        for name in ("system_id", "id")
                        if name in columns
                    ),
                    None,
                )

                key_column = next(
                    (
                        name
                        for name in (
                            "system_key",
                            "system_code",
                            "slug",
                            "key",
                        )
                        if name in columns
                    ),
                    None,
                )

                name_column = next(
                    (
                        name
                        for name in ("system_name", "name")
                        if name in columns
                    ),
                    None,
                )

                predicates = []
                params: list[Any] = []

                if system_key and key_column:
                    predicates.append(
                        sql.SQL("{}::text = %s").format(
                            sql.Identifier(key_column)
                        )
                    )
                    params.append(system_key)

                if system_key and id_column:
                    predicates.append(
                        sql.SQL("{}::text = %s").format(
                            sql.Identifier(id_column)
                        )
                    )
                    params.append(system_key)

                if system_id and id_column:
                    predicates.append(
                        sql.SQL("{}::text = %s").format(
                            sql.Identifier(id_column)
                        )
                    )
                    params.append(system_id)

                if system_id and key_column:
                    predicates.append(
                        sql.SQL("{}::text = %s").format(
                            sql.Identifier(key_column)
                        )
                    )
                    params.append(system_id)

                if not predicates:
                    raise HTTPException(
                        status_code=503,
                        detail="EES registry does not expose a usable system identity column.",
                    )

                selected_columns = [
                    column
                    for column in (
                        id_column,
                        key_column,
                        name_column,
                    )
                    if column is not None
                ]

                query = sql.SQL(
                    "SELECT {} FROM ees_registry.systems WHERE {} LIMIT 1"
                ).format(
                    sql.SQL(", ").join(
                        sql.Identifier(column)
                        for column in selected_columns
                    ),
                    sql.SQL(" OR ").join(predicates),
                )

                cur.execute(query, params)
                row = cur.fetchone()

                if not row:
                    if _require_registry_validation():
                        raise HTTPException(
                            status_code=404,
                            detail="EES system is not registered.",
                        )

                    return {
                        "system_id": system_id,
                        "system_key": system_key or system_id,
                        "system_name": system_key or system_id,
                        "registry_validated": False,
                    }

                values = dict(
                    zip(
                        selected_columns,
                        row,
                    )
                )

                resolved_id = (
                    str(values.get(id_column))
                    if id_column
                    and values.get(id_column) is not None
                    else system_id
                )

                resolved_key = (
                    str(values.get(key_column))
                    if key_column
                    and values.get(key_column) is not None
                    else (system_key or resolved_id)
                )

                resolved_name = (
                    str(values.get(name_column))
                    if name_column
                    and values.get(name_column) is not None
                    else (resolved_key or resolved_id)
                )

                return {
                    "system_id": resolved_id,
                    "system_key": resolved_key,
                    "system_name": resolved_name,
                    "registry_validated": True,
                }

    except HTTPException:
        raise

    except psycopg.Error as exc:
        if _require_registry_validation():
            raise HTTPException(
                status_code=503,
                detail=f"EES registry validation failed: {exc}",
            ) from exc

        return {
            "system_id": system_id,
            "system_key": system_key or system_id,
            "system_name": system_key or system_id,
            "registry_validated": False,
        }


def normalize_timestamp(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)

    if value.tzinfo is None:
        return value.replace(
            tzinfo=timezone.utc,
        )

    return value.astimezone(
        timezone.utc,
    )


def validate_document_keys(
    value: Any,
    path: str = "payload",
) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str):
                raise HTTPException(
                    status_code=400,
                    detail=f"All MongoDB document keys must be strings ({path}).",
                )

            if key.startswith("$") or "." in key:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid field name '{key}' in {path}.",
                )

            validate_document_keys(
                child,
                f"{path}.{key}",
            )

    elif isinstance(value, list):
        for index, child in enumerate(value):
            validate_document_keys(
                child,
                f"{path}[{index}]",
            )


def store_event(
    *,
    event_type: str,
    payload: dict[str, Any],
    inherited_system_key: str | None = None,
    inherited_system_id: str | None = None,
) -> dict[str, Any]:
    collection_name = COLLECTION_BY_EVENT_TYPE.get(
        event_type
    )

    if not collection_name:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported EES event type '{event_type}'.",
        )

    payload = dict(payload)

    event_system_key = (
        payload.pop("system_key", None)
        or inherited_system_key
    )

    event_system_id = (
        payload.pop("system_id", None)
        or inherited_system_id
    )

    system = resolve_registered_system(
        system_key=event_system_key,
        system_id=event_system_id,
    )

    raw_timestamp = payload.pop(
        "timestamp",
        None,
    )

    if isinstance(raw_timestamp, str):
        try:
            raw_timestamp = datetime.fromisoformat(
                raw_timestamp.replace(
                    "Z",
                    "+00:00",
                )
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="timestamp must be a valid ISO-8601 datetime.",
            ) from exc

    timestamp = normalize_timestamp(
        raw_timestamp
    )

    received_at = datetime.now(
        timezone.utc
    )

    validate_document_keys(
        payload
    )

    document = {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "system_id": system.get("system_id"),
        "system_key": system.get("system_key"),
        "system_name": system.get("system_name"),
        "registry_validated": bool(
            system.get("registry_validated")
        ),
        "timestamp": timestamp,
        "received_at": received_at,
        **payload,
    }

    collection = database()[
        collection_name
    ]

    result = collection.insert_one(
        document
    )

    stored = (
        collection.find_one(
            {"_id": result.inserted_id}
        )
        or document
    )

    return {
        "collection": collection_name,
        "document": serialize_document(
            stored
        ),
    }


def ingest_batch(
    *,
    system_key: str | None,
    system_id: str | None,
    events: list[dict[str, Any]],
) -> dict[str, Any]:
    if len(events) > 500:
        raise HTTPException(
            status_code=400,
            detail="A single ingest request is limited to 500 events.",
        )

    system = resolve_registered_system(
        system_key=system_key,
        system_id=system_id,
    )

    canonical_key = system.get(
        "system_key"
    )

    canonical_id = system.get(
        "system_id"
    )

    accepted = []

    for index, event in enumerate(events):
        raw_event_type = event.get(
            "type"
        )

        event_type = (
            raw_event_type.value
            if hasattr(
                raw_event_type,
                "value",
            )
            else str(
                raw_event_type
                or ""
            ).strip()
        )

        # Defensive compatibility with stale callers that serialize Enum
        # instances as strings such as "EventType.telemetry".
        if event_type.startswith("EventType."):
            event_type = event_type.split(".", 1)[1]

        data = event.get(
            "data"
        )

        if not isinstance(
            data,
            dict,
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Batch event {index + 1} "
                    "data must be a JSON object."
                ),
            )

        accepted.append(
            store_event(
                event_type=event_type,
                payload=data,
                inherited_system_key=canonical_key,
                inherited_system_id=canonical_id,
            )
        )

    return {
        "success": True,
        "system_id": canonical_id,
        "system_key": canonical_key,
        "system_name": system.get(
            "system_name"
        ),
        "accepted_count": len(
            accepted
        ),
        "events": accepted,
    }
