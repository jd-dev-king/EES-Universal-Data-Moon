import psycopg

from .schemas import ConnectionTestRequest, ConnectionTestResponse


def test_connection(
    request: ConnectionTestRequest,
) -> ConnectionTestResponse:
    try:
        if request.method == "url":
            if not request.connection_url:
                return ConnectionTestResponse(
                    success=False,
                    message="Connection URL is required.",
                )

            conninfo = request.connection_url

        else:
            if not all(
                [
                    request.host,
                    request.port,
                    request.database,
                    request.username,
                ]
            ):
                return ConnectionTestResponse(
                    success=False,
                    message="Host, port, database, and username are required.",
                )

            conninfo = psycopg.conninfo.make_conninfo(
                host=request.host,
                port=request.port,
                dbname=request.database,
                user=request.username,
                password=request.password or "",
                sslmode=request.ssl_mode,
                connect_timeout=5,
            )

        with psycopg.connect(conninfo) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        current_database(),
                        current_setting('server_version');
                    """
                )

                row = cursor.fetchone()

                if row is None:
                    return ConnectionTestResponse(
                        success=False,
                        message="Connected, but PostgreSQL returned no server metadata.",
                    )

                database_name, server_version = row

        return ConnectionTestResponse(
            success=True,
            message="PostgreSQL connection successful.",
            database=database_name,
            server_version=server_version,
        )

    except psycopg.Error as exc:
        return ConnectionTestResponse(
            success=False,
            message=str(exc),
        )

    except Exception as exc:
        return ConnectionTestResponse(
            success=False,
            message=f"Unexpected connection error: {exc}",
        )