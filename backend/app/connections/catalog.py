import psycopg

from .schemas import ConnectionTestRequest


def build_conninfo(request: ConnectionTestRequest) -> str:
    if request.method == "url":
        if not request.connection_url:
            raise ValueError("Connection URL is required.")

        return request.connection_url

    if not all(
        [
            request.host,
            request.port,
            request.database,
            request.username,
        ]
    ):
        raise ValueError(
            "Host, port, database, and username are required."
        )

    return psycopg.conninfo.make_conninfo(
        host=request.host,
        port=request.port,
        dbname=request.database,
        user=request.username,
        password=request.password or "",
        sslmode=request.ssl_mode,
        connect_timeout=5,
    )


def load_database_catalog(
    request: ConnectionTestRequest,
) -> dict:
    conninfo = build_conninfo(request)

    with psycopg.connect(conninfo) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT schema_name
                FROM information_schema.schemata
                WHERE schema_name NOT IN (
                    'pg_catalog',
                    'information_schema'
                )
                AND schema_name NOT LIKE 'pg_toast%'
                AND schema_name NOT LIKE 'pg_temp_%'
                ORDER BY schema_name;
                """
            )

            schemas = []

            for (schema_name,) in cursor.fetchall():
                cursor.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = %s
                      AND table_type = 'BASE TABLE'
                    ORDER BY table_name;
                    """,
                    (schema_name,),
                )

                tables = [
                    row[0]
                    for row in cursor.fetchall()
                ]

                cursor.execute(
                    """
                    SELECT table_name
                    FROM information_schema.views
                    WHERE table_schema = %s
                    ORDER BY table_name;
                    """,
                    (schema_name,),
                )

                views = [
                    row[0]
                    for row in cursor.fetchall()
                ]

                cursor.execute(
                    """
                    SELECT routine_name
                    FROM information_schema.routines
                    WHERE routine_schema = %s
                    ORDER BY routine_name;
                    """,
                    (schema_name,),
                )

                functions = sorted(
                    {
                        row[0]
                        for row in cursor.fetchall()
                    }
                )

                cursor.execute(
                    """
                    SELECT sequence_name
                    FROM information_schema.sequences
                    WHERE sequence_schema = %s
                    ORDER BY sequence_name;
                    """,
                    (schema_name,),
                )

                sequences = [
                    row[0]
                    for row in cursor.fetchall()
                ]

                schemas.append(
                    {
                        "name": schema_name,
                        "tables": tables,
                        "views": views,
                        "functions": functions,
                        "sequences": sequences,
                    }
                )

            cursor.execute(
                "SELECT current_database();"
            )

            database_name = cursor.fetchone()[0]

    return {
        "database": database_name,
        "schemas": schemas,
    }