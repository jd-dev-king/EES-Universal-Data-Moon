from typing import Literal

from pydantic import BaseModel


AiProvider = Literal[
    "openai",
    "ollama",
]


class AiStatusResponse(BaseModel):
    success: bool

    provider: AiProvider

    configured: bool

    model: str | None = None

    message: str | None = None


class AiGenerateSqlRequest(BaseModel):
    prompt: str

    database_name: str | None = None

    schema_context: str | None = None

    current_sql: str | None = None


class AiGenerateSqlResponse(BaseModel):
    success: bool

    sql: str | None = None

    explanation: str | None = None

    warning: str | None = None

    model: str | None = None

    message: str | None = None