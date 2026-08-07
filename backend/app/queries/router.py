from fastapi import APIRouter

from .schemas import QueryRunRequest, QueryRunResponse
from .service import run_query


router = APIRouter(
    prefix="/queries",
    tags=["queries"],
)


@router.post(
    "/run",
    response_model=QueryRunResponse,
)
def execute_query(
    request: QueryRunRequest,
) -> QueryRunResponse:
    return run_query(request)