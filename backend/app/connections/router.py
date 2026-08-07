from fastapi import APIRouter

from .catalog import load_database_catalog

from .service import test_connection
from .metadata import load_object_metadata
from .schemas import (ConnectionTestRequest, ConnectionTestResponse, ObjectMetadataRequest, ObjectMetadataResponse,)


# API Router for connection-related endpoints
router = APIRouter(
    prefix="/connections",
    tags=["connections"],
)


# Endpoint to test database connection
@router.post(
    "/test",
    response_model=ConnectionTestResponse,
)
def test_database_connection(
    request: ConnectionTestRequest,
) -> ConnectionTestResponse:
    return test_connection(request)


@router.post("/catalog")
def get_database_catalog(
    request: ConnectionTestRequest,
):
    try:
        return {
            "success": True,
            **load_database_catalog(request),
        }

    except Exception as exc:
        return {
            "success": False,
            "message": str(exc),
            "database": None,
            "schemas": [],
        }
        
# Endpoint to retrieve metadata for a specific database object
@router.post(
    "/object-metadata",
    response_model=ObjectMetadataResponse,
)
def get_object_metadata(
    request: ObjectMetadataRequest,
) -> ObjectMetadataResponse:
    try:
        result = load_object_metadata(
            request.connection,
            request.schema_name,
            request.object_name,
        )

        return ObjectMetadataResponse(
            success=True,
            **result,
        )

    except Exception as exc:
        return ObjectMetadataResponse(
            success=False,
            message=str(exc),
        )        