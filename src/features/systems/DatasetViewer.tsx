import {
  useEffect,
  useState,
} from "react";

import type {
  EesDataset,
} from "../../services/registryApi";

import {
  loadManagedColumns,
  loadManagedRowCount,
  loadManagedTableSample,
  type ManagedColumnsResponse,
  type ManagedTableSampleResponse,
} from "../../services/api";

import "./DatasetViewer.css";

interface DatasetViewerProps {
  dataset: EesDataset;
  onClose: () => void;
}

export default function DatasetViewer({
  dataset,
  onClose,
}: DatasetViewerProps) {
  const [columns, setColumns] =
    useState<ManagedColumnsResponse | null>(null);
  const [sample, setSample] =
    useState<ManagedTableSampleResponse | null>(null);
  const [rowCount, setRowCount] =
    useState<number | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const schemaName = dataset.schema_name;
  const objectName = dataset.object_name;

  useEffect(() => {
    let cancelled = false;

    async function loadDataset() {
      if (!schemaName || !objectName) {
        setError(
          "This registered dataset does not have a schema/object mapping.",
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setColumns(null);
      setSample(null);
      setRowCount(null);

      try {
        const [columnResult, countResult, sampleResult] =
          await Promise.all([
            loadManagedColumns(schemaName, objectName),
            loadManagedRowCount(schemaName, objectName),
            loadManagedTableSample(schemaName, objectName, 25),
          ]);

        if (cancelled) return;

        setColumns(columnResult);
        setRowCount(countResult.row_count);
        setSample(sampleResult);
      } catch (caught) {
        if (cancelled) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load this dataset.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDataset();

    return () => {
      cancelled = true;
    };
  }, [schemaName, objectName]);

  return (
    <div
      className="ees-dataset-viewer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="ees-dataset-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={`Dataset viewer: ${dataset.dataset_name}`}
      >
        <header className="ees-dataset-viewer-header">
          <div>
            <span>READ-ONLY DATASET</span>
            <strong>{dataset.dataset_name}</strong>
            <code>
              {dataset.database_name ?? "ees_data_platform"}.
              {schemaName ?? "—"}.{objectName ?? "—"}
            </code>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dataset viewer"
          >
            ×
          </button>
        </header>

        <div className="ees-dataset-viewer-body">
          <div className="ees-dataset-viewer-summary">
            <ViewerStat label="Object Type" value={dataset.object_type ?? "—"} />
            <ViewerStat
              label="Rows"
              value={rowCount === null ? "—" : rowCount.toLocaleString()}
            />
            <ViewerStat
              label="Columns"
              value={columns ? String(columns.columns.length) : "—"}
            />
            <ViewerStat label="Access" value="Read only" />
          </div>

          {loading && (
            <div className="ees-dataset-viewer-state">
              Loading live dataset metadata and sample rows…
            </div>
          )}

          {error && (
            <div className="ees-dataset-viewer-error">
              <strong>Dataset unavailable</strong>
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && columns && (
            <section className="ees-dataset-viewer-section">
              <div className="ees-dataset-viewer-section-title">
                Columns
              </div>

              <div className="ees-dataset-column-grid">
                {columns.columns.map((column) => (
                  <div
                    key={`${column.position}-${column.name}`}
                    className="ees-dataset-column-card"
                  >
                    <strong>{column.name}</strong>
                    <span>{column.data_type}</span>
                    <small>
                      {column.nullable ? "nullable" : "required"}
                    </small>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!loading && !error && sample && (
            <section className="ees-dataset-viewer-section">
              <div className="ees-dataset-viewer-section-heading">
                <div>
                  <div className="ees-dataset-viewer-section-title">
                    Data Preview
                  </div>
                  <span>First {sample.row_count} rows · managed API</span>
                </div>
                <span className="ees-readonly-badge">READ ONLY</span>
              </div>

              {sample.columns.length === 0 ? (
                <div className="ees-dataset-viewer-state">
                  This dataset returned no columns.
                </div>
              ) : (
                <div className="ees-dataset-table-wrap">
                  <table className="ees-dataset-table">
                    <thead>
                      <tr>
                        {sample.columns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sample.rows.length === 0 ? (
                        <tr>
                          <td colSpan={sample.columns.length}>
                            No rows are currently available.
                          </td>
                        </tr>
                      ) : (
                        sample.rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((value, cellIndex) => (
                              <td key={`${rowIndex}-${cellIndex}`}>
                                {formatValue(value)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function ViewerStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="ees-dataset-viewer-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
