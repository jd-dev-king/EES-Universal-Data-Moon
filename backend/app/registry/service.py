import os
from uuid import UUID, uuid4

import psycopg

from psycopg.rows import dict_row

from ..connections.catalog import (
    build_conninfo,
)

from .schemas import (
    DatasetCreate,
    DatasetResponse,
    DiscoveredObject,
    RegistryDiscoveryPreviewRequest,
    RegistryDiscoveryPreviewResponse,
    RegistryDiscoveryRequest,
    RegistryDiscoveryResponse,
    RegistryOverviewResponse,
    RelationshipCreate,
    RelationshipResponse,
    SystemCreate,
    SystemResponse,
)


# ------------------------------------------------------------
# REGISTRY CONNECTION
# ------------------------------------------------------------


def get_registry_database_url() -> str:
    database_url = os.getenv(
        "EES_REGISTRY_DATABASE_URL"
    )

    if not database_url:
        raise RuntimeError(
            "EES_REGISTRY_DATABASE_URL "
            "is not configured."
        )

    return database_url


def get_connection():
    return psycopg.connect(
        get_registry_database_url(),
        row_factory=dict_row,
    )


# ------------------------------------------------------------
# SYSTEMS
# ------------------------------------------------------------


def create_system(
    payload: SystemCreate,
) -> SystemResponse:
    system_id = uuid4()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO ees_registry.systems (
                    system_id,
                    system_name,
                    system_key,
                    domain,
                    system_type,
                    description,
                    status,
                    data_role,
                    primary_database,
                    api_base_url,
                    repository_url,
                    owner_name
                )
                VALUES (
                    %(system_id)s,
                    %(system_name)s,
                    %(system_key)s,
                    %(domain)s,
                    %(system_type)s,
                    %(description)s,
                    %(status)s,
                    %(data_role)s,
                    %(primary_database)s,
                    %(api_base_url)s,
                    %(repository_url)s,
                    %(owner_name)s
                )
                RETURNING *;
                """,
                {
                    "system_id": system_id,
                    **payload.model_dump(),
                },
            )

            row = cursor.fetchone()

    if row is None:
        raise RuntimeError(
            "System registration failed."
        )

    return SystemResponse(**row)


def list_systems() -> list[SystemResponse]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT *
                FROM ees_registry.systems
                ORDER BY system_name;
                """
            )

            rows = cursor.fetchall()

    return [
        SystemResponse(**row)
        for row in rows
    ]


def get_system(
    system_id: UUID,
) -> SystemResponse | None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT *
                FROM ees_registry.systems
                WHERE system_id = %s;
                """,
                (system_id,),
            )

            row = cursor.fetchone()

    if row is None:
        return None

    return SystemResponse(**row)


# ------------------------------------------------------------
# DATASETS
# ------------------------------------------------------------


def create_dataset(
    payload: DatasetCreate,
) -> DatasetResponse:
    dataset_id = uuid4()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO ees_registry.datasets (
                    dataset_id,
                    system_id,
                    dataset_name,
                    dataset_key,
                    domain,
                    database_name,
                    schema_name,
                    object_name,
                    object_type,
                    source_type,
                    classification,
                    refresh_mode,
                    description,
                    is_active
                )
                VALUES (
                    %(dataset_id)s,
                    %(system_id)s,
                    %(dataset_name)s,
                    %(dataset_key)s,
                    %(domain)s,
                    %(database_name)s,
                    %(schema_name)s,
                    %(object_name)s,
                    %(object_type)s,
                    %(source_type)s,
                    %(classification)s,
                    %(refresh_mode)s,
                    %(description)s,
                    %(is_active)s
                )
                RETURNING *;
                """,
                {
                    "dataset_id": dataset_id,
                    **payload.model_dump(),
                },
            )

            row = cursor.fetchone()

    if row is None:
        raise RuntimeError(
            "Dataset registration failed."
        )

    return DatasetResponse(**row)


def list_datasets(
    system_id: UUID | None = None,
) -> list[DatasetResponse]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            if system_id:
                cursor.execute(
                    """
                    SELECT *
                    FROM ees_registry.datasets
                    WHERE system_id = %s
                    ORDER BY
                        schema_name,
                        object_name,
                        dataset_name;
                    """,
                    (system_id,),
                )

            else:
                cursor.execute(
                    """
                    SELECT *
                    FROM ees_registry.datasets
                    ORDER BY
                        system_id,
                        schema_name,
                        object_name,
                        dataset_name;
                    """
                )

            rows = cursor.fetchall()

    return [
        DatasetResponse(**row)
        for row in rows
    ]


# ------------------------------------------------------------
# RELATIONSHIPS
# ------------------------------------------------------------


def create_relationship(
    payload: RelationshipCreate,
) -> RelationshipResponse:
    relationship_id = uuid4()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO
                    ees_registry.dataset_relationships (
                        relationship_id,
                        source_dataset_id,
                        target_dataset_id,
                        relationship_type,
                        description
                    )
                VALUES (
                    %(relationship_id)s,
                    %(source_dataset_id)s,
                    %(target_dataset_id)s,
                    %(relationship_type)s,
                    %(description)s
                )
                RETURNING *;
                """,
                {
                    "relationship_id":
                        relationship_id,

                    **payload.model_dump(),
                },
            )

            row = cursor.fetchone()

    if row is None:
        raise RuntimeError(
            "Dataset relationship "
            "registration failed."
        )

    return RelationshipResponse(**row)


# ------------------------------------------------------------
# OVERVIEW
# ------------------------------------------------------------


def get_registry_overview(
) -> RegistryOverviewResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    (
                        SELECT COUNT(*)
                        FROM ees_registry.systems
                    ) AS systems,

                    (
                        SELECT COUNT(*)
                        FROM ees_registry.datasets
                    ) AS datasets,

                    (
                        SELECT COUNT(*)
                        FROM
                            ees_registry.dataset_relationships
                    ) AS relationships,

                    (
                        SELECT COUNT(*)
                        FROM ees_registry.systems
                        WHERE status = 'active'
                    ) AS active_systems,

                    (
                        SELECT COUNT(*)
                        FROM ees_registry.datasets
                        WHERE is_active = TRUE
                    ) AS active_datasets;
                """
            )

            row = cursor.fetchone()

    if row is None:
        raise RuntimeError(
            "Unable to read registry overview."
        )

    return RegistryOverviewResponse(
        success=True,
        **row,
    )


# ------------------------------------------------------------
# DISCOVERY PREVIEW
# ------------------------------------------------------------


def preview_registry_discovery(
    request:
        RegistryDiscoveryPreviewRequest,
) -> RegistryDiscoveryPreviewResponse:
    system = get_system(
        request.system_id
    )

    if system is None:
        return RegistryDiscoveryPreviewResponse(
            success=False,
            message="EES system not found.",
            system_id=request.system_id,
        )

    try:
        objects = _discover_postgres_objects(
            request.connection,
            request.include_schemas,
            request.exclude_schemas,
        )

        database_name = (
            _resolve_database_name(
                request.connection
            )
        )

        tables = sum(
            1
            for item in objects
            if item.object_type == "table"
        )

        views = sum(
            1
            for item in objects
            if item.object_type == "view"
        )

        materialized_views = sum(
            1
            for item in objects
            if (
                item.object_type
                == "materialized_view"
            )
        )

        return RegistryDiscoveryPreviewResponse(
            success=True,
            message=(
                f"Discovered {len(objects)} "
                "PostgreSQL objects."
            ),
            system_id=request.system_id,
            database_name=database_name,
            objects_found=len(objects),
            tables=tables,
            views=views,
            materialized_views=(
                materialized_views
            ),
            objects=objects,
        )

    except Exception as exc:
        return RegistryDiscoveryPreviewResponse(
            success=False,
            message=str(exc),
            system_id=request.system_id,
        )


# ------------------------------------------------------------
# DISCOVERY REGISTRATION
# ------------------------------------------------------------


def register_discovered_datasets(
    request:
        RegistryDiscoveryRequest,
) -> RegistryDiscoveryResponse:
    system = get_system(
        request.system_id
    )

    if system is None:
        return RegistryDiscoveryResponse(
            success=False,
            message="EES system not found.",
            system_id=request.system_id,
        )

    try:
        objects = _discover_postgres_objects(
            request.connection,
            request.include_schemas,
            request.exclude_schemas,
        )

        database_name = (
            _resolve_database_name(
                request.connection
            )
        )

        created = 0
        updated = 0
        skipped = 0

        registered: list[
            DatasetResponse
        ] = []

        with get_connection() as connection:
            with connection.cursor() as cursor:
                for item in objects:
                    existing = (
                        _find_dataset_by_key(
                            cursor,
                            request.system_id,
                            item.dataset_key,
                        )
                    )

                    if existing:
                        if not request.update_existing:
                            skipped += 1
                            registered.append(
                                DatasetResponse(
                                    **existing
                                )
                            )

                            continue

                        cursor.execute(
                            """
                            UPDATE ees_registry.datasets
                            SET
                                dataset_name = %(dataset_name)s,
                                domain = %(domain)s,
                                database_name = %(database_name)s,
                                schema_name = %(schema_name)s,
                                object_name = %(object_name)s,
                                object_type = %(object_type)s,
                                source_type = 'postgresql',
                                classification = %(classification)s,
                                refresh_mode = %(refresh_mode)s,
                                description = %(description)s,
                                is_active = TRUE,
                                updated_at = NOW()
                            WHERE
                                system_id = %(system_id)s
                                AND dataset_key = %(dataset_key)s
                            RETURNING *;
                            """,
                            {
                                "system_id":
                                    request.system_id,

                                "dataset_key":
                                    item.dataset_key,

                                "dataset_name":
                                    item.dataset_name,

                                "domain":
                                    system.domain,

                                "database_name":
                                    database_name,

                                "schema_name":
                                    item.schema_name,

                                "object_name":
                                    item.object_name,

                                "object_type":
                                    item.object_type,

                                "classification":
                                    request.classification,

                                "refresh_mode":
                                    request.refresh_mode,

                                "description":
                                    _build_dataset_description(
                                        system.system_name,
                                        item,
                                    ),
                            },
                        )

                        row = cursor.fetchone()

                        if row:
                            updated += 1

                            registered.append(
                                DatasetResponse(
                                    **row
                                )
                            )

                        continue

                    dataset_id = uuid4()

                    cursor.execute(
                        """
                        INSERT INTO ees_registry.datasets (
                            dataset_id,
                            system_id,
                            dataset_name,
                            dataset_key,
                            domain,
                            database_name,
                            schema_name,
                            object_name,
                            object_type,
                            source_type,
                            classification,
                            refresh_mode,
                            description,
                            is_active
                        )
                        VALUES (
                            %(dataset_id)s,
                            %(system_id)s,
                            %(dataset_name)s,
                            %(dataset_key)s,
                            %(domain)s,
                            %(database_name)s,
                            %(schema_name)s,
                            %(object_name)s,
                            %(object_type)s,
                            'postgresql',
                            %(classification)s,
                            %(refresh_mode)s,
                            %(description)s,
                            TRUE
                        )
                        RETURNING *;
                        """,
                        {
                            "dataset_id":
                                dataset_id,

                            "system_id":
                                request.system_id,

                            "dataset_name":
                                item.dataset_name,

                            "dataset_key":
                                item.dataset_key,

                            "domain":
                                system.domain,

                            "database_name":
                                database_name,

                            "schema_name":
                                item.schema_name,

                            "object_name":
                                item.object_name,

                            "object_type":
                                item.object_type,

                            "classification":
                                request.classification,

                            "refresh_mode":
                                request.refresh_mode,

                            "description":
                                _build_dataset_description(
                                    system.system_name,
                                    item,
                                ),
                        },
                    )

                    row = cursor.fetchone()

                    if row:
                        created += 1

                        registered.append(
                            DatasetResponse(
                                **row
                            )
                        )

            connection.commit()

        return RegistryDiscoveryResponse(
            success=True,
            message=(
                "Registry discovery completed."
            ),
            system_id=request.system_id,
            database_name=database_name,
            discovered=len(objects),
            created=created,
            updated=updated,
            skipped=skipped,
            datasets=registered,
        )

    except Exception as exc:
        return RegistryDiscoveryResponse(
            success=False,
            message=str(exc),
            system_id=request.system_id,
        )


# ------------------------------------------------------------
# POSTGRES DISCOVERY
# ------------------------------------------------------------


def _discover_postgres_objects(
    connection_request,
    include_schemas:
        list[str] | None,
    exclude_schemas:
        list[str],
) -> list[DiscoveredObject]:
    conninfo = build_conninfo(
        connection_request
    )

    database_name = (
        _resolve_database_name(
            connection_request
        )
    )

    discovered: list[
        DiscoveredObject
    ] = []

    with psycopg.connect(
        conninfo
    ) as connection:
        with connection.cursor() as cursor:
            # ------------------------------------------------
            # TABLES + VIEWS
            # ------------------------------------------------

            cursor.execute(
                """
                SELECT
                    table_schema,
                    table_name,
                    table_type
                FROM information_schema.tables
                WHERE
                    table_schema NOT LIKE 'pg_%'
                    AND table_schema <> 'information_schema'
                ORDER BY
                    table_schema,
                    table_name;
                """
            )

            for (
                schema_name,
                object_name,
                table_type,
            ) in cursor.fetchall():

                if not _schema_is_allowed(
                    schema_name,
                    include_schemas,
                    exclude_schemas,
                ):
                    continue

                object_type = (
                    "view"
                    if table_type == "VIEW"
                    else "table"
                )

                column_count = (
                    _get_column_count(
                        cursor,
                        schema_name,
                        object_name,
                    )
                )

                estimated_rows = None

                if object_type == "table":
                    estimated_rows = (
                        _get_estimated_rows(
                            cursor,
                            schema_name,
                            object_name,
                        )
                    )

                discovered.append(
                    DiscoveredObject(
                        database_name=(
                            database_name
                        ),
                        schema_name=(
                            schema_name
                        ),
                        object_name=(
                            object_name
                        ),
                        object_type=(
                            object_type
                        ),
                        dataset_key=(
                            _build_dataset_key(
                                database_name,
                                schema_name,
                                object_name,
                            )
                        ),
                        dataset_name=(
                            _build_dataset_name(
                                schema_name,
                                object_name,
                            )
                        ),
                        column_count=(
                            column_count
                        ),
                        estimated_rows=(
                            estimated_rows
                        ),
                    )
                )

            # ------------------------------------------------
            # MATERIALIZED VIEWS
            # ------------------------------------------------

            cursor.execute(
                """
                SELECT
                    schemaname,
                    matviewname
                FROM pg_matviews
                WHERE
                    schemaname NOT LIKE 'pg_%'
                    AND schemaname <> 'information_schema'
                ORDER BY
                    schemaname,
                    matviewname;
                """
            )

            existing_keys = {
                (
                    item.schema_name,
                    item.object_name,
                )
                for item in discovered
            }

            for (
                schema_name,
                object_name,
            ) in cursor.fetchall():

                if not _schema_is_allowed(
                    schema_name,
                    include_schemas,
                    exclude_schemas,
                ):
                    continue

                if (
                    schema_name,
                    object_name,
                ) in existing_keys:
                    continue

                column_count = (
                    _get_column_count(
                        cursor,
                        schema_name,
                        object_name,
                    )
                )

                discovered.append(
                    DiscoveredObject(
                        database_name=(
                            database_name
                        ),
                        schema_name=(
                            schema_name
                        ),
                        object_name=(
                            object_name
                        ),
                        object_type=(
                            "materialized_view"
                        ),
                        dataset_key=(
                            _build_dataset_key(
                                database_name,
                                schema_name,
                                object_name,
                            )
                        ),
                        dataset_name=(
                            _build_dataset_name(
                                schema_name,
                                object_name,
                            )
                        ),
                        column_count=(
                            column_count
                        ),
                        estimated_rows=(
                            _get_estimated_rows(
                                cursor,
                                schema_name,
                                object_name,
                            )
                        ),
                    )
                )

    return discovered


# ------------------------------------------------------------
# DISCOVERY HELPERS
# ------------------------------------------------------------


def _schema_is_allowed(
    schema_name: str,
    include_schemas:
        list[str] | None,
    exclude_schemas:
        list[str],
) -> bool:
    if (
        schema_name.startswith(
            "pg_"
        )
    ):
        return False

    if (
        schema_name
        == "information_schema"
    ):
        return False

    if (
        schema_name
        in exclude_schemas
    ):
        return False

    if (
        include_schemas
        and schema_name
        not in include_schemas
    ):
        return False

    return True


def _get_column_count(
    cursor,
    schema_name: str,
    object_name: str,
) -> int:
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE
            table_schema = %s
            AND table_name = %s;
        """,
        (
            schema_name,
            object_name,
        ),
    )

    row = cursor.fetchone()

    if not row:
        return 0

    return int(row[0])


def _get_estimated_rows(
    cursor,
    schema_name: str,
    object_name: str,
) -> int | None:
    cursor.execute(
        """
        SELECT
            c.reltuples::BIGINT
        FROM pg_class c
        JOIN pg_namespace n
            ON n.oid = c.relnamespace
        WHERE
            n.nspname = %s
            AND c.relname = %s
        LIMIT 1;
        """,
        (
            schema_name,
            object_name,
        ),
    )

    row = cursor.fetchone()

    if not row:
        return None

    value = row[0]

    if value is None:
        return None

    return max(
        0,
        int(value),
    )


def _resolve_database_name(
    connection_request,
) -> str:
    database = getattr(
        connection_request,
        "database",
        None,
    )

    if database:
        return database

    connection_url = getattr(
        connection_request,
        "connection_url",
        None,
    )

    if connection_url:
        try:
            parsed = psycopg.conninfo.conninfo_to_dict(
                connection_url
            )

            database = parsed.get(
                "dbname"
            )

            if database:
                return database

        except Exception:
            pass

    return "unknown_database"


def _build_dataset_key(
    database_name: str,
    schema_name: str,
    object_name: str,
) -> str:
    return (
        f"{database_name}."
        f"{schema_name}."
        f"{object_name}"
    )


def _build_dataset_name(
    schema_name: str,
    object_name: str,
) -> str:
    return (
        f"{schema_name}."
        f"{object_name}"
    )


def _build_dataset_description(
    system_name: str,
    item: DiscoveredObject,
) -> str:
    return (
        f"Discovered PostgreSQL "
        f"{item.object_type} "
        f"{item.schema_name}."
        f"{item.object_name} "
        f"from {system_name}."
    )


def _find_dataset_by_key(
    cursor,
    system_id: UUID,
    dataset_key: str,
):
    cursor.execute(
        """
        SELECT *
        FROM ees_registry.datasets
        WHERE
            system_id = %s
            AND dataset_key = %s
        LIMIT 1;
        """,
        (
            system_id,
            dataset_key,
        ),
    )

    return cursor.fetchone()