import os
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import HTTPException
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

load_dotenv()


_client: MongoClient | None = None


def mongodb_url() -> str:
    value = os.getenv("EES_MONGODB_URL")

    if not value:
        raise HTTPException(
            status_code=503,
            detail="EES MongoDB connection is not configured.",
        )

    return value


def mongodb_database_name() -> str:
    return os.getenv(
        "EES_MONGODB_DATABASE",
        "ees_documents",
    )


def mongo_client() -> MongoClient:
    global _client

    if _client is None:
        _client = MongoClient(
            mongodb_url(),
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000,
        )

    return _client


def database() -> Database:
    return mongo_client()[
        mongodb_database_name()
    ]


def ping() -> dict[str, Any]:
    result = mongo_client().admin.command(
        "ping"
    )

    return {
        "status": "ok"
        if result.get("ok") == 1
        else "error",
        "database": mongodb_database_name(),
        "engine": "mongodb",
    }


def json_safe(
    value: Any,
) -> Any:

    if value is None:
        return None

    if isinstance(
        value,
        (
            str,
            int,
            float,
            bool,
        ),
    ):
        return value

    if isinstance(
        value,
        ObjectId,
    ):
        return str(value)

    if isinstance(
        value,
        (
            datetime,
            date,
        ),
    ):
        return value.isoformat()

    if isinstance(
        value,
        Decimal,
    ):
        return float(value)

    if isinstance(
        value,
        list,
    ):
        return [
            json_safe(item)
            for item in value
        ]

    if isinstance(
        value,
        dict,
    ):
        return {
            key: json_safe(item)
            for key, item
            in value.items()
        }

    return str(value)


def serialize_document(
    document: dict[str, Any],
) -> dict[str, Any]:

    return {
        key: json_safe(value)
        for key, value
        in document.items()
    }


def collection_names() -> list[str]:
    db = database()

    names = db.list_collection_names()

    return sorted(
        name
        for name in names
        if not name.startswith(
            "system."
        )
    )


def collection_summary() -> list[
    dict[str, Any]
]:
    db = database()

    results = []

    for name in collection_names():
        collection = db[name]

        results.append(
            {
                "name": name,
                "document_count":
                    collection.estimated_document_count(),
            }
        )

    return results


def ensure_indexes() -> None:
    db = database()

    db.telemetry_events.create_index(
        [
            ("system_key", ASCENDING),
            ("timestamp", DESCENDING),
        ],
        name="idx_telemetry_system_time",
    )

    db.simulation_snapshots.create_index(
        [
            ("system_key", ASCENDING),
            ("created_at", DESCENDING),
        ],
        name="idx_snapshot_system_time",
    )

    db.alert_events.create_index(
        [
            ("system_key", ASCENDING),
            ("severity", ASCENDING),
            ("timestamp", DESCENDING),
        ],
        name="idx_alert_system_severity_time",
    )

    db.diagnostic_payloads.create_index(
        [
            ("system_key", ASCENDING),
            ("created_at", DESCENDING),
        ],
        name="idx_diagnostic_system_time",
    )

    db.ai_interactions.create_index(
        [
            ("session_id", ASCENDING),
            ("timestamp", DESCENDING),
        ],
        name="idx_ai_session_time",
    )

    db.application_logs.create_index(
        [
            ("service", ASCENDING),
            ("level", ASCENDING),
            ("timestamp", DESCENDING),
        ],
        name="idx_logs_service_level_time",
    )


def find_documents(
    collection_name: str,
    query: dict[str, Any],
    limit: int,
    sort_field: str | None = None,
    sort_direction: int = -1,
) -> list[dict[str, Any]]:

    db = database()

    if (
        collection_name
        not in collection_names()
    ):
        raise HTTPException(
            status_code=404,
            detail=(
                f"Collection "
                f"'{collection_name}' "
                f"does not exist."
            ),
        )

    cursor = db[
        collection_name
    ].find(
        query
    )

    if sort_field:
        cursor = cursor.sort(
            sort_field,
            ASCENDING
            if sort_direction >= 0
            else DESCENDING,
        )

    cursor = cursor.limit(
        limit
    )

    return [
        serialize_document(document)
        for document in cursor
    ]


def get_document(
    collection_name: str,
    document_id: str,
) -> dict[str, Any]:

    db = database()

    if (
        collection_name
        not in collection_names()
    ):
        raise HTTPException(
            status_code=404,
            detail="Collection not found.",
        )

    try:
        object_id = ObjectId(
            document_id
        )
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid MongoDB ObjectId.",
        )

    document = db[
        collection_name
    ].find_one(
        {
            "_id": object_id,
        }
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    return serialize_document(
        document
    )