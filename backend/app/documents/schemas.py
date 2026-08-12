from typing import Any

from pydantic import BaseModel, Field


class DocumentQueryRequest(
    BaseModel
):
    collection: str = Field(
        min_length=1,
        max_length=150,
    )

    filter: dict[str, Any] = Field(
        default_factory=dict,
    )

    limit: int = Field(
        default=100,
        ge=1,
        le=500,
    )

    sort_field: str | None = None

    sort_direction: int = Field(
        default=-1,
        ge=-1,
        le=1,
    )


class DocumentQueryResponse(
    BaseModel
):
    success: bool

    collection: str

    documents: list[
        dict[str, Any]
    ]

    document_count: int