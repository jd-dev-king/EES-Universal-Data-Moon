from typing import Any, Literal

from pydantic import BaseModel

from ..connections.schemas import ConnectionTestRequest


ImportMode = Literal[
    "create",
    "append",
    "replace",
]


class CsvColumnPreview(BaseModel):
    source_name: str
    postgres_name: str
    inferred_type: str
    nullable: bool


class CsvPreviewRequest(BaseModel):
    file_path: str


class CsvPreviewResponse(BaseModel):
    success: bool
    message: str | None = None

    file_name: str | None = None
    delimiter: str | None = None
    encoding: str | None = None

    total_rows: int = 0

    columns: list[CsvColumnPreview] = []

    preview_rows: list[
        dict[str, Any]
    ] = []


class CsvValidationRequest(BaseModel):
    connection: ConnectionTestRequest

    file_path: str

    schema_name: str
    table_name: str

    mode: ImportMode

    columns: list[
        CsvColumnPreview
    ]


class CsvValidationResponse(BaseModel):
    success: bool
    valid: bool

    message: str | None = None

    table_exists: bool = False

    source_rows: int = 0

    destination_columns: list[
        dict[str, Any]
    ] = []

    warnings: list[str] = []


class CsvRejectedRow(BaseModel):
    row_number: int
    reason: str
    row: dict[str, Any]


class CsvImportRequest(BaseModel):
    connection: ConnectionTestRequest

    file_path: str

    schema_name: str
    table_name: str

    mode: ImportMode = "create"

    columns: list[
        CsvColumnPreview
    ]


class CsvImportResponse(BaseModel):
    success: bool
    message: str | None = None

    schema_name: str | None = None
    table_name: str | None = None

    mode: ImportMode | None = None

    rows_read: int = 0
    rows_imported: int = 0
    rows_rejected: int = 0

    rejected_rows: list[
        CsvRejectedRow
    ] = []

    duration_ms: float = 0