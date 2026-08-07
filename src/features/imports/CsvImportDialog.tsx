import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  open,
} from "@tauri-apps/plugin-dialog";

import type {
  DatabaseCatalogResponse,
} from "../../services/api";

import {
  importCsvToPostgres,
  previewCsv,
  validateCsvImport,
  type CsvColumnPreview,
  type CsvImportMode,
  type CsvImportResponse,
  type CsvPreviewResponse,
  type CsvValidationResponse,
} from "../../services/importApi";

import type {
  DatabaseConnectionForm,
} from "../connections/types";

import "./CsvImportDialog.css";

interface CsvImportDialogProps {
  openDialog: boolean;

  connection:
    DatabaseConnectionForm | null;

  catalog:
    DatabaseCatalogResponse | null;

  onClose: () => void;

  onImported: (
    schemaName: string,
    tableName: string,
  ) => void;
}

const POSTGRES_TYPES = [
  "TEXT",
  "BIGINT",
  "INTEGER",
  "DOUBLE PRECISION",
  "NUMERIC",
  "BOOLEAN",
  "TIMESTAMPTZ",
  "DATE",
];

export default function CsvImportDialog({
  openDialog,
  connection,
  catalog,
  onClose,
  onImported,
}: CsvImportDialogProps) {
  const [
    filePath,
    setFilePath,
  ] = useState("");

  const [
    preview,
    setPreview,
  ] =
    useState<CsvPreviewResponse | null>(
      null,
    );

  const [
    columns,
    setColumns,
  ] =
    useState<CsvColumnPreview[]>([]);

  const [
    mode,
    setMode,
  ] =
    useState<CsvImportMode>(
      "create",
    );

  const [
    schemaName,
    setSchemaName,
  ] = useState("");

  const [
    tableName,
    setTableName,
  ] = useState("");

  const [
    loadingPreview,
    setLoadingPreview,
  ] = useState(false);

  const [
    validating,
    setValidating,
  ] = useState(false);

  const [
    validation,
    setValidation,
  ] =
    useState<CsvValidationResponse | null>(
      null,
    );

  const [
    importing,
    setImporting,
  ] = useState(false);

  const [
    importResult,
    setImportResult,
  ] =
    useState<CsvImportResponse | null>(
      null,
    );

  const [
    status,
    setStatus,
  ] =
    useState<string | null>(
      null,
    );

  const [
    statusType,
    setStatusType,
  ] = useState<
    "idle" |
    "success" |
    "error" |
    "warning"
  >("idle");

  const schemaOptions =
    useMemo(
      () =>
        catalog?.schemas.map(
          (schema) =>
            schema.name,
        ) ?? [],
      [catalog],
    );

  const selectedSchema =
    useMemo(
      () =>
        catalog?.schemas.find(
          (schema) =>
            schema.name ===
            schemaName,
        ) ?? null,
      [
        catalog,
        schemaName,
      ],
    );

  const existingTables =
    selectedSchema?.tables ?? [];

  useEffect(() => {
    if (!openDialog) {
      return;
    }

    setFilePath("");
    setPreview(null);
    setColumns([]);

    setMode("create");

    setTableName("");

    setValidation(null);
    setImportResult(null);

    setStatus(null);
    setStatusType("idle");

    setSchemaName(
      schemaOptions.includes(
        "public",
      )
        ? "public"
        : schemaOptions[0] ??
            "",
    );
  }, [
    openDialog,
    schemaOptions,
  ]);

  useEffect(() => {
    if (!openDialog) {
      return;
    }

    invalidateValidation();

    if (
      mode === "append" ||
      mode === "replace"
    ) {
      if (
        !existingTables.includes(
          tableName,
        )
      ) {
        setTableName(
          existingTables[0] ??
            "",
        );
      }
    } else if (
      preview?.file_name
    ) {
      setTableName(
        buildSuggestedTableName(
          preview.file_name,
        ),
      );
    }
  }, [
    mode,
    schemaName,
  ]);

  if (!openDialog) {
    return null;
  }

  function invalidateValidation() {
    setValidation(null);
    setImportResult(null);

    setStatus(null);
    setStatusType("idle");
  }

  async function handleChooseFile() {
    try {
      const selected =
        await open({
          multiple: false,

          filters: [
            {
              name:
                "CSV Files",

              extensions: [
                "csv",
              ],
            },
          ],
        });

      if (
        !selected ||
        Array.isArray(
          selected,
        )
      ) {
        return;
      }

      setFilePath(
        selected,
      );

      setPreview(null);
      setColumns([]);

      setValidation(null);
      setImportResult(null);

      setStatus(null);
      setStatusType("idle");

      setMode("create");

      const fileName =
        getFileName(
          selected,
        );

      setTableName(
        buildSuggestedTableName(
          fileName,
        ),
      );
    } catch (error) {
      setStatusType(
        "error",
      );

      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to select CSV file.",
      );
    }
  }

  async function handlePreview() {
    if (!filePath) {
      setStatusType(
        "error",
      );

      setStatus(
        "Choose a CSV file first.",
      );

      return;
    }

    try {
      setLoadingPreview(
        true,
      );

      setValidation(null);
      setImportResult(null);

      setStatus(null);
      setStatusType("idle");

      const result =
        await previewCsv(
          filePath,
        );

      if (!result.success) {
        setStatusType(
          "error",
        );

        setStatus(
          result.message ??
            "CSV preview failed.",
        );

        return;
      }

      setPreview(
        result,
      );

      setColumns(
        result.columns.map(
          (column) => ({
            ...column,
          }),
        ),
      );

      if (
        mode === "create"
      ) {
        setTableName(
          buildSuggestedTableName(
            result.file_name ??
              "csv_import",
          ),
        );
      }

      setStatusType(
        "success",
      );

      setStatus(
        `Preview ready: ${result.total_rows} rows detected.`,
      );
    } catch (error) {
      setStatusType(
        "error",
      );

      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to preview CSV.",
      );
    } finally {
      setLoadingPreview(
        false,
      );
    }
  }

  function updateColumn(
    index: number,
    changes: Partial<CsvColumnPreview>,
  ) {
    setColumns(
      (current) =>
        current.map(
          (
            column,
            columnIndex,
          ) =>
            columnIndex ===
            index
              ? {
                  ...column,
                  ...changes,
                }
              : column,
        ),
    );

    invalidateValidation();
  }

  async function handleValidate() {
    if (!connection) {
      setStatusType(
        "error",
      );

      setStatus(
        "Connect to PostgreSQL before validating.",
      );

      return;
    }

    if (!preview) {
      setStatusType(
        "error",
      );

      setStatus(
        "Preview the CSV before validating.",
      );

      return;
    }

    if (!schemaName) {
      setStatusType(
        "error",
      );

      setStatus(
        "Choose a destination schema.",
      );

      return;
    }

    if (!tableName.trim()) {
      setStatusType(
        "error",
      );

      setStatus(
        "Choose or enter a destination table.",
      );

      return;
    }

    try {
      setValidating(
        true,
      );

      setValidation(null);
      setImportResult(null);

      setStatus(
        "Validating import..."
      );

      setStatusType(
        "idle",
      );

      const result =
        await validateCsvImport(
          connection,
          filePath,
          schemaName,
          tableName.trim(),
          mode,
          columns,
        );

      setValidation(
        result,
      );

      if (
        !result.success ||
        !result.valid
      ) {
        setStatusType(
          "error",
        );

        setStatus(
          result.message ??
            "Import validation failed.",
        );

        return;
      }

      if (
        result.warnings.length >
        0
      ) {
        setStatusType(
          "warning",
        );

        setStatus(
          result.warnings.join(
            " ",
          ),
        );
      } else {
        setStatusType(
          "success",
        );

        setStatus(
          result.message ??
            "Import validation passed.",
        );
      }
    } catch (error) {
      setStatusType(
        "error",
      );

      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to validate CSV import.",
      );
    } finally {
      setValidating(
        false,
      );
    }
  }

  async function handleImport() {
    if (!connection) {
      return;
    }

    if (
      !validation?.success ||
      !validation.valid
    ) {
      setStatusType(
        "error",
      );

      setStatus(
        "Validate the import before continuing.",
      );

      return;
    }

    try {
      setImporting(
        true,
      );

      setImportResult(
        null,
      );

      setStatus(
        "Importing CSV..."
      );

      setStatusType(
        "idle",
      );

      const result =
        await importCsvToPostgres(
          connection,
          filePath,
          schemaName,
          tableName.trim(),
          mode,
          columns,
        );

      setImportResult(
        result,
      );

      if (!result.success) {
        setStatusType(
          "error",
        );

        setStatus(
          result.message ??
            "CSV import failed.",
        );

        return;
      }

      if (
        result.rows_rejected >
        0
      ) {
        setStatusType(
          "warning",
        );
      } else {
        setStatusType(
          "success",
        );
      }

      setStatus(
        `${result.message ?? "CSV import completed."} ` +
          `${result.rows_imported} of ${result.rows_read} rows imported in ${result.duration_ms} ms.`,
      );
    } catch (error) {
      setStatusType(
        "error",
      );

      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to import CSV.",
      );
    } finally {
      setImporting(
        false,
      );
    }
  }

  function handleOpenImportedTable() {
    if (
      !importResult?.success
    ) {
      return;
    }

    onImported(
      schemaName,
      tableName.trim(),
    );
  }

  return (
    <div
      className="csv-import-overlay"
      onMouseDown={
        onClose
      }
    >
      <div
        className="csv-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-title"
        onMouseDown={(
          event,
        ) =>
          event.stopPropagation()
        }
      >
        <div className="csv-import-header">
          <div>
            <span>
              DATA INGESTION
            </span>

            <h2 id="csv-import-title">
              Import CSV
            </h2>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            aria-label="Close CSV import"
          >
            ×
          </button>
        </div>

        <div className="csv-import-body">
          <section className="csv-import-section">
            <div className="csv-import-section-title">
              Source File
            </div>

            <div className="csv-file-row">
              <div className="csv-file-path">
                {filePath ||
                  "No CSV selected"}
              </div>

              <button
                type="button"
                onClick={
                  handleChooseFile
                }
              >
                Choose CSV
              </button>

              <button
                type="button"
                disabled={
                  !filePath ||
                  loadingPreview
                }
                onClick={
                  handlePreview
                }
              >
                {loadingPreview
                  ? "Reading..."
                  : "Preview"}
              </button>
            </div>
          </section>

          {preview && (
            <>
              <section className="csv-import-section">
                <div className="csv-import-summary">
                  <span>
                    File
                    <strong>
                      {
                        preview.file_name
                      }
                    </strong>
                  </span>

                  <span>
                    Rows
                    <strong>
                      {
                        preview.total_rows
                      }
                    </strong>
                  </span>

                  <span>
                    Columns
                    <strong>
                      {
                        preview.columns
                          .length
                      }
                    </strong>
                  </span>

                  <span>
                    Delimiter
                    <strong>
                      {
                        preview.delimiter
                      }
                    </strong>
                  </span>

                  <span>
                    Encoding
                    <strong>
                      {
                        preview.encoding
                      }
                    </strong>
                  </span>
                </div>
              </section>

              <section className="csv-import-section">
                <div className="csv-import-section-title">
                  Import Mode
                </div>

                <div className="csv-mode-selector">
                  <button
                    type="button"
                    className={
                      mode ===
                      "create"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setMode(
                        "create",
                      )
                    }
                  >
                    <strong>
                      Create
                    </strong>

                    <span>
                      Create a new PostgreSQL table.
                    </span>
                  </button>

                  <button
                    type="button"
                    className={
                      mode ===
                      "append"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setMode(
                        "append",
                      )
                    }
                  >
                    <strong>
                      Append
                    </strong>

                    <span>
                      Add rows to an existing table.
                    </span>
                  </button>

                  <button
                    type="button"
                    className={
                      mode ===
                      "replace"
                        ? "active danger"
                        : "danger"
                    }
                    onClick={() =>
                      setMode(
                        "replace",
                      )
                    }
                  >
                    <strong>
                      Replace
                    </strong>

                    <span>
                      Drop and rebuild an existing table.
                    </span>
                  </button>
                </div>
              </section>

              <section className="csv-import-section">
                <div className="csv-import-section-title">
                  Destination
                </div>

                <div className="csv-destination-grid">
                  <label>
                    <span>
                      Schema
                    </span>

                    <select
                      value={
                        schemaName
                      }
                      onChange={(
                        event,
                      ) => {
                        setSchemaName(
                          event.target
                            .value,
                        );

                        invalidateValidation();
                      }}
                    >
                      {schemaOptions.map(
                        (schema) => (
                          <option
                            key={
                              schema
                            }
                            value={
                              schema
                            }
                          >
                            {
                              schema
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    <span>
                      {mode ===
                      "create"
                        ? "New Table"
                        : "Existing Table"}
                    </span>

                    {mode ===
                    "create" ? (
                      <input
                        type="text"
                        value={
                          tableName
                        }
                        onChange={(
                          event,
                        ) => {
                          setTableName(
                            event.target
                              .value,
                          );

                          invalidateValidation();
                        }}
                      />
                    ) : (
                      <select
                        value={
                          tableName
                        }
                        onChange={(
                          event,
                        ) => {
                          setTableName(
                            event.target
                              .value,
                          );

                          invalidateValidation();
                        }}
                      >
                        {existingTables.length ===
                        0 ? (
                          <option value="">
                            No tables available
                          </option>
                        ) : (
                          existingTables.map(
                            (
                              table,
                            ) => (
                              <option
                                key={
                                  table
                                }
                                value={
                                  table
                                }
                              >
                                {
                                  table
                                }
                              </option>
                            ),
                          )
                        )}
                      </select>
                    )}
                  </label>
                </div>

                {mode ===
                  "replace" && (
                  <div className="csv-destructive-warning">
                    Replace will permanently
                    drop the selected table
                    and recreate it from this
                    CSV.
                  </div>
                )}
              </section>

              <section className="csv-import-section">
                <div className="csv-import-section-title">
                  Column Mapping
                </div>

                <div className="csv-column-map">
                  <div className="csv-column-map-row csv-column-map-head">
                    <span>
                      CSV Column
                    </span>

                    <span>
                      PostgreSQL Name
                    </span>

                    <span>
                      Type
                    </span>

                    <span>
                      Null
                    </span>
                  </div>

                  {columns.map(
                    (
                      column,
                      index,
                    ) => (
                      <div
                        className="csv-column-map-row"
                        key={`${column.source_name}-${index}`}
                      >
                        <span>
                          {
                            column.source_name
                          }
                        </span>

                        <input
                          value={
                            column.postgres_name
                          }
                          onChange={(
                            event,
                          ) =>
                            updateColumn(
                              index,
                              {
                                postgres_name:
                                  event
                                    .target
                                    .value,
                              },
                            )
                          }
                        />

                        <select
                          value={
                            column.inferred_type
                          }
                          onChange={(
                            event,
                          ) =>
                            updateColumn(
                              index,
                              {
                                inferred_type:
                                  event
                                    .target
                                    .value,
                              },
                            )
                          }
                        >
                          {POSTGRES_TYPES.map(
                            (
                              type,
                            ) => (
                              <option
                                key={
                                  type
                                }
                                value={
                                  type
                                }
                              >
                                {
                                  type
                                }
                              </option>
                            ),
                          )}
                        </select>

                        <span>
                          {column.nullable
                            ? "YES"
                            : "NO"}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </section>

              <section className="csv-import-section">
                <div className="csv-import-section-title">
                  Data Preview
                </div>

                <div className="csv-preview-table-wrap">
                  <table className="csv-preview-table">
                    <thead>
                      <tr>
                        {preview.columns.map(
                          (
                            column,
                          ) => (
                            <th
                              key={
                                column.source_name
                              }
                            >
                              {
                                column.source_name
                              }
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {preview.preview_rows.map(
                        (
                          row,
                          rowIndex,
                        ) => (
                          <tr
                            key={
                              rowIndex
                            }
                          >
                            {preview.columns.map(
                              (
                                column,
                              ) => (
                                <td
                                  key={`${rowIndex}-${column.source_name}`}
                                >
                                  {String(
                                    row[
                                      column
                                        .source_name
                                    ] ??
                                      "",
                                  )}
                                </td>
                              ),
                            )}
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {validation?.valid && (
                <section className="csv-import-section">
                  <div className="csv-import-section-title">
                    Validation
                  </div>

                  <div className="csv-validation-summary">
                    <span>
                      Source Rows
                      <strong>
                        {
                          validation.source_rows
                        }
                      </strong>
                    </span>

                    <span>
                      Destination
                      <strong>
                        {schemaName}.
                        {tableName}
                      </strong>
                    </span>

                    <span>
                      Mode
                      <strong>
                        {mode.toUpperCase()}
                      </strong>
                    </span>

                    <span>
                      Table Exists
                      <strong>
                        {validation.table_exists
                          ? "YES"
                          : "NO"}
                      </strong>
                    </span>
                  </div>
                </section>
              )}

              {importResult?.success && (
                <section className="csv-import-section">
                  <div className="csv-import-section-title">
                    Import Report
                  </div>

                  <div className="csv-import-report">
                    <div>
                      <span>
                        Rows Read
                      </span>

                      <strong>
                        {
                          importResult.rows_read
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Imported
                      </span>

                      <strong>
                        {
                          importResult.rows_imported
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Rejected
                      </span>

                      <strong>
                        {
                          importResult.rows_rejected
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Duration
                      </span>

                      <strong>
                        {
                          importResult.duration_ms
                        }{" "}
                        ms
                      </strong>
                    </div>
                  </div>

                  {importResult.rejected_rows.length >
                    0 && (
                    <div className="csv-rejected-rows">
                      <div className="csv-rejected-title">
                        Rejected Rows
                      </div>

                      {importResult.rejected_rows.map(
                        (
                          rejected,
                        ) => (
                          <div
                            className="csv-rejected-row"
                            key={`${rejected.row_number}-${rejected.reason}`}
                          >
                            <div>
                              <strong>
                                Row{" "}
                                {
                                  rejected.row_number
                                }
                              </strong>

                              <span>
                                {
                                  rejected.reason
                                }
                              </span>
                            </div>

                            <code>
                              {JSON.stringify(
                                rejected.row,
                              )}
                            </code>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          {status && (
            <div
              className={`csv-import-status ${statusType}`}
            >
              {status}
            </div>
          )}
        </div>

        <div className="csv-import-footer">
          <button
            type="button"
            onClick={
              onClose
            }
          >
            Cancel
          </button>

          {preview &&
            !importResult?.success && (
              <button
                type="button"
                disabled={
                  validating ||
                  importing ||
                  !connection ||
                  !tableName.trim()
                }
                onClick={
                  handleValidate
                }
              >
                {validating
                  ? "Validating..."
                  : validation?.valid
                    ? "Revalidate"
                    : "Validate"}
              </button>
            )}

          {validation?.valid &&
            !importResult?.success && (
              <button
                type="button"
                className={
                  mode ===
                  "replace"
                    ? "danger-action"
                    : "primary-action"
                }
                disabled={
                  importing
                }
                onClick={
                  handleImport
                }
              >
                {importing
                  ? "Importing..."
                  : mode ===
                      "replace"
                    ? "Replace Table"
                    : mode ===
                        "append"
                      ? "Append Rows"
                      : "Import CSV"}
              </button>
            )}

          {importResult?.success && (
            <button
              type="button"
              className="primary-action"
              onClick={
                handleOpenImportedTable
              }
            >
              Open Table
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getFileName(
  path: string,
) {
  return (
    path
      .split(/[\\/]/)
      .pop() ??
    "csv_import"
  );
}

function buildSuggestedTableName(
  fileName: string,
) {
  const normalized =
    fileName
      .replace(
        /\.csv$/i,
        "",
      )
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9_]+/g,
        "_",
      )
      .replace(
        /^_+|_+$/g,
        "",
      );

  return (
    normalized ||
    "csv_import"
  );
}