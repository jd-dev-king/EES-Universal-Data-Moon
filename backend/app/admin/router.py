import os
import re
import time
from typing import Any

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from .auth import (
    clear_session,
    issue_session,
    require_admin,
    verify_password,
)


router = APIRouter(
    prefix="/api/admin",
    tags=["data-moon-admin"],
)

MAX_ROWS = int(
    os.getenv(
        "DATA_MOON_ADMIN_MAX_ROWS",
        "2000",
    )
)


# ============================================================
# SERVER-LEVEL OPERATIONS THAT WEB ADMIN MUST NEVER PERFORM
# ============================================================
#
# Authenticated Admin Mode is intended to behave like a normal
# database manager for ees_data_platform:
#
#   SELECT / INSERT / UPDATE / DELETE
#   CREATE / ALTER / DROP tables, views, indexes, schemas
#   transactions and multi-statement scripts
#
# But it is NOT PostgreSQL server administration.
#

BLOCKED_ADMIN_SQL = [
    re.compile(
        r"\bALTER\s+SYSTEM\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bCREATE\s+(ROLE|USER)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bALTER\s+(ROLE|USER)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bDROP\s+(ROLE|USER)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bCREATE\s+DATABASE\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bDROP\s+DATABASE\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bGRANT\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bREVOKE\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bCOPY\b[\s\S]*\bPROGRAM\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bCREATE\s+EXTENSION\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bDROP\s+EXTENSION\b",
        re.IGNORECASE,
    ),
]


class LoginRequest(BaseModel):
    username: str = Field(
        min_length=1,
        max_length=150,
    )

    password: str = Field(
        min_length=1,
        max_length=500,
    )


class AdminQueryRequest(BaseModel):
    sql: str = Field(
        min_length=1,
    )

    limit: int = Field(
        default=1000,
        ge=1,
        le=MAX_ROWS,
    )


def db_url() -> str:
    value = (
        os.getenv("DATABASE_URL")
        or os.getenv("EES_DATABASE_URL")
    )

    if not value:
        raise HTTPException(
            status_code=503,
            detail=(
                "EES database connection "
                "is not configured."
            ),
        )

    return value


def json_safe(value: Any) -> Any:
    if value is None or isinstance(
        value,
        (
            str,
            int,
            float,
            bool,
        ),
    ):
        return value

    return str(value)


def validate_admin_sql(
    statement: str,
) -> str:
    cleaned = statement.strip()

    if not cleaned:
        raise HTTPException(
            status_code=400,
            detail="SQL script is empty.",
        )

    for pattern in BLOCKED_ADMIN_SQL:
        if pattern.search(cleaned):
            raise HTTPException(
                status_code=400,
                detail=(
                    "This PostgreSQL server-level "
                    "operation is blocked in Data "
                    "Moon Web Admin."
                ),
            )

    return cleaned


@router.post("/login")
def login(
    body: LoginRequest,
    response: Response,
):
    expected_user = os.getenv(
        "DATA_MOON_ADMIN_USERNAME",
        "admin",
    )

    if (
        body.username != expected_user
        or not verify_password(
            body.password,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid admin credentials.",
        )

    issue_session(
        response,
        body.username,
    )

    return {
        "authenticated": True,
        "username": body.username,
    }


@router.post("/logout")
def logout(
    response: Response,
):
    clear_session(
        response,
    )

    return {
        "authenticated": False,
    }


@router.get("/session")
def session(
    username: str = Depends(
        require_admin,
    ),
):
    return {
        "authenticated": True,
        "username": username,
    }


@router.post("/query")
def query(
    body: AdminQueryRequest,
    request: Request,
    username: str = Depends(
        require_admin,
    ),
):
    statement = validate_admin_sql(
        body.sql,
    )

    started = time.perf_counter()

    try:
        #
        # autocommit=True is deliberate here.
        #
        # It permits scripts containing explicit:
        #
        # BEGIN;
        # ...
        # COMMIT;
        #
        # PostgreSQL still handles a multi-command
        # simple-query message transactionally.
        #
        with psycopg.connect(
            db_url(),
            autocommit=True,
        ) as conn:

            with conn.cursor() as cur:

                #
                # prepare=False is important.
                # PostgreSQL prepared statements do
                # not support multiple SQL commands.
                #
                cur.execute(
                    statement,
                    prepare=False,
                )

                result_sets = []
                total_affected = 0

                #
                # Psycopg supports nextset() for
                # multi-statement SQL results.
                #
                while True:
                    command_status = (
                        cur.statusmessage
                        or "OK"
                    )

                    if cur.description:
                        columns = [
                            description.name
                            for description
                            in cur.description
                        ]

                        raw_rows = cur.fetchmany(
                            body.limit
                        )

                        rows = [
                            [
                                json_safe(value)
                                for value in row
                            ]
                            for row in raw_rows
                        ]

                        row_count = len(
                            rows
                        )

                    else:
                        columns = []
                        rows = []

                        row_count = max(
                            cur.rowcount,
                            0,
                        )

                    total_affected += (
                        row_count
                    )

                    result_sets.append(
                        {
                            "command": (
                                command_status
                            ),
                            "columns": columns,
                            "rows": rows,
                            "row_count": (
                                row_count
                            ),
                        }
                    )

                    if not cur.nextset():
                        break

        #
        # The existing frontend expects one
        # columns/rows result, so expose the LAST
        # result set as the primary result while
        # also returning all statement results.
        #

        final_result = (
            result_sets[-1]
            if result_sets
            else {
                "command": "OK",
                "columns": [],
                "rows": [],
                "row_count": 0,
            }
        )

        duration_ms = round(
            (
                time.perf_counter()
                - started
            )
            * 1000,
            2,
        )

        return {
            "success": True,

            "message": (
                f"{len(result_sets)} "
                "statement(s) executed."
            ),

            "columns": (
                final_result["columns"]
            ),

            "rows": (
                final_result["rows"]
            ),

            "row_count": (
                final_result["row_count"]
            ),

            "duration_ms": (
                duration_ms
            ),

            "admin": True,

            "statements_executed": (
                len(result_sets)
            ),

            "total_affected": (
                total_affected
            ),

            "results": (
                result_sets
            ),

            "username": username,
        }

    except psycopg.Error as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )