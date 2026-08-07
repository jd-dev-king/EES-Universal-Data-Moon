import os
import re
import time
from typing import Any

import psycopg
from fastapi import APIRouter, HTTPException, Query
from psycopg import sql
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api", tags=["data-moon-public"])

MAX_ROWS = int(os.getenv("DATA_MOON_MAX_ROWS", "500"))
FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|do|vacuum|analyze|refresh|reindex|cluster)\b",
    re.IGNORECASE,
)


def database_url() -> str:
    value = os.getenv("DATABASE_URL") or os.getenv("EES_DATABASE_URL")
    if not value:
        raise HTTPException(
            status_code=503,
            detail="Data Moon database connection is not configured.",
        )
    return value


def json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def ensure_read_only(statement: str) -> str:
    cleaned = statement.strip().rstrip(";").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="SQL query is empty.")
    if ";" in cleaned:
        raise HTTPException(status_code=400, detail="Only one SQL statement is allowed.")
    if not cleaned.lower().startswith(("select ", "with ", "explain ")):
        raise HTTPException(status_code=400, detail="Only read-only SELECT queries are allowed.")
    if FORBIDDEN.search(cleaned):
        raise HTTPException(status_code=400, detail="Mutating SQL is blocked by Data Moon.")
    return cleaned


class ReadOnlyQueryRequest(BaseModel):
    sql: str = Field(min_length=1)
    limit: int = Field(default=250, ge=1, le=MAX_ROWS)


@router.get("/health")
def public_health():
    try:
        with psycopg.connect(database_url(), connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT current_database(), current_user;")
                db_name, db_user = cur.fetchone()
        return {
            "status": "ok",
            "service": "EES Universal Data Moon API",
            "version": "1.0.0",
            "database": db_name,
            "database_user": db_user,
            "mode": "read-only catalog/query gateway",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/catalog/schemas")
def schemas():
    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT schema_name
                FROM information_schema.schemata
                WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
                  AND schema_name NOT LIKE 'pg_toast%%'
                  AND schema_name NOT LIKE 'pg_temp_%%'
                ORDER BY schema_name
            """)
            return {"schemas": [row[0] for row in cur.fetchall()]}


@router.get("/catalog/schemas/{schema_name}/tables")
def tables(schema_name: str):
    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name, table_type
                FROM information_schema.tables
                WHERE table_schema = %s
                ORDER BY table_type, table_name
            """, (schema_name,))
            objects = [{"name": r[0], "type": r[1]} for r in cur.fetchall()]
    return {"schema": schema_name, "tables": objects}


@router.get("/catalog/{schema_name}/{table_name}/columns")
def columns(schema_name: str, table_name: str):
    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name, data_type, is_nullable, column_default, ordinal_position
                FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s
                ORDER BY ordinal_position
            """, (schema_name, table_name))
            rows = [
                {
                    "name": r[0],
                    "data_type": r[1],
                    "nullable": r[2] == "YES",
                    "default": r[3],
                    "position": r[4],
                }
                for r in cur.fetchall()
            ]
    if not rows:
        raise HTTPException(status_code=404, detail="Table or view not found.")
    return {"schema": schema_name, "table": table_name, "columns": rows}


@router.get("/catalog/{schema_name}/{table_name}/count")
def row_count(schema_name: str, table_name: str):
    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("SELECT COUNT(*) FROM {}.{}").format(
                    sql.Identifier(schema_name), sql.Identifier(table_name)
                )
            )
            count = cur.fetchone()[0]
    return {"schema": schema_name, "table": table_name, "row_count": count}


@router.get("/catalog/{schema_name}/{table_name}/sample")
def sample(schema_name: str, table_name: str, limit: int = Query(default=25, ge=1, le=100)):
    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("SELECT * FROM {}.{} LIMIT %s").format(
                    sql.Identifier(schema_name), sql.Identifier(table_name)
                ),
                (limit,),
            )
            columns = [d.name for d in cur.description] if cur.description else []
            rows = [[json_safe(v) for v in row] for row in cur.fetchall()]
    return {
        "schema": schema_name,
        "table": table_name,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


@router.post("/query")
def read_only_query(request: ReadOnlyQueryRequest):
    statement = ensure_read_only(request.sql)
    started = time.perf_counter()
    wrapped = f"SELECT * FROM ({statement}) AS data_moon_query LIMIT {request.limit}"
    try:
        with psycopg.connect(database_url(), options="-c default_transaction_read_only=on") as conn:
            with conn.cursor() as cur:
                cur.execute(wrapped)
                columns = [d.name for d in cur.description] if cur.description else []
                rows = [[json_safe(v) for v in row] for row in cur.fetchall()]
        return {
            "success": True,
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            "read_only": True,
        }
    except psycopg.Error as exc:
        raise HTTPException(status_code=400, detail=str(exc))
