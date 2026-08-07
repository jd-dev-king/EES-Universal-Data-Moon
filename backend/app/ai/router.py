from fastapi import APIRouter

from .schemas import (
    AiGenerateSqlRequest,
    AiGenerateSqlResponse,
    AiStatusResponse,
)

from .service import (
    generate_sql,
    get_ai_status,
)


router = APIRouter(
    prefix="/ai",
    tags=["ai"],
)


@router.get(
    "/status",
    response_model=AiStatusResponse,
)
def ai_status() -> AiStatusResponse:
    return get_ai_status()


@router.post(
    "/generate-sql",
    response_model=AiGenerateSqlResponse,
)
def ai_generate_sql(
    request: AiGenerateSqlRequest,
) -> AiGenerateSqlResponse:
    return generate_sql(
        request
    )