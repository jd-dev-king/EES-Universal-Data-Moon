from typing import Any
import time
from datetime import datetime, timezone
from itertools import islice

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..admin.auth import require_admin
from .schemas import DocumentQueryRequest, DocumentQueryResponse
from .service import (
    collection_names,
    collection_summary,
    database,
    find_documents,
    get_document,
    mongodb_database_name,
    ping,
    serialize_document,
)


router = APIRouter(
    prefix="/api/documents",
    tags=["data-moon-documents"],
)


class AdminDocumentWriteRequest(BaseModel):
    document: dict[str, Any] = Field(default_factory=dict)


class DocumentAggregationRequest(BaseModel):
    collection: str = Field(min_length=1, max_length=150)
    pipeline: list[dict[str, Any]] = Field(default_factory=list)
    limit: int = Field(default=250, ge=1, le=500)


class SavedVisualizationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    collection: str = Field(min_length=1, max_length=150)
    system_key: str | None = Field(default=None, max_length=150)
    dashboard_name: str = Field(default="EES Operations Overview", min_length=1, max_length=160)
    chart_type: str = Field(min_length=1, max_length=20)
    x_key: str = Field(min_length=1, max_length=150)
    y_key: str = Field(min_length=1, max_length=150)
    pipeline: list[dict[str, Any]] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)


READ_ONLY_BLOCKED_AGGREGATION_OPERATORS = {
    "$out",
    "$merge",
    "$function",
    "$accumulator",
    "$where",
    "$eval",
    "$mapReduce",
}


def _validate_read_only_pipeline(pipeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(pipeline) > 50:
        raise HTTPException(
            status_code=400,
            detail="Aggregation pipelines are limited to 50 stages.",
        )

    def inspect(value: Any) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if key in READ_ONLY_BLOCKED_AGGREGATION_OPERATORS:
                    raise HTTPException(
                        status_code=400,
                        detail=f"MongoDB aggregation operator {key} is blocked in Data Moon.",
                    )
                inspect(child)
        elif isinstance(value, list):
            for child in value:
                inspect(child)

    for index, stage in enumerate(pipeline):
        if not isinstance(stage, dict) or len(stage) != 1:
            raise HTTPException(
                status_code=400,
                detail=f"Aggregation stage {index + 1} must be a JSON object with exactly one stage operator.",
            )
        stage_name = next(iter(stage))
        if not isinstance(stage_name, str) or not stage_name.startswith("$"):
            raise HTTPException(
                status_code=400,
                detail=f"Aggregation stage {index + 1} must begin with a MongoDB stage operator.",
            )
        if stage_name in READ_ONLY_BLOCKED_AGGREGATION_OPERATORS:
            raise HTTPException(
                status_code=400,
                detail=f"MongoDB aggregation stage {stage_name} is blocked in Data Moon.",
            )
        inspect(stage)

    return pipeline


def _require_collection(collection_name: str):
    if collection_name not in collection_names():
        raise HTTPException(
            status_code=404,
            detail=f"Collection '{collection_name}' does not exist.",
        )
    return database()[collection_name]


def _object_id(document_id: str) -> ObjectId:
    try:
        return ObjectId(document_id)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid MongoDB ObjectId.",
        ) from exc


def _validate_write_document(document: dict[str, Any]) -> dict[str, Any]:
    if not document:
        raise HTTPException(
            status_code=400,
            detail="Document must contain at least one field.",
        )

    if "_id" in document:
        raise HTTPException(
            status_code=400,
            detail="The _id field is managed by MongoDB and cannot be written here.",
        )

    def inspect(value: Any, path: str = "document") -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if not isinstance(key, str):
                    raise HTTPException(
                        status_code=400,
                        detail=f"All document keys must be strings ({path}).",
                    )
                if key.startswith("$") or "." in key:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Field '{key}' is not allowed in web admin writes. "
                            "Field names cannot start with '$' or contain '.'."
                        ),
                    )
                inspect(child, f"{path}.{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                inspect(child, f"{path}[{index}]")

    inspect(document)
    return document


@router.get("/health")
def documents_health():
    try:
        result = ping()
        return {
            **result,
            "service": "EES Data Moon Document Engine",
            "mode": "read-only document gateway",
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/collections")
def collections():
    internal = {"saved_visualizations"}
    return {
        "database": mongodb_database_name(),
        "collections": [
            item for item in collection_summary()
            if item.get("name") not in internal
        ],
    }


@router.get("/collections/{collection_name}")
def browse_collection(
    collection_name: str,
    limit: int = Query(default=50, ge=1, le=500),
):
    documents = find_documents(
        collection_name=collection_name,
        query={},
        limit=limit,
    )
    return {
        "success": True,
        "collection": collection_name,
        "documents": documents,
        "document_count": len(documents),
    }


@router.get("/collections/{collection_name}/{document_id}")
def document(collection_name: str, document_id: str):
    return {
        "success": True,
        "collection": collection_name,
        "document": get_document(collection_name, document_id),
    }


@router.post("/query", response_model=DocumentQueryResponse)
def query_documents(body: DocumentQueryRequest):
    forbidden_operators = {
        "$where",
        "$function",
        "$accumulator",
    }

    def inspect(value: Any) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if key in forbidden_operators:
                    raise HTTPException(
                        status_code=400,
                        detail=f"MongoDB operator {key} is blocked in public mode.",
                    )
                inspect(child)
        elif isinstance(value, list):
            for child in value:
                inspect(child)

    inspect(body.filter)

    documents = find_documents(
        collection_name=body.collection,
        query=body.filter,
        limit=body.limit,
        sort_field=body.sort_field,
        sort_direction=body.sort_direction,
    )

    return {
        "success": True,
        "collection": body.collection,
        "documents": documents,
        "document_count": len(documents),
    }


@router.post("/aggregate")
def aggregate_documents(body: DocumentAggregationRequest):
    collection = _require_collection(body.collection)
    pipeline = _validate_read_only_pipeline(body.pipeline)
    started = time.perf_counter()

    try:
        cursor = collection.aggregate(
            pipeline,
            allowDiskUse=False,
            maxTimeMS=5000,
        )
        raw_results = list(islice(cursor, body.limit))
        results = [serialize_document(document) for document in raw_results]
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "success": True,
        "collection": body.collection,
        "results": results,
        "result_count": len(results),
        "duration_ms": round((time.perf_counter() - started) * 1000, 2),
        "read_only": True,
    }


# ============================================================
# SAVED VISUALIZATIONS / DASHBOARDS
# ============================================================

@router.get("/visualizations")
def saved_visualizations():
    collection = database()["saved_visualizations"]
    documents = collection.find({}).sort("created_at", -1).limit(200)
    items = [serialize_document(document) for document in documents]
    return {
        "success": True,
        "visualizations": items,
        "count": len(items),
    }


@router.post("/admin/visualizations")
def save_visualization(
    body: SavedVisualizationRequest,
    username: str = Depends(require_admin),
):
    if body.chart_type not in {"bar", "line", "scatter", "pie"}:
        raise HTTPException(status_code=400, detail="Unsupported chart type.")

    pipeline = _validate_read_only_pipeline(body.pipeline)
    payload = {
        "title": body.title.strip(),
        "collection": body.collection,
        "system_key": body.system_key.strip() if body.system_key else None,
        "dashboard_name": body.dashboard_name.strip(),
        "chart_type": body.chart_type,
        "x_key": body.x_key,
        "y_key": body.y_key,
        "pipeline": pipeline,
        "rows": body.rows[:200],
        "created_at": datetime.now(timezone.utc),
        "created_by": username,
    }
    result = database()["saved_visualizations"].insert_one(payload)
    created = database()["saved_visualizations"].find_one({"_id": result.inserted_id})
    return {
        "success": True,
        "visualization": serialize_document(created or {}),
    }


@router.delete("/admin/visualizations/{visualization_id}")
def delete_visualization(
    visualization_id: str,
    username: str = Depends(require_admin),
):
    object_id = _object_id(visualization_id)
    result = database()["saved_visualizations"].delete_one({"_id": object_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Saved visualization not found.")
    return {
        "success": True,
        "deleted": True,
        "visualization_id": visualization_id,
        "username": username,
    }


# ============================================================
# AUTHENTICATED DOCUMENT ADMIN
# ============================================================
# These routes reuse the same Data Moon admin session used by
# PostgreSQL Admin Mode. Public document routes above remain
# read-only.


@router.post("/admin/collections/{collection_name}")
def admin_create_document(
    collection_name: str,
    body: AdminDocumentWriteRequest,
    username: str = Depends(require_admin),
):
    collection = _require_collection(collection_name)
    payload = _validate_write_document(dict(body.document))

    result = collection.insert_one(payload)
    created = collection.find_one({"_id": result.inserted_id})

    return {
        "success": True,
        "action": "insert",
        "collection": collection_name,
        "document_id": str(result.inserted_id),
        "document": serialize_document(created or {}),
        "admin": True,
        "username": username,
    }


@router.patch("/admin/collections/{collection_name}/{document_id}")
def admin_update_document(
    collection_name: str,
    document_id: str,
    body: AdminDocumentWriteRequest,
    username: str = Depends(require_admin),
):
    collection = _require_collection(collection_name)
    object_id = _object_id(document_id)
    payload = _validate_write_document(dict(body.document))

    existing = collection.find_one({"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found.")

    result = collection.update_one(
        {"_id": object_id},
        {"$set": payload},
    )
    updated = collection.find_one({"_id": object_id})

    return {
        "success": True,
        "action": "update",
        "collection": collection_name,
        "document_id": document_id,
        "matched_count": result.matched_count,
        "modified_count": result.modified_count,
        "document": serialize_document(updated or {}),
        "admin": True,
        "username": username,
    }


@router.delete("/admin/collections/{collection_name}/{document_id}")
def admin_delete_document(
    collection_name: str,
    document_id: str,
    username: str = Depends(require_admin),
):
    collection = _require_collection(collection_name)
    object_id = _object_id(document_id)

    existing = collection.find_one({"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found.")

    result = collection.delete_one({"_id": object_id})

    return {
        "success": True,
        "action": "delete",
        "collection": collection_name,
        "document_id": document_id,
        "deleted_count": result.deleted_count,
        "admin": True,
        "username": username,
    }
