import psycopg

from .catalog import build_conninfo
from .schemas import ConnectionTestRequest


def load_object_metadata(
    request: ConnectionTestRequest,
    schema_name: str,
    object_name: str,
) -> dict:
    conninfo = build_conninfo(request)

    with psycopg.connect(conninfo) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    c.column_name,
                    c.data_type,
                    c.is_nullable,
                    c.column_default,
                    c.ordinal_position
                FROM information_schema.columns c
                WHERE c.table_schema = %s
                  AND c.table_name = %s
                ORDER BY c.ordinal_position;
                """,
                (schema_name, object_name),
            )

            columns = [
                {
                    "name": row[0],
                    "data_type": row[1],
                    "nullable": row[2] == "YES",
                    "default": row[3],
                    "position": row[4],
                    "primary_key": False,
                }
                for row in cursor.fetchall()
            ]

            cursor.execute(
                """
                SELECT
                    kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.constraint_schema = kcu.constraint_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = %s
                  AND tc.table_name = %s
                ORDER BY kcu.ordinal_position;
                """,
                (schema_name, object_name),
            )

            primary_keys = {
                row[0]
                for row in cursor.fetchall()
            }

            for column in columns:
                column["primary_key"] = (
                    column["name"] in primary_keys
                )

            cursor.execute(
                """
                SELECT
                    indexname,
                    indexdef
                FROM pg_indexes
                WHERE schemaname = %s
                  AND tablename = %s
                ORDER BY indexname;
                """,
                (schema_name, object_name),
            )

            indexes = [
                {
                    "name": row[0],
                    "definition": row[1],
                }
                for row in cursor.fetchall()
            ]

            cursor.execute(
                """
                SELECT
                    table_type
                FROM information_schema.tables
                WHERE table_schema = %s
                  AND table_name = %s;
                """,
                (schema_name, object_name),
            )

            row = cursor.fetchone()

            object_type = (
                row[0]
                if row is not None
                else "VIEW"
            )

    return {
        "schema": schema_name,
        "name": object_name,
        "object_type": object_type,
        "columns": columns,
        "indexes": indexes,
    }