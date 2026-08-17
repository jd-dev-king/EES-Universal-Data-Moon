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

# ============================================================
# DEMO SESSION / RESET ADMINISTRATION
# ============================================================

class ResetRequestDecision(BaseModel):
    status: str = Field(min_length=1, max_length=80)
    admin_note: str | None = Field(default=None, max_length=1000)


class DemoAdminOperationRequest(BaseModel):
    confirmation: str = Field(min_length=1, max_length=80)
    admin_note: str | None = Field(default=None, max_length=1000)


class AdminTableRowUpdate(BaseModel):
    primary_key: dict[str, Any]
    changes: dict[str, Any]


class AdminTableRowCreate(BaseModel):
    values: dict[str, Any]


class AdminTableRowDelete(BaseModel):
    primary_key: dict[str, Any]


ALLOWED_RESET_STATUSES = {
    "Requested",
    "Pending Admin Reconciliation",
    "Approved",
    "Completed",
    "Rejected",
}


def _relation_exists(cur, qualified_name: str) -> bool:
    cur.execute("SELECT to_regclass(%s)", (qualified_name,))
    row = cur.fetchone()
    return bool(row and row[0])



# ============================================================
# ADMIN TABLE EDITOR
# ============================================================

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _safe_identifier(value: str, label: str) -> str:
    if not _IDENTIFIER.fullmatch(value or ""):
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return value


def _table_editor_metadata(cur, schema_name: str, table_name: str):
    schema_name = _safe_identifier(schema_name, "schema name")
    table_name = _safe_identifier(table_name, "table name")

    cur.execute("""
        SELECT table_type
        FROM information_schema.tables
        WHERE table_schema=%s
          AND table_name=%s
    """, (schema_name, table_name))
    table = cur.fetchone()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found.")
    if table[0] != "BASE TABLE":
        raise HTTPException(status_code=409, detail="Only base tables can be edited.")

    cur.execute("""
        SELECT
            column_name,
            data_type,
            udt_name,
            is_nullable='YES' AS nullable,
            column_default,
            is_identity='YES' AS identity_column,
            is_generated <> 'NEVER' AS generated_column,
            ordinal_position
        FROM information_schema.columns
        WHERE table_schema=%s
          AND table_name=%s
        ORDER BY ordinal_position
    """, (schema_name, table_name))
    columns = [
        {
            "name": row[0],
            "data_type": row[1],
            "udt_name": row[2],
            "nullable": bool(row[3]),
            "default": row[4],
            "identity": bool(row[5]),
            "generated": bool(row[6]),
            "ordinal_position": row[7],
        }
        for row in cur.fetchall()
    ]

    cur.execute("""
        SELECT a.attname
        FROM pg_index i
        JOIN pg_class t ON t.oid=i.indrelid
        JOIN pg_namespace n ON n.oid=t.relnamespace
        JOIN unnest(i.indkey) WITH ORDINALITY keys(attnum,ord) ON true
        JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=keys.attnum
        WHERE n.nspname=%s
          AND t.relname=%s
          AND i.indisprimary
        ORDER BY keys.ord
    """, (schema_name, table_name))
    primary_key = [row[0] for row in cur.fetchall()]

    if not primary_key:
        raise HTTPException(
            status_code=409,
            detail="Admin Table Editor requires a primary key so row changes are deterministic.",
        )

    return schema_name, table_name, columns, primary_key


def _editor_cast_expression(column: dict[str, Any]) -> str:
    udt = str(column["udt_name"] or "")
    if not _IDENTIFIER.fullmatch(udt):
        raise HTTPException(status_code=409, detail=f"Unsupported PostgreSQL type for {column['name']}.")
    return f"%s::{udt}"


@router.get("/table-editor/{schema_name}/{table_name}")
def admin_table_editor_rows(
    schema_name: str,
    table_name: str,
    limit: int = 100,
    offset: int = 0,
    username: str = Depends(require_admin),
):
    limit = max(1, min(int(limit), 500))
    offset = max(0, int(offset))

    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            schema_name, table_name, columns, primary_key = _table_editor_metadata(
                cur, schema_name, table_name
            )
            order_sql = ", ".join(f'"{name}"' for name in primary_key)
            cur.execute(
                f'SELECT * FROM "{schema_name}"."{table_name}" '
                f'ORDER BY {order_sql} LIMIT %s OFFSET %s',
                (limit, offset),
            )
            rows = [[json_safe(value) for value in row] for row in cur.fetchall()]

            cur.execute(f'SELECT count(*) FROM "{schema_name}"."{table_name}"')
            total_rows = int(cur.fetchone()[0])

    return {
        "schema": schema_name,
        "table": table_name,
        "admin": username,
        "columns": columns,
        "primary_key": primary_key,
        "rows": rows,
        "row_count": len(rows),
        "total_rows": total_rows,
        "limit": limit,
        "offset": offset,
    }


@router.patch("/table-editor/{schema_name}/{table_name}")
def admin_table_editor_update(
    schema_name: str,
    table_name: str,
    body: AdminTableRowUpdate,
    username: str = Depends(require_admin),
):
    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            schema_name, table_name, columns, primary_key = _table_editor_metadata(
                cur, schema_name, table_name
            )
            column_map = {column["name"]: column for column in columns}

            if set(body.primary_key) != set(primary_key):
                raise HTTPException(status_code=409, detail="Complete primary key values are required.")

            forbidden = set(primary_key)
            clean_changes = {
                key: value
                for key, value in body.changes.items()
                if key in column_map
                and key not in forbidden
                and not column_map[key]["identity"]
                and not column_map[key]["generated"]
            }
            if not clean_changes:
                raise HTTPException(status_code=400, detail="No editable column changes were supplied.")

            assignments = []
            params: list[Any] = []
            for key, value in clean_changes.items():
                if value is None:
                    assignments.append(f'"{key}"=NULL')
                else:
                    assignments.append(f'"{key}"={_editor_cast_expression(column_map[key])}')
                    params.append(value)

            predicates = []
            for key in primary_key:
                value = body.primary_key[key]
                if value is None:
                    predicates.append(f'"{key}" IS NULL')
                else:
                    predicates.append(f'"{key}"={_editor_cast_expression(column_map[key])}')
                    params.append(value)

            cur.execute(
                f'UPDATE "{schema_name}"."{table_name}" '
                f'SET {", ".join(assignments)} '
                f'WHERE {" AND ".join(predicates)}',
                params,
            )
            affected = cur.rowcount
            if affected != 1:
                raise HTTPException(status_code=409, detail=f"Expected one row update; affected {affected}.")

            _record_demo_admin_action(
                cur,
                username,
                "TABLE_EDITOR_UPDATE",
                None,
                f"{schema_name}.{table_name};pk={body.primary_key};columns={list(clean_changes)}",
            )
        conn.commit()

    return {"success": True, "affected": affected}


@router.post("/table-editor/{schema_name}/{table_name}")
def admin_table_editor_create(
    schema_name: str,
    table_name: str,
    body: AdminTableRowCreate,
    username: str = Depends(require_admin),
):
    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            schema_name, table_name, columns, primary_key = _table_editor_metadata(
                cur, schema_name, table_name
            )
            column_map = {column["name"]: column for column in columns}
            values = {
                key: value
                for key, value in body.values.items()
                if key in column_map
                and not column_map[key]["identity"]
                and not column_map[key]["generated"]
            }
            if not values:
                raise HTTPException(status_code=400, detail="No insert values were supplied.")

            names = []
            expressions = []
            params: list[Any] = []
            for key, value in values.items():
                names.append(f'"{key}"')
                if value is None:
                    expressions.append("NULL")
                else:
                    expressions.append(_editor_cast_expression(column_map[key]))
                    params.append(value)

            returning = ", ".join(f'"{key}"' for key in primary_key)
            cur.execute(
                f'INSERT INTO "{schema_name}"."{table_name}" '
                f'({", ".join(names)}) VALUES ({", ".join(expressions)}) '
                f'RETURNING {returning}',
                params,
            )
            pk_values = cur.fetchone()

            _record_demo_admin_action(
                cur,
                username,
                "TABLE_EDITOR_INSERT",
                None,
                f"{schema_name}.{table_name};columns={list(values)}",
            )
        conn.commit()

    return {
        "success": True,
        "primary_key": dict(zip(primary_key, [json_safe(v) for v in pk_values])),
    }


@router.delete("/table-editor/{schema_name}/{table_name}")
def admin_table_editor_delete(
    schema_name: str,
    table_name: str,
    body: AdminTableRowDelete,
    username: str = Depends(require_admin),
):
    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            schema_name, table_name, columns, primary_key = _table_editor_metadata(
                cur, schema_name, table_name
            )
            column_map = {column["name"]: column for column in columns}

            if set(body.primary_key) != set(primary_key):
                raise HTTPException(status_code=409, detail="Complete primary key values are required.")

            predicates = []
            params: list[Any] = []
            for key in primary_key:
                value = body.primary_key[key]
                if value is None:
                    predicates.append(f'"{key}" IS NULL')
                else:
                    predicates.append(f'"{key}"={_editor_cast_expression(column_map[key])}')
                    params.append(value)

            cur.execute(
                f'DELETE FROM "{schema_name}"."{table_name}" '
                f'WHERE {" AND ".join(predicates)}',
                params,
            )
            affected = cur.rowcount
            if affected != 1:
                raise HTTPException(status_code=409, detail=f"Expected one row delete; affected {affected}.")

            _record_demo_admin_action(
                cur,
                username,
                "TABLE_EDITOR_DELETE",
                None,
                f"{schema_name}.{table_name};pk={body.primary_key}",
            )
        conn.commit()

    return {"success": True, "affected": affected}


@router.get("/demo/overview")
def demo_admin_overview(username: str = Depends(require_admin)):
    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            sessions = 0
            active_sessions = 0
            pending_requests = 0
            total_requests = 0

            if _relation_exists(cur, "public.demo_sessions"):
                cur.execute("SELECT count(*), count(*) FILTER (WHERE lower(status)='active') FROM public.demo_sessions")
                sessions, active_sessions = cur.fetchone()

            if _relation_exists(cur, "public.demo_reset_requests"):
                cur.execute("""
                    SELECT
                        count(*) FILTER (
                            WHERE lower(status) IN ('requested','pending admin reconciliation','approved')
                        ) AS open_requests,
                        count(*) FILTER (
                            WHERE lower(status) IN ('requested','pending admin reconciliation')
                        ) AS pending_review
                    FROM public.demo_reset_requests
                """)
                total_requests, pending_requests = cur.fetchone()

    return {
        "admin": username,
        "sessions": sessions,
        "active_sessions": active_sessions,
        "reset_requests": total_requests,
        "pending_reset_requests": pending_requests,
    }


@router.get("/demo/sessions")
def demo_sessions(username: str = Depends(require_admin)):
    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            if not _relation_exists(cur, "public.demo_sessions"):
                return {"rows": [], "message": "demo_sessions is not installed yet."}

            cur.execute("""
                SELECT
                    s.session_id,
                    s.status,
                    s.created_at,
                    s.last_seen_at,
                    count(e.entity_id) FILTER (WHERE e.active) AS active_entities,
                    string_agg(
                        CASE WHEN e.active THEN e.entity_type || ':' || e.entity_id END,
                        ', ' ORDER BY e.entity_type, e.entity_id
                    ) AS entities
                FROM public.demo_sessions s
                LEFT JOIN public.demo_session_entities e
                  ON e.session_id=s.session_id
                GROUP BY s.session_id,s.status,s.created_at,s.last_seen_at
                ORDER BY s.last_seen_at DESC
                LIMIT 500
            """)
            rows = cur.fetchall()

    return {
        "rows": [
            {
                "session_id": r[0], "status": r[1],
                "created_at": json_safe(r[2]), "last_seen_at": json_safe(r[3]),
                "active_entities": r[4], "entities": r[5],
            }
            for r in rows
        ]
    }


@router.get("/demo/reset-requests")
def demo_reset_requests(username: str = Depends(require_admin)):
    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            if not _relation_exists(cur, "public.demo_reset_requests"):
                return {"rows": [], "message": "demo_reset_requests is not installed yet."}

            cur.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema='public'
                  AND table_name='demo_reset_requests'
            """)
            columns = {r[0] for r in cur.fetchall()}

            if "request_id" in columns:
                select_admin_note = "admin_note" if "admin_note" in columns else "NULL::text AS admin_note"
                select_reviewed_by = "reviewed_by" if "reviewed_by" in columns else "NULL::text AS reviewed_by"
                select_reviewed_at = "reviewed_at" if "reviewed_at" in columns else "NULL::timestamptz AS reviewed_at"
                cur.execute(f"""
                    SELECT request_id,session_id,reset_scope,operator,reason,status,
                           requested_at,completed_at,
                           {select_admin_note},{select_reviewed_by},{select_reviewed_at}
                    FROM public.demo_reset_requests
                    WHERE lower(status) NOT IN ('completed','rejected')
                    ORDER BY requested_at DESC
                    LIMIT 500
                """)
                rows = [{
                    "request_id": r[0], "session_id": r[1], "reset_scope": r[2],
                    "operator": r[3], "reason": r[4], "status": r[5],
                    "requested_at": json_safe(r[6]), "completed_at": json_safe(r[7]),
                    "admin_note": r[8], "reviewed_by": r[9], "reviewed_at": json_safe(r[10]),
                } for r in cur.fetchall()]
            else:
                cur.execute("""
                    SELECT reset_request_id::text,demo_session_id,reset_scope,requested_by,
                           reason,status,requested_at,reviewed_at,admin_note,reviewed_by,reviewed_at
                    FROM public.demo_reset_requests
                    WHERE lower(status) NOT IN ('completed','rejected')
                    ORDER BY requested_at DESC
                    LIMIT 500
                """)
                rows = [{
                    "request_id": r[0], "session_id": r[1], "reset_scope": r[2],
                    "operator": r[3], "reason": r[4], "status": r[5],
                    "requested_at": json_safe(r[6]), "completed_at": json_safe(r[7]),
                    "admin_note": r[8], "reviewed_by": r[9], "reviewed_at": json_safe(r[10]),
                } for r in cur.fetchall()]

    return {"rows": rows}



@router.get("/demo/reset-history")
def demo_reset_history(username: str = Depends(require_admin)):
    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            if not _relation_exists(cur, "public.demo_reset_requests"):
                return {"rows": []}
            cur.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema='public'
                  AND table_name='demo_reset_requests'
            """)
            columns = {r[0] for r in cur.fetchall()}
            if "request_id" in columns:
                admin_note = "admin_note" if "admin_note" in columns else "NULL::text"
                reviewed_by = "reviewed_by" if "reviewed_by" in columns else "NULL::text"
                reviewed_at = "reviewed_at" if "reviewed_at" in columns else "NULL::timestamptz"
                cur.execute(f"""
                    SELECT request_id,session_id,operator,reason,status,requested_at,
                           completed_at,{admin_note},{reviewed_by},{reviewed_at}
                    FROM public.demo_reset_requests
                    WHERE lower(status) IN ('completed','rejected')
                    ORDER BY COALESCE(completed_at,requested_at) DESC
                    LIMIT 250
                """)
            else:
                cur.execute("""
                    SELECT reset_request_id::text,demo_session_id,requested_by,reason,status,
                           requested_at,reviewed_at,admin_note,reviewed_by,reviewed_at
                    FROM public.demo_reset_requests
                    WHERE lower(status) IN ('completed','rejected')
                    ORDER BY COALESCE(reviewed_at,requested_at) DESC
                    LIMIT 250
                """)
            rows = [{
                "request_id":r[0],"session_id":r[1],"operator":r[2],"reason":r[3],
                "status":r[4],"requested_at":json_safe(r[5]),"completed_at":json_safe(r[6]),
                "admin_note":r[7],"reviewed_by":r[8],"reviewed_at":json_safe(r[9]),
            } for r in cur.fetchall()]
    return {"rows": rows}



def _active_demo_session_count(cur) -> int:
    if not _relation_exists(cur, "public.demo_sessions"):
        return 0
    cur.execute("SELECT count(*) FROM public.demo_sessions WHERE lower(status)='active'")
    return int(cur.fetchone()[0])


def _record_demo_admin_action(cur, username: str, action_type: str, admin_note: str | None, details: str | None = None):
    if not _relation_exists(cur, "public.demo_admin_actions"):
        return
    cur.execute("""
        INSERT INTO public.demo_admin_actions(
            action_id,action_type,performed_by,admin_note,details,performed_at
        )
        VALUES(
            'ADMIN-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,12)),
            %s,%s,%s,%s,now()
        )
    """, (action_type, username, admin_note, details))


@router.patch("/demo/reset-requests/{request_id}")
def review_demo_reset_request(
    request_id: str,
    body: ResetRequestDecision,
    username: str = Depends(require_admin),
):
    if body.status not in ALLOWED_RESET_STATUSES:
        raise HTTPException(status_code=400, detail="Unsupported reset-request status.")

    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            if not _relation_exists(cur, "public.demo_reset_requests"):
                raise HTTPException(status_code=404, detail="demo_reset_requests is not installed.")

            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema='public' AND table_name='demo_reset_requests'
            """)
            columns = {r[0] for r in cur.fetchall()}

            if "request_id" in columns:
                cur.execute("""
                    SELECT status,session_id
                    FROM public.demo_reset_requests
                    WHERE request_id=%s
                    FOR UPDATE
                """, (request_id,))
                current = cur.fetchone()
                if not current:
                    raise HTTPException(status_code=404, detail="Reset request not found.")

                current_status, session_id = current

                if body.status == "Completed" and current_status != "Approved":
                    raise HTTPException(status_code=409, detail="A reset request must be Approved before it can be Completed.")
                if current_status in {"Completed", "Rejected"} and body.status != current_status:
                    raise HTTPException(status_code=409, detail=f"Reset request is already terminal ({current_status}).")

                assignments = ["status=%s"]
                params: list[Any] = [body.status]
                completed = body.status in {"Completed", "Rejected"}

                if "completed_at" in columns:
                    assignments.append("completed_at=CASE WHEN %s THEN now() ELSE completed_at END")
                    params.append(completed)
                if "admin_note" in columns:
                    assignments.append("admin_note=%s")
                    params.append(body.admin_note)
                if "reviewed_by" in columns:
                    assignments.append("reviewed_by=%s")
                    params.append(username)
                if "reviewed_at" in columns:
                    assignments.append("reviewed_at=now()")

                params.append(request_id)
                cur.execute(
                    f"UPDATE public.demo_reset_requests SET {', '.join(assignments)} WHERE request_id=%s",
                    params,
                )

                if _relation_exists(cur, "public.demo_sessions") and session_id:
                    session_status = {
                        "Approved": "Reset Approved",
                        "Completed": "Reset Complete",
                        "Rejected": "Reset Rejected",
                    }.get(body.status)
                    if session_status:
                        cur.execute("""
                            UPDATE public.demo_sessions
                               SET status=%s,last_seen_at=now()
                             WHERE session_id=%s
                        """, (session_status, session_id))
            else:
                cur.execute("""
                    UPDATE public.demo_reset_requests
                       SET status=%s,reviewed_by=%s,reviewed_at=now(),admin_note=%s
                     WHERE reset_request_id::text=%s
                """, (body.status, username, body.admin_note, request_id))
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Reset request not found.")

            _record_demo_admin_action(
                cur, username,
                f"RESET_REQUEST_{body.status.upper().replace(' ','_')}",
                body.admin_note,
                f"request_id={request_id}",
            )
        conn.commit()

    return {
        "success": True,
        "request_id": request_id,
        "status": body.status,
        "reviewed_by": username,
        "admin_note": body.admin_note,
    }


@router.get("/demo/baseline-status")
def demo_baseline_status(username: str = Depends(require_admin)):
    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            active_sessions = _active_demo_session_count(cur)

            counts = {}
            for name, key in [
                ("public.demo_supply_lot_baseline", "supply_baseline_rows"),
                ("public.demo_staging_baseline", "staging_baseline_rows"),
                ("public.demo_bulk_tank_baseline", "bulk_baseline_rows"),
            ]:
                if _relation_exists(cur, name):
                    cur.execute(f"SELECT count(*) FROM {name}")
                    counts[key] = int(cur.fetchone()[0])
                else:
                    counts[key] = 0

            pool_next = None
            pool_generation = None
            if _relation_exists(cur, "public.demo_po_pool_control"):
                cur.execute("""
                    SELECT next_po_number,generation
                    FROM public.demo_po_pool_control
                    WHERE pool_key='PHARMA_DEMO'
                """)
                row = cur.fetchone()
                if row:
                    pool_next, pool_generation = row

    return {
        "admin": username,
        "active_sessions": active_sessions,
        "safe_for_global_reconciliation": active_sessions == 0,
        **counts,
        "po_pool_next": pool_next,
        "po_pool_generation": pool_generation,
    }


@router.post("/demo/restore-inventory-baseline")
def restore_demo_inventory_baseline(
    body: DemoAdminOperationRequest,
    username: str = Depends(require_admin),
):
    if body.confirmation.strip().upper() != "RESTORE INVENTORY":
        raise HTTPException(status_code=409, detail='Type "RESTORE INVENTORY" to confirm baseline restoration.')

    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            active_sessions = _active_demo_session_count(cur)
            if active_sessions:
                raise HTTPException(
                    status_code=409,
                    detail=f"Inventory restoration blocked: {active_sessions} active demo session(s) remain.",
                )

            required = [
                "public.demo_supply_lot_baseline",
                "public.demo_staging_baseline",
                "public.demo_bulk_tank_baseline",
                "supply.material_lots",
                "public.material_positions",
                "public.bulk_tanks",
            ]
            missing = [name for name in required if not _relation_exists(cur, name)]
            if missing:
                raise HTTPException(
                    status_code=409,
                    detail="Baseline restoration is not fully installed: " + ", ".join(missing),
                )

            # Governed Warehouse demo baseline.
            #
            # IMPORTANT: supply.material_lots has a CHECK constraint on status.
            # "Released" is a QA mirror label used by some Pharma screens, but it
            # is NOT a valid supply.material_lots status. Fresh Warehouse stock
            # must use "Available".
            #
            # Keep the saved baseline deterministic so either admin reset action
            # restores the same starting state.
            cur.execute("""
                UPDATE public.demo_supply_lot_baseline
                   SET available_quantity=6000.000,
                       reserved_quantity=0.000,
                       status='available'
            """)

            # Record BEFORE values for a deterministic verification response.
            cur.execute("""
                SELECT
                    count(*),
                    COALESCE(sum(available_quantity),0),
                    COALESCE(sum(reserved_quantity),0)
                FROM supply.material_lots
                WHERE internal_lot_number IN (
                    SELECT internal_lot_number
                    FROM public.demo_supply_lot_baseline
                )
            """)
            before_supply = cur.fetchone()

            cur.execute("""
                SELECT count(*),COALESCE(sum(quantity),0)
                FROM public.material_positions
                WHERE location_code IN ('CW-STAGE-01','CW-HAZ-01')
            """)
            before_staging = cur.fetchone()

            cur.execute("""
                SELECT count(*),COALESCE(sum(quantity_kg),0)
                FROM public.bulk_tanks
                WHERE tank_code IN (SELECT tank_code FROM public.demo_bulk_tank_baseline)
            """)
            before_bulk = cur.fetchone()

            # IMPORTANT: the baseline table is now treated as the authoritative
            # reset target for Warehouse lot values. Do not subtract staging
            # here; doing so made the reset appear not to restore the saved
            # counts and produced a moving target.
            cur.execute("""
                UPDATE supply.material_lots ml
                   SET available_quantity=b.available_quantity,
                       reserved_quantity=b.reserved_quantity,
                       status=CASE
                           WHEN lower(b.status)='released' THEN 'available'
                           ELSE b.status
                       END,
                       updated_at=now()
                  FROM public.demo_supply_lot_baseline b
                 WHERE ml.internal_lot_number=b.internal_lot_number
            """)
            supply_updated = max(cur.rowcount,0)

            # Keep the Pharma Process Twin local/demo inventory mirror aligned
            # with the authoritative Supply baseline.  The application normally
            # reads Supply directly, but some legacy/demo screens still expose
            # public.inventory_lots.
            local_inventory_updated = 0
            if _relation_exists(cur, "public.inventory_lots"):
                cur.execute("""
                    UPDATE public.inventory_lots il
                       SET quantity=b.available_quantity,
                           reserved_quantity=b.reserved_quantity,
                           qa_status=CASE
                               WHEN lower(b.status) IN ('available','released') THEN 'Released'
                               ELSE initcap(b.status)
                           END
                      FROM public.demo_supply_lot_baseline b
                     WHERE il.lot_number=b.internal_lot_number
                """)
                local_inventory_updated=max(cur.rowcount,0)

            cur.execute("""
                DELETE FROM public.material_positions
                WHERE location_code IN ('CW-STAGE-01','CW-HAZ-01')
            """)
            cur.execute("""
                INSERT INTO public.material_positions(
                    container_id,material_code,material_name,lot_number,quantity,unit,
                    location_code,status,hazard_class,campaign_id,po_number,pr_number,updated_at
                )
                SELECT container_id,material_code,material_name,lot_number,quantity,unit,
                       location_code,'Staged',hazard_class,NULL,NULL,NULL,now()
                FROM public.demo_staging_baseline
            """)
            staging_restored=max(cur.rowcount,0)

            cur.execute("""
                UPDATE public.bulk_tanks bt
                   SET quantity_kg=b.quantity_kg,
                       qa_status=b.qa_status,
                       lot_number=b.lot_number,
                       temperature_c=b.temperature_c,
                       status=b.status
                  FROM public.demo_bulk_tank_baseline b
                 WHERE bt.tank_code=b.tank_code
            """)
            bulk_updated=max(cur.rowcount,0)

            # AFTER verification.
            cur.execute("""
                SELECT
                    count(*),
                    COALESCE(sum(available_quantity),0),
                    COALESCE(sum(reserved_quantity),0)
                FROM supply.material_lots
                WHERE internal_lot_number IN (
                    SELECT internal_lot_number
                    FROM public.demo_supply_lot_baseline
                )
            """)
            after_supply=cur.fetchone()

            cur.execute("""
                SELECT
                    count(*),
                    COALESCE(sum(quantity),0)
                FROM public.material_positions
                WHERE location_code IN ('CW-STAGE-01','CW-HAZ-01')
            """)
            after_staging=cur.fetchone()

            cur.execute("""
                SELECT count(*),COALESCE(sum(quantity_kg),0)
                FROM public.bulk_tanks
                WHERE tank_code IN (SELECT tank_code FROM public.demo_bulk_tank_baseline)
            """)
            after_bulk=cur.fetchone()

            # Verify exact equality against baselines.
            cur.execute("""
                SELECT count(*)
                FROM supply.material_lots ml
                JOIN public.demo_supply_lot_baseline b
                  ON b.internal_lot_number=ml.internal_lot_number
                WHERE ml.available_quantity IS DISTINCT FROM b.available_quantity
                   OR ml.reserved_quantity IS DISTINCT FROM b.reserved_quantity
                   OR ml.status IS DISTINCT FROM CASE
                       WHEN lower(b.status)='released' THEN 'available'
                       ELSE b.status
                   END
            """)
            supply_mismatches=int(cur.fetchone()[0])

            cur.execute("""
                SELECT count(*)
                FROM public.demo_bulk_tank_baseline b
                JOIN public.bulk_tanks bt ON bt.tank_code=b.tank_code
                WHERE bt.quantity_kg IS DISTINCT FROM b.quantity_kg
                   OR bt.qa_status IS DISTINCT FROM b.qa_status
                   OR bt.status IS DISTINCT FROM b.status
                   OR bt.lot_number IS DISTINCT FROM b.lot_number
            """)
            bulk_mismatches=int(cur.fetchone()[0])

            cur.execute("""
                SELECT count(*)
                FROM (
                    SELECT material_code,lot_number,location_code,sum(quantity) qty
                    FROM public.material_positions
                    WHERE location_code IN ('CW-STAGE-01','CW-HAZ-01')
                    GROUP BY material_code,lot_number,location_code
                    EXCEPT
                    SELECT material_code,lot_number,location_code,sum(quantity) qty
                    FROM public.demo_staging_baseline
                    GROUP BY material_code,lot_number,location_code
                ) x
            """)
            staging_mismatches=int(cur.fetchone()[0])

            verified = supply_mismatches==0 and bulk_mismatches==0 and staging_mismatches==0
            if not verified:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Baseline update ran but verification failed: "
                        f"supply={supply_mismatches}, staging={staging_mismatches}, bulk={bulk_mismatches}."
                    ),
                )

            _record_demo_admin_action(
                cur,username,"RESTORE_INVENTORY_BASELINE",body.admin_note,
                (
                    f"verified=true;supply_updated={supply_updated};local_inventory_updated={local_inventory_updated};"
                    f"staging_restored={staging_restored};bulk_updated={bulk_updated};"
                    f"before_supply={before_supply};after_supply={after_supply};"
                    f"before_staging={before_staging};after_staging={after_staging};"
                    f"before_bulk={before_bulk};after_bulk={after_bulk}"
                ),
            )
        conn.commit()

    return {
        "success":True,
        "verified":True,
        "message":"Inventory baseline restored and verified against the saved baseline tables.",
        "supply_lots_updated":supply_updated,
        "local_inventory_rows_updated":local_inventory_updated,
        "staging_rows_restored":staging_restored,
        "bulk_tanks_updated":bulk_updated,
        "before":{
            "supply_available":str(before_supply[1]),
            "staging_quantity":str(before_staging[1]),
            "bulk_quantity_kg":str(before_bulk[1]),
        },
        "after":{
            "supply_available":str(after_supply[1]),
            "staging_quantity":str(after_staging[1]),
            "bulk_quantity_kg":str(after_bulk[1]),
        },
        "performed_by":username,
    }


@router.post("/demo/reset-po-pool")
def reset_demo_po_pool(
    body: DemoAdminOperationRequest,
    username: str = Depends(require_admin),
):
    """
    Global demo-cycle reset.

    This is intentionally an ADMIN operation and is blocked while another demo
    session is Active. It resets the reusable demo PO allocator, clears the
    Pharma Process Twin's transient PUBLIC workflow state, and restores the
    governed Warehouse, Chem Weigh staging, and Bulk inventory baselines before
    the transaction is committed.

    Shared pharma.* and supply.* genealogy is preserved. Baseline definition
    tables are never deleted.
    """
    if body.confirmation.strip().upper() != "RESET PO POOL":
        raise HTTPException(
            status_code=409,
            detail='Type "RESET PO POOL" to confirm PO-pool reset.',
        )

    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            active_sessions=_active_demo_session_count(cur)
            if active_sessions:
                raise HTTPException(
                    status_code=409,
                    detail=f"PO-pool reset blocked: {active_sessions} active demo session(s) remain.",
                )

            required = [
                "public.demo_po_pool_control",
                "public.demo_supply_lot_baseline",
                "public.demo_staging_baseline",
                "public.demo_bulk_tank_baseline",
                "supply.material_lots",
                "public.material_positions",
                "public.bulk_tanks",
            ]
            missing=[name for name in required if not _relation_exists(cur,name)]
            if missing:
                raise HTTPException(
                    status_code=409,
                    detail="Global demo reset is not fully installed: " + ", ".join(missing),
                )

            # Governed Warehouse demo baseline: every saved production lot starts
            # a fresh demo with 6,000 kg available, nothing reserved, and Available.
            #
            # supply.material_lots.status is CHECK-constrained and does not accept
            # "Released". "Released" remains appropriate only for the legacy Pharma
            # QA mirror (`public.inventory_lots.qa_status`).
            cur.execute("""
                UPDATE public.demo_supply_lot_baseline
                   SET available_quantity=6000.000,
                       reserved_quantity=0.000,
                       status='available'
            """)

            # Verify the Chem Weigh baseline definition exists before clearing the
            # live transient material_positions table.
            cur.execute("SELECT count(*) FROM public.demo_staging_baseline")
            staging_baseline_count=int(cur.fetchone()[0])
            if staging_baseline_count != 14:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Chem Weigh baseline is incomplete: "
                        f"expected 14 containers, found {staging_baseline_count}."
                    ),
                )

            cur.execute("""
                SELECT next_po_number,generation
                FROM public.demo_po_pool_control
                WHERE pool_key='PHARMA_DEMO'
                FOR UPDATE
            """)
            before=cur.fetchone()

            # Clear only transient Pharma Process Twin PUBLIC execution state.
            # material_positions is intentionally cleared because previous demo
            # containers may be in WR/Vestibule/staging locations. The governed
            # 14-container Chem Weigh baseline is rebuilt immediately afterward.
            transient_tables = [
                "weigh_ticket_lines",
                "weigh_tickets",
                "material_pr_lines",
                "material_prs",
                "material_movements",
                "material_positions",
                "warehouse_transfer_orders",
                "substitution_requests",
                "route_change_requests",
                "campaign_separation_requests",
                "premix_runs",
                "mix_batches",
                "packaging_downtime_events",
                "packaging_runs",
                "qa_bulk_tasks",
                "qa_finished_goods_tasks",
                "maintenance_work_orders",
                "cip_runs",
                "shipments",
                "batch_reviews",
                "audit_trail_entries",
                "production_campaigns",
                "material_requirements",
                "production_orders",
                "notifications",
                "platform_events",
            ]

            cleared: dict[str,int] = {}
            for table_name in transient_tables:
                qualified=f"public.{table_name}"
                if _relation_exists(cur,qualified):
                    cur.execute(f'DELETE FROM public."{table_name}"')
                    cleared[table_name]=max(cur.rowcount,0)

            # ============================================================
            # RESTORE GOVERNED INVENTORY BASELINES
            # ============================================================

            # 1. Warehouse / Supply baseline.
            cur.execute("""
                UPDATE supply.material_lots ml
                   SET available_quantity=b.available_quantity,
                       reserved_quantity=b.reserved_quantity,
                       status=CASE
                           WHEN lower(b.status)='released' THEN 'available'
                           ELSE b.status
                       END,
                       updated_at=now()
                  FROM public.demo_supply_lot_baseline b
                 WHERE ml.internal_lot_number=b.internal_lot_number
            """)
            warehouse_restored=max(cur.rowcount,0)

            # Keep the Pharma Process Twin local/demo inventory mirror aligned.
            local_inventory_restored=0
            if _relation_exists(cur,"public.inventory_lots"):
                cur.execute("""
                    UPDATE public.inventory_lots il
                       SET quantity=b.available_quantity,
                           reserved_quantity=b.reserved_quantity,
                           qa_status=CASE
                               WHEN lower(b.status) IN ('available','released') THEN 'Released'
                               ELSE initcap(b.status)
                           END
                      FROM public.demo_supply_lot_baseline b
                     WHERE il.lot_number=b.internal_lot_number
                """)
                local_inventory_restored=max(cur.rowcount,0)

            # 2. Chem Weigh staging baseline. These are physical staged positions,
            # so restored rows use status='Staged' rather than 'Available'.
            cur.execute("""
                INSERT INTO public.material_positions(
                    container_id,material_code,material_name,lot_number,quantity,unit,
                    location_code,status,hazard_class,campaign_id,po_number,pr_number,updated_at
                )
                SELECT container_id,material_code,material_name,lot_number,quantity,unit,
                       location_code,'Staged',hazard_class,NULL,NULL,NULL,now()
                FROM public.demo_staging_baseline
            """)
            staging_restored=max(cur.rowcount,0)

            # 3. Bulk tank baseline.
            cur.execute("""
                UPDATE public.bulk_tanks bt
                   SET quantity_kg=b.quantity_kg,
                       qa_status=b.qa_status,
                       lot_number=b.lot_number,
                       temperature_c=b.temperature_c,
                       status=b.status
                  FROM public.demo_bulk_tank_baseline b
                 WHERE bt.tank_code=b.tank_code
            """)
            bulk_restored=max(cur.rowcount,0)

            # ============================================================
            # VERIFY GLOBAL RESET INVENTORY BEFORE COMMIT
            # ============================================================

            # Warehouse: every baseline lot must exist live and exactly match.
            cur.execute("""
                SELECT count(*)
                FROM public.demo_supply_lot_baseline b
                LEFT JOIN supply.material_lots ml
                  ON ml.internal_lot_number=b.internal_lot_number
                WHERE ml.internal_lot_number IS NULL
                   OR ml.available_quantity IS DISTINCT FROM b.available_quantity
                   OR ml.reserved_quantity IS DISTINCT FROM b.reserved_quantity
                   OR ml.status IS DISTINCT FROM CASE
                       WHEN lower(b.status)='released' THEN 'available'
                       ELSE b.status
                   END
            """)
            warehouse_mismatches=int(cur.fetchone()[0])
            if warehouse_mismatches:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Global reset failed Warehouse baseline verification: "
                        f"{warehouse_mismatches} lot(s) are missing or do not match baseline."
                    ),
                )

            # Chem Weigh: require all 14 governed containers and exact material /
            # lot / location / quantity equality in both directions.
            cur.execute("""
                SELECT count(*)
                FROM public.material_positions
                WHERE location_code IN ('CW-STAGE-01','CW-HAZ-01')
            """)
            staging_count=int(cur.fetchone()[0])
            if staging_count != 14:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Global reset failed Chem Weigh baseline verification: "
                        f"expected 14 containers, found {staging_count}."
                    ),
                )

            cur.execute("""
                SELECT count(*)
                FROM (
                    (
                        SELECT material_code,lot_number,location_code,sum(quantity) qty
                        FROM public.material_positions
                        WHERE location_code IN ('CW-STAGE-01','CW-HAZ-01')
                        GROUP BY material_code,lot_number,location_code
                        EXCEPT
                        SELECT material_code,lot_number,location_code,sum(quantity) qty
                        FROM public.demo_staging_baseline
                        GROUP BY material_code,lot_number,location_code
                    )
                    UNION ALL
                    (
                        SELECT material_code,lot_number,location_code,sum(quantity) qty
                        FROM public.demo_staging_baseline
                        GROUP BY material_code,lot_number,location_code
                        EXCEPT
                        SELECT material_code,lot_number,location_code,sum(quantity) qty
                        FROM public.material_positions
                        WHERE location_code IN ('CW-STAGE-01','CW-HAZ-01')
                        GROUP BY material_code,lot_number,location_code
                    )
                ) x
            """)
            staging_mismatches=int(cur.fetchone()[0])
            if staging_mismatches:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Global reset failed Chem Weigh quantity verification: "
                        f"{staging_mismatches} baseline group(s) differ."
                    ),
                )

            # Bulk: every baseline tank must exist and exactly match.
            cur.execute("""
                SELECT count(*)
                FROM public.demo_bulk_tank_baseline b
                LEFT JOIN public.bulk_tanks bt ON bt.tank_code=b.tank_code
                WHERE bt.tank_code IS NULL
                   OR bt.quantity_kg IS DISTINCT FROM b.quantity_kg
                   OR bt.qa_status IS DISTINCT FROM b.qa_status
                   OR bt.status IS DISTINCT FROM b.status
                   OR bt.lot_number IS DISTINCT FROM b.lot_number
            """)
            bulk_mismatches=int(cur.fetchone()[0])
            if bulk_mismatches:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Global reset failed Bulk baseline verification: "
                        f"{bulk_mismatches} tank(s) are missing or do not match baseline."
                    ),
                )

            # Reset equipment state without deleting equipment/master rows.
            for table_name in ("weigh_rooms","mix_rooms","packaging_lines"):
                qualified=f"public.{table_name}"
                if _relation_exists(cur,qualified):
                    cur.execute(
                        f'UPDATE public."{table_name}" '
                        "SET status='available', active_po=NULL"
                    )

            if _relation_exists(cur,"public.hold_tanks"):
                cur.execute("""
                    UPDATE public.hold_tanks
                       SET status='available',
                           active_po=NULL,
                           level_percent=0,
                           qa_status='Not Applicable',
                           batch_number=NULL,
                           product_name=NULL,
                           transferred_quantity=0,
                           source_mix_tank=NULL,
                           transfer_completed_at=NULL,
                           lims_sample_id=NULL
                """)

            # End prior browser sessions/entity ownership for the new global
            # generation, while preserving reset-request audit history.
            if _relation_exists(cur,"public.demo_session_entities"):
                cur.execute("UPDATE public.demo_session_entities SET active=false,updated_at=now()")
            if _relation_exists(cur,"public.demo_sessions"):
                cur.execute("""
                    UPDATE public.demo_sessions
                       SET status='Reset Complete',
                           last_seen_at=now()
                     WHERE lower(status) <> 'active'
                """)

            if before is None:
                cur.execute("""
                    INSERT INTO public.demo_po_pool_control(
                        pool_key,next_po_number,generation,reset_by,reset_at,admin_note,updated_at
                    )
                    VALUES('PHARMA_DEMO',260743,1,%s,now(),%s,now())
                    RETURNING next_po_number,generation
                """,(username,body.admin_note))
            else:
                cur.execute("""
                    UPDATE public.demo_po_pool_control
                       SET next_po_number=260743,
                           generation=generation+1,
                           reset_by=%s,
                           reset_at=now(),
                           admin_note=%s,
                           updated_at=now()
                     WHERE pool_key='PHARMA_DEMO'
                    RETURNING next_po_number,generation
                """,(username,body.admin_note))

            after=cur.fetchone()
            if not after or int(after[0]) != 260743:
                raise HTTPException(status_code=409,detail="PO-pool reset did not verify.")

            # Verify transient production orders are actually empty.
            remaining_public_pos=0
            if _relation_exists(cur,"public.production_orders"):
                cur.execute("SELECT count(*) FROM public.production_orders")
                remaining_public_pos=int(cur.fetchone()[0])
                if remaining_public_pos:
                    raise HTTPException(
                        status_code=409,
                        detail=f"PO pool reset verification failed: {remaining_public_pos} transient production orders remain.",
                    )

            _record_demo_admin_action(
                cur,username,"RESET_PO_POOL",body.admin_note,
                (
                    f"before={before};after={after};cleared={cleared};"
                    f"warehouse_restored={warehouse_restored};"
                    f"local_inventory_restored={local_inventory_restored};"
                    f"staging_restored={staging_restored};staging_count={staging_count};"
                    f"bulk_restored={bulk_restored};remaining_public_pos={remaining_public_pos}"
                ),
            )
        conn.commit()

    return {
        "success":True,
        "verified":True,
        "message":(
            "Global demo reset completed. Transient Pharma Process Twin workflow "
            "records were cleared, the next reusable PO is PO-260743, and governed "
            "Warehouse, Chem Weigh staging, and Bulk inventory baselines were restored."
        ),
        "before_next_po_number":before[0] if before else None,
        "next_po_number":after[0],
        "generation":after[1],
        "public_production_orders_remaining":remaining_public_pos,
        "warehouse_lots_restored":warehouse_restored,
        "local_inventory_rows_restored":local_inventory_restored,
        "staging_rows_restored":staging_restored,
        "staging_rows_verified":staging_count,
        "bulk_tanks_restored":bulk_restored,
        "cleared_tables":cleared,
        "performed_by":username,
    }