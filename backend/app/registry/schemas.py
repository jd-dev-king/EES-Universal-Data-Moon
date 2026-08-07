from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from ..connections.schemas import (
    ConnectionTestRequest,
)


SystemStatus = Literal[
    "active",
    "development",
    "offline",
    "archived",
]

ObjectType = Literal[
    "table",
    "view",
    "materialized_view",
    "file",
    "stream",
    "api",
]

SourceType = Literal[
    "postgresql",
    "csv",
    "parquet",
    "duckdb",
    "api",
    "stream",
    "nosql",
]

RefreshMode = Literal[
    "realtime",
    "scheduled",
    "event",
    "manual",
    "static",
]


class SystemCreate(BaseModel):
    system_name: str
    system_key: str

    domain: str
    system_type: str

    description: str | None = None

    status: SystemStatus = "active"

    data_role: str | None = None

    primary_database: str | None = None

    api_base_url: str | None = None

    repository_url: str | None = None

    owner_name: str | None = None


class SystemResponse(SystemCreate):
    system_id: UUID

    created_at: datetime
    updated_at: datetime


class DatasetCreate(BaseModel):
    system_id: UUID

    dataset_name: str
    dataset_key: str

    domain: str

    database_name: str | None = None

    schema_name: str | None = None

    object_name: str | None = None

    object_type: ObjectType | None = None

    source_type: SourceType

    classification: str = "operational"

    refresh_mode: RefreshMode = "manual"

    description: str | None = None

    is_active: bool = True


class DatasetResponse(DatasetCreate):
    dataset_id: UUID

    created_at: datetime
    updated_at: datetime


class RelationshipCreate(BaseModel):
    source_dataset_id: UUID
    target_dataset_id: UUID

    relationship_type: str

    description: str | None = None


class RelationshipResponse(
    RelationshipCreate
):
    relationship_id: UUID

    created_at: datetime


class RegistryOverviewResponse(BaseModel):
    success: bool

    systems: int
    datasets: int
    relationships: int

    active_systems: int
    active_datasets: int


# ------------------------------------------------------------
# DISCOVERY
# ------------------------------------------------------------


class DiscoveredObject(BaseModel):
    database_name: str

    schema_name: str
    object_name: str

    object_type: Literal[
        "table",
        "view",
        "materialized_view",
    ]

    dataset_key: str
    dataset_name: str

    column_count: int = 0

    estimated_rows: int | None = None


class RegistryDiscoveryPreviewRequest(BaseModel):
    system_id: UUID

    connection: ConnectionTestRequest

    include_schemas: list[str] | None = None

    exclude_schemas: list[str] = [
        "pg_catalog",
        "information_schema",
    ]


class RegistryDiscoveryPreviewResponse(BaseModel):
    success: bool

    message: str | None = None

    system_id: UUID

    database_name: str | None = None

    objects_found: int = 0

    tables: int = 0
    views: int = 0
    materialized_views: int = 0

    objects: list[
        DiscoveredObject
    ] = []


class RegistryDiscoveryRequest(BaseModel):
    system_id: UUID

    connection: ConnectionTestRequest

    include_schemas: list[str] | None = None

    exclude_schemas: list[str] = [
        "pg_catalog",
        "information_schema",
    ]

    classification: str = "operational"

    refresh_mode: RefreshMode = "manual"

    update_existing: bool = True


class RegistryDiscoveryResponse(BaseModel):
    success: bool

    message: str | None = None

    system_id: UUID

    database_name: str | None = None

    discovered: int = 0

    created: int = 0
    updated: int = 0
    skipped: int = 0

    datasets: list[
        DatasetResponse
    ] = []