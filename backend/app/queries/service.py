import re
import time
from typing import Any

import psycopg

from ..connections.catalog import build_conninfo
from .schemas import QueryRunRequest, QueryRunResponse


MAX_ROWS = 1000
FORBIDDEN_SQL = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|do)\b",
    re.IGNORECASE,
)


def make_json_safe(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(
        value,
        (str, int, float, bool),
    ):
        return value

    return str(value)


def run_query(
    request: QueryRunRequest,
) -> QueryRunResponse:
    sql = request.sql.strip()

    if not sql:
        return QueryRunResponse(
            success=False,
            message="SQL query is empty.",
        )

    normalized = sql.rstrip(";").strip()
    if ";" in normalized or FORBIDDEN_SQL.search(normalized):
        return QueryRunResponse(
            success=False,
            message="Only a single read-only query is allowed.",
        )
    if not normalized.lower().startswith(("select ", "with ", "explain ")):
        return QueryRunResponse(
            success=False,
            message="Only SELECT, WITH ... SELECT, and EXPLAIN queries are allowed.",
        )
    sql = normalized

    started = time.perf_counter()

    try:
        conninfo = build_conninfo(
            request.connection
        )

        with psycopg.connect(conninfo, options="-c default_transaction_read_only=on") as connection:
            with connection.cursor() as cursor:
                cursor.execute(sql)

                columns: list[str] = []
                rows: list[list[Any]] = []

                if cursor.description:
                    columns = [
                        column.name
                        for column in cursor.description
                    ]

                    fetched = cursor.fetchmany(
                        MAX_ROWS
                    )

                    rows = [
                        [
                            make_json_safe(value)
                            for value in row
                        ]
                        for row in fetched
                    ]

                    row_count = len(rows)

                else:
                    row_count = (
                        cursor.rowcount
                        if cursor.rowcount >= 0
                        else 0
                    )


        duration_ms = (
            time.perf_counter() - started
        ) * 1000

        return QueryRunResponse(
            success=True,
            columns=columns,
            rows=rows,
            row_count=row_count,
            duration_ms=round(
                duration_ms,
                2,
            ),
        )

    except psycopg.Error as exc:
        duration_ms = (
            time.perf_counter() - started
        ) * 1000

        return QueryRunResponse(
            success=False,
            message=str(exc),
            duration_ms=round(
                duration_ms,
                2,
            ),
        )

    except Exception as exc:
        duration_ms = (
            time.perf_counter() - started
        ) * 1000

        return QueryRunResponse(
            success=False,
            message=f"Unexpected query error: {exc}",
            duration_ms=round(
                duration_ms,
                2,
            ),
        )