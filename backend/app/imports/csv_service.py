import csv
import os
import time
from collections import defaultdict
from typing import Any

import psycopg
from psycopg import sql

from ..connections.catalog import build_conninfo
from .schemas import (
    CsvColumnPreview,
    CsvImportRequest,
    CsvImportResponse,
    CsvPreviewResponse,
    CsvRejectedRow,
    CsvValidationRequest,
    CsvValidationResponse,
)
from .type_inference import (
    infer_postgres_type,
    normalize_identifier,
)


PREVIEW_ROWS = 50
INFERENCE_ROWS = 500
MAX_REJECTED_ROWS_RETURNED = 100


def preview_csv(
    file_path: str,
) -> CsvPreviewResponse:
    if not os.path.exists(file_path):
        return CsvPreviewResponse(
            success=False,
            message="CSV file does not exist.",
        )

    try:
        (
            delimiter,
            fieldnames,
            rows,
        ) = _read_csv_for_preview(
            file_path
        )

        if not fieldnames:
            return CsvPreviewResponse(
                success=False,
                message="CSV file has no header row.",
            )

        column_values: dict[
            str,
            list[str | None],
        ] = defaultdict(list)

        preview_rows: list[
            dict[str, Any]
        ] = []

        total_rows = 0

        for row in rows:
            total_rows += 1

            if len(preview_rows) < PREVIEW_ROWS:
                preview_rows.append(
                    dict(row)
                )

            if total_rows <= INFERENCE_ROWS:
                for column_name in fieldnames:
                    column_values[
                        column_name
                    ].append(
                        row.get(
                            column_name
                        )
                    )

        columns: list[
            CsvColumnPreview
        ] = []

        used_names: set[str] = set()

        for column_name in fieldnames:
            (
                inferred_type,
                nullable,
            ) = infer_postgres_type(
                column_values[
                    column_name
                ]
            )

            normalized_name = (
                _make_unique_identifier(
                    normalize_identifier(
                        column_name
                    ),
                    used_names,
                )
            )

            used_names.add(
                normalized_name
            )

            columns.append(
                CsvColumnPreview(
                    source_name=column_name,
                    postgres_name=(
                        normalized_name
                    ),
                    inferred_type=(
                        inferred_type
                    ),
                    nullable=nullable,
                )
            )

        return CsvPreviewResponse(
            success=True,
            file_name=os.path.basename(
                file_path
            ),
            delimiter=delimiter,
            encoding="UTF-8",
            total_rows=total_rows,
            columns=columns,
            preview_rows=preview_rows,
        )

    except UnicodeDecodeError:
        return CsvPreviewResponse(
            success=False,
            message=(
                "CSV must currently use UTF-8 encoding."
            ),
        )

    except Exception as exc:
        return CsvPreviewResponse(
            success=False,
            message=str(exc),
        )


def validate_csv_import(
    request: CsvValidationRequest,
) -> CsvValidationResponse:
    if not os.path.exists(
        request.file_path
    ):
        return CsvValidationResponse(
            success=False,
            valid=False,
            message="CSV file does not exist.",
        )

    validation_error = (
        _validate_request_columns(
            request.columns
        )
    )

    if validation_error:
        return CsvValidationResponse(
            success=True,
            valid=False,
            message=validation_error,
        )

    try:
        conninfo = build_conninfo(
            request.connection
        )

        with psycopg.connect(
            conninfo
        ) as connection:
            with connection.cursor() as cursor:
                if not _schema_exists(
                    cursor,
                    request.schema_name,
                ):
                    return CsvValidationResponse(
                        success=True,
                        valid=False,
                        message=(
                            "Destination schema "
                            f'"{request.schema_name}" '
                            "does not exist."
                        ),
                    )

                table_exists = (
                    _table_exists(
                        cursor,
                        request.schema_name,
                        request.table_name,
                    )
                )

                warnings: list[str] = []

                if (
                    request.mode == "create"
                    and table_exists
                ):
                    return CsvValidationResponse(
                        success=True,
                        valid=False,
                        table_exists=True,
                        message=(
                            "Destination table "
                            "already exists. "
                            "Choose Append, "
                            "Replace, or use a "
                            "different table name."
                        ),
                    )

                if (
                    request.mode == "append"
                    and not table_exists
                ):
                    return CsvValidationResponse(
                        success=True,
                        valid=False,
                        table_exists=False,
                        message=(
                            "Append requires an "
                            "existing destination "
                            "table."
                        ),
                    )

                destination_columns = []

                if table_exists:
                    destination_columns = (
                        _load_table_columns(
                            cursor,
                            request.schema_name,
                            request.table_name,
                        )
                    )

                if request.mode == "append":
                    append_error = (
                        _validate_append_mapping(
                            request.columns,
                            destination_columns,
                        )
                    )

                    if append_error:
                        return CsvValidationResponse(
                            success=True,
                            valid=False,
                            table_exists=True,
                            destination_columns=(
                                destination_columns
                            ),
                            message=append_error,
                        )

                if (
                    request.mode == "replace"
                    and table_exists
                ):
                    warnings.append(
                        "Replace will DROP the "
                        "existing table before "
                        "creating the imported "
                        "table."
                    )

        source_rows = _count_csv_rows(
            request.file_path
        )

        return CsvValidationResponse(
            success=True,
            valid=True,
            message=(
                "CSV import validation passed."
            ),
            table_exists=table_exists,
            source_rows=source_rows,
            destination_columns=(
                destination_columns
            ),
            warnings=warnings,
        )

    except psycopg.Error as exc:
        return CsvValidationResponse(
            success=False,
            valid=False,
            message=str(exc),
        )

    except Exception as exc:
        return CsvValidationResponse(
            success=False,
            valid=False,
            message=str(exc),
        )


def import_csv(
    request: CsvImportRequest,
) -> CsvImportResponse:
    started = time.perf_counter()

    if not os.path.exists(
        request.file_path
    ):
        return CsvImportResponse(
            success=False,
            message="CSV file does not exist.",
            mode=request.mode,
        )

    validation_request = (
        CsvValidationRequest(
            connection=request.connection,
            file_path=request.file_path,
            schema_name=request.schema_name,
            table_name=request.table_name,
            mode=request.mode,
            columns=request.columns,
        )
    )

    validation = validate_csv_import(
        validation_request
    )

    if (
        not validation.success
        or not validation.valid
    ):
        return CsvImportResponse(
            success=False,
            message=(
                validation.message
                or
                "CSV import validation failed."
            ),
            schema_name=(
                request.schema_name
            ),
            table_name=(
                request.table_name
            ),
            mode=request.mode,
            duration_ms=_elapsed_ms(
                started
            ),
        )

    try:
        conninfo = build_conninfo(
            request.connection
        )

        rows_read = 0
        rows_imported = 0
        rows_rejected = 0

        rejected_rows: list[
            CsvRejectedRow
        ] = []

        with psycopg.connect(
            conninfo
        ) as connection:
            try:
                with connection.cursor() as cursor:
                    table_exists = (
                        _table_exists(
                            cursor,
                            request.schema_name,
                            request.table_name,
                        )
                    )

                    if (
                        request.mode == "replace"
                        and table_exists
                    ):
                        cursor.execute(
                            sql.SQL(
                                "DROP TABLE {}.{}"
                            ).format(
                                sql.Identifier(
                                    request.schema_name
                                ),
                                sql.Identifier(
                                    request.table_name
                                ),
                            )
                        )

                        table_exists = False

                    if (
                        request.mode
                        in {
                            "create",
                            "replace",
                        }
                        and not table_exists
                    ):
                        _create_table(
                            cursor,
                            request.schema_name,
                            request.table_name,
                            request.columns,
                        )

                    postgres_columns = [
                        column.postgres_name
                        for column
                        in request.columns
                    ]

                    source_columns = [
                        column.source_name
                        for column
                        in request.columns
                    ]

                    insert_statement = (
                        sql.SQL(
                            "INSERT INTO {}.{} "
                            "({}) VALUES ({})"
                        ).format(
                            sql.Identifier(
                                request.schema_name
                            ),
                            sql.Identifier(
                                request.table_name
                            ),
                            sql.SQL(", ").join(
                                sql.Identifier(
                                    name
                                )
                                for name
                                in postgres_columns
                            ),
                            sql.SQL(", ").join(
                                sql.Placeholder()
                                for _
                                in postgres_columns
                            ),
                        )
                    )

                    (
                        delimiter,
                        _,
                    ) = _detect_csv(
                        request.file_path
                    )

                    with open(
                        request.file_path,
                        "r",
                        encoding="utf-8-sig",
                        newline="",
                    ) as csv_file:
                        reader = csv.DictReader(
                            csv_file,
                            delimiter=delimiter,
                        )

                        for (
                            row_number,
                            row,
                        ) in enumerate(
                            reader,
                            start=2,
                        ):
                            rows_read += 1

                            try:
                                values = [
                                    _convert_value(
                                        row.get(
                                            source_name
                                        ),
                                        request
                                        .columns[index]
                                        .inferred_type,
                                    )
                                    for (
                                        index,
                                        source_name,
                                    )
                                    in enumerate(
                                        source_columns
                                    )
                                ]

                                cursor.execute(
                                    "SAVEPOINT csv_row_import"
                                )

                                try:
                                    cursor.execute(
                                        insert_statement,
                                        values,
                                    )

                                    cursor.execute(
                                        "RELEASE SAVEPOINT csv_row_import"
                                    )

                                    rows_imported += 1

                                except Exception as row_error:
                                    cursor.execute(
                                        "ROLLBACK TO SAVEPOINT csv_row_import"
                                    )

                                    cursor.execute(
                                        "RELEASE SAVEPOINT csv_row_import"
                                    )

                                    rows_rejected += 1

                                    if (
                                        len(
                                            rejected_rows
                                        )
                                        <
                                        MAX_REJECTED_ROWS_RETURNED
                                    ):
                                        rejected_rows.append(
                                            CsvRejectedRow(
                                                row_number=(
                                                    row_number
                                                ),
                                                reason=str(
                                                    row_error
                                                ),
                                                row=dict(
                                                    row
                                                ),
                                            )
                                        )

                            except Exception as conversion_error:
                                rows_rejected += 1

                                if (
                                    len(
                                        rejected_rows
                                    )
                                    <
                                    MAX_REJECTED_ROWS_RETURNED
                                ):
                                    rejected_rows.append(
                                        CsvRejectedRow(
                                            row_number=(
                                                row_number
                                            ),
                                            reason=str(
                                                conversion_error
                                            ),
                                            row=dict(
                                                row
                                            ),
                                        )
                                    )

                    connection.commit()

            except Exception:
                connection.rollback()
                raise

        message = (
            "CSV import completed."
        )

        if rows_rejected:
            message = (
                "CSV import completed "
                f"with {rows_rejected} "
                "rejected row(s)."
            )

        return CsvImportResponse(
            success=True,
            message=message,
            schema_name=(
                request.schema_name
            ),
            table_name=(
                request.table_name
            ),
            mode=request.mode,
            rows_read=rows_read,
            rows_imported=(
                rows_imported
            ),
            rows_rejected=(
                rows_rejected
            ),
            rejected_rows=(
                rejected_rows
            ),
            duration_ms=_elapsed_ms(
                started
            ),
        )

    except psycopg.Error as exc:
        return CsvImportResponse(
            success=False,
            message=str(exc),
            schema_name=(
                request.schema_name
            ),
            table_name=(
                request.table_name
            ),
            mode=request.mode,
            duration_ms=_elapsed_ms(
                started
            ),
        )

    except Exception as exc:
        return CsvImportResponse(
            success=False,
            message=str(exc),
            schema_name=(
                request.schema_name
            ),
            table_name=(
                request.table_name
            ),
            mode=request.mode,
            duration_ms=_elapsed_ms(
                started
            ),
        )


def _create_table(
    cursor,
    schema_name: str,
    table_name: str,
    columns: list[
        CsvColumnPreview
    ],
) -> None:
    create_columns = []

    for column in columns:
        column_definition = (
            sql.SQL("{} {}").format(
                sql.Identifier(
                    column.postgres_name
                ),
                sql.SQL(
                    column.inferred_type
                ),
            )
        )

        create_columns.append(
            column_definition
        )

    statement = sql.SQL(
        "CREATE TABLE {}.{} ({})"
    ).format(
        sql.Identifier(
            schema_name
        ),
        sql.Identifier(
            table_name
        ),
        sql.SQL(", ").join(
            create_columns
        ),
    )

    cursor.execute(statement)


def _schema_exists(
    cursor,
    schema_name: str,
) -> bool:
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.schemata
            WHERE schema_name = %s
        );
        """,
        (schema_name,),
    )

    row = cursor.fetchone()

    return bool(
        row and row[0]
    )


def _table_exists(
    cursor,
    schema_name: str,
    table_name: str,
) -> bool:
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_name = %s
              AND table_type = 'BASE TABLE'
        );
        """,
        (
            schema_name,
            table_name,
        ),
    )

    row = cursor.fetchone()

    return bool(
        row and row[0]
    )


def _load_table_columns(
    cursor,
    schema_name: str,
    table_name: str,
) -> list[
    dict[str, Any]
]:
    cursor.execute(
        """
        SELECT
            column_name,
            data_type,
            is_nullable,
            ordinal_position
        FROM information_schema.columns
        WHERE table_schema = %s
          AND table_name = %s
        ORDER BY ordinal_position;
        """,
        (
            schema_name,
            table_name,
        ),
    )

    return [
        {
            "name": row[0],
            "data_type": row[1],
            "nullable": (
                row[2] == "YES"
            ),
            "position": row[3],
        }
        for row in cursor.fetchall()
    ]


def _validate_append_mapping(
    source_columns: list[
        CsvColumnPreview
    ],
    destination_columns: list[
        dict[str, Any]
    ],
) -> str | None:
    destination_names = {
        column["name"]
        for column
        in destination_columns
    }

    missing = [
        column.postgres_name
        for column
        in source_columns
        if column.postgres_name
        not in destination_names
    ]

    if missing:
        return (
            "The following mapped "
            "columns do not exist in "
            "the destination table: "
            + ", ".join(missing)
        )

    return None


def _validate_request_columns(
    columns: list[
        CsvColumnPreview
    ],
) -> str | None:
    if not columns:
        return (
            "At least one column "
            "must be imported."
        )

    names = [
        column.postgres_name.strip()
        for column in columns
    ]

    if any(
        not name
        for name in names
    ):
        return (
            "PostgreSQL column names "
            "cannot be blank."
        )

    if (
        len(names)
        != len(set(names))
    ):
        return (
            "PostgreSQL column names "
            "must be unique."
        )

    return None


def _read_csv_for_preview(
    file_path: str,
):
    delimiter, _ = _detect_csv(
        file_path
    )

    with open(
        file_path,
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as csv_file:
        reader = csv.DictReader(
            csv_file,
            delimiter=delimiter,
        )

        fieldnames = (
            reader.fieldnames or []
        )

        rows = list(reader)

    return (
        delimiter,
        fieldnames,
        rows,
    )


def _detect_csv(
    file_path: str,
) -> tuple[str, str]:
    with open(
        file_path,
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as csv_file:
        sample = csv_file.read(
            8192
        )

    try:
        dialect = (
            csv.Sniffer().sniff(
                sample
            )
        )

        delimiter = (
            dialect.delimiter
        )

    except csv.Error:
        delimiter = ","

    return (
        delimiter,
        "UTF-8",
    )


def _count_csv_rows(
    file_path: str,
) -> int:
    delimiter, _ = _detect_csv(
        file_path
    )

    with open(
        file_path,
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as csv_file:
        reader = csv.reader(
            csv_file,
            delimiter=delimiter,
        )

        next(
            reader,
            None,
        )

        return sum(
            1
            for _ in reader
        )


def _convert_value(
    value: str | None,
    postgres_type: str,
):
    if value is None:
        return None

    stripped = value.strip()

    if stripped == "":
        return None

    if postgres_type in {
        "BIGINT",
        "INTEGER",
    }:
        return int(
            stripped
        )

    if postgres_type in {
        "DOUBLE PRECISION",
        "NUMERIC",
    }:
        return float(
            stripped
        )

    if postgres_type == "BOOLEAN":
        lowered = (
            stripped.lower()
        )

        if lowered in {
            "true",
            "yes",
            "1",
        }:
            return True

        if lowered in {
            "false",
            "no",
            "0",
        }:
            return False

        raise ValueError(
            f'Invalid BOOLEAN value "{stripped}".'
        )

    return stripped


def _make_unique_identifier(
    value: str,
    used_names: set[str],
) -> str:
    if value not in used_names:
        return value

    suffix = 2

    while True:
        candidate = (
            f"{value}_{suffix}"
        )

        if (
            candidate
            not in used_names
        ):
            return candidate

        suffix += 1


def _elapsed_ms(
    started: float,
) -> float:
    return round(
        (
            time.perf_counter()
            - started
        )
        * 1000,
        2,
    )