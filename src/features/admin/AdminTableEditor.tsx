import { useEffect, useMemo, useState } from "react";

import {
  createAdminTableRow,
  deleteAdminTableRow,
  loadAdminTableEditor,
  updateAdminTableRow,
  type AdminTableEditorColumn,
  type AdminTableEditorResponse,
} from "../../services/adminApi";

type Props = {
  open: boolean;
  schemaName: string | null;
  tableName: string | null;
  onClose: () => void;
  onChanged?: () => void | Promise<void>;
};

function asInputValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseEditorValue(column: AdminTableEditorColumn, raw: string): unknown {
  if (raw === "" && column.nullable) return null;

  const type = column.udt_name;
  if (["int2", "int4", "int8"].includes(type)) {
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? raw : parsed;
  }

  if (["numeric", "float4", "float8"].includes(type)) {
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? raw : parsed;
  }

  if (type === "bool") {
    return ["true", "t", "1", "yes", "y", "on"].includes(raw.trim().toLowerCase());
  }

  return raw;
}

export default function AdminTableEditor({
  open,
  schemaName,
  tableName,
  onClose,
  onChanged,
}: Props) {
  const [data, setData] = useState<AdminTableEditorResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Record<string, string>>>({});
  const [insertDraft, setInsertDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  async function refresh(nextOffset = offset) {
    if (!schemaName || !tableName) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await loadAdminTableEditor(schemaName, tableName, 100, nextOffset);
      setData(response);
      setOffset(nextOffset);
      setDrafts({});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open table editor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !schemaName || !tableName) return;
    setOffset(0);
    void refresh(0);
  }, [open, schemaName, tableName]);

  const columnIndex = useMemo(() => {
    const result: Record<string, number> = {};
    data?.columns.forEach((column, index) => {
      result[column.name] = index;
    });
    return result;
  }, [data]);

  if (!open) return null;

  async function saveRow(rowIndex: number) {
    if (!data || !schemaName || !tableName) return;

    const draft = drafts[rowIndex] ?? {};
    const row = data.rows[rowIndex];
    const pk: Record<string, unknown> = {};
    for (const key of data.primary_key) {
      pk[key] = row[columnIndex[key]];
    }

    const changes: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(draft)) {
      const column = data.columns.find((item) => item.name === key);
      if (!column) continue;
      changes[key] = parseEditorValue(column, raw);
    }

    if (!Object.keys(changes).length) {
      setMessage("No row changes to save.");
      return;
    }

    setLoading(true);
    try {
      await updateAdminTableRow(schemaName, tableName, pk, changes);
      setMessage("Row saved.");
      await refresh(offset);
      await onChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save row.");
      setLoading(false);
    }
  }

  async function deleteRow(rowIndex: number) {
    if (!data || !schemaName || !tableName) return;
    if (!window.confirm("Delete this row? Foreign-key protections remain enforced by PostgreSQL.")) return;

    const row = data.rows[rowIndex];
    const pk: Record<string, unknown> = {};
    for (const key of data.primary_key) {
      pk[key] = row[columnIndex[key]];
    }

    setLoading(true);
    try {
      await deleteAdminTableRow(schemaName, tableName, pk);
      setMessage("Row deleted.");
      await refresh(offset);
      await onChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete row.");
      setLoading(false);
    }
  }

  async function insertRow() {
    if (!data || !schemaName || !tableName) return;

    const values: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(insertDraft)) {
      const column = data.columns.find((item) => item.name === key);
      if (!column || raw === "") continue;
      values[key] = parseEditorValue(column, raw);
    }

    if (!Object.keys(values).length) {
      setMessage("Enter at least one value for the new row.");
      return;
    }

    setLoading(true);
    try {
      await createAdminTableRow(schemaName, tableName, values);
      setInsertDraft({});
      setMessage("Row inserted.");
      await refresh(0);
      await onChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to insert row.");
      setLoading(false);
    }
  }

  return (
    <div className="admin-table-editor-backdrop" role="dialog" aria-modal="true">
      <section className="admin-table-editor">
        <header className="admin-table-editor-header">
          <div>
            <span>ADMIN TABLE EDITOR</span>
            <h2>{schemaName}.{tableName}</h2>
            <small>
              {data ? `${data.total_rows} rows · primary key ${data.primary_key.join(", ")}` : "Loading metadata..."}
            </small>
          </div>
          <div className="admin-table-editor-header-actions">
            <button type="button" onClick={() => void refresh(offset)} disabled={loading}>Refresh</button>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </header>

        {message && <div className="admin-table-editor-message">{message}</div>}

        {data && (
          <>
            <div className="admin-table-editor-toolbar">
              <button
                type="button"
                disabled={offset <= 0 || loading}
                onClick={() => void refresh(Math.max(0, offset - data.limit))}
              >
                Previous
              </button>
              <span>
                Rows {data.total_rows ? offset + 1 : 0}–{Math.min(offset + data.row_count, data.total_rows)} of {data.total_rows}
              </span>
              <button
                type="button"
                disabled={offset + data.limit >= data.total_rows || loading}
                onClick={() => void refresh(offset + data.limit)}
              >
                Next
              </button>
            </div>

            <div className="admin-table-editor-grid-wrap">
              <table className="admin-table-editor-grid">
                <thead>
                  <tr>
                    {data.columns.map((column) => (
                      <th key={column.name}>
                        <strong>{column.name}</strong>
                        <small>{column.data_type}{data.primary_key.includes(column.name) ? " · PK" : ""}</small>
                      </th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="admin-table-editor-insert-row">
                    {data.columns.map((column) => {
                      const locked = column.identity || column.generated;
                      return (
                        <td key={`insert-${column.name}`}>
                          <input
                            disabled={locked}
                            value={insertDraft[column.name] ?? ""}
                            placeholder={locked ? "AUTO" : column.default ? "default" : column.nullable ? "NULL / value" : "required"}
                            onChange={(event) =>
                              setInsertDraft((current) => ({ ...current, [column.name]: event.target.value }))
                            }
                          />
                        </td>
                      );
                    })}
                    <td><button type="button" onClick={() => void insertRow()} disabled={loading}>Add Row</button></td>
                  </tr>

                  {data.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {data.columns.map((column, columnPosition) => {
                        const isPk = data.primary_key.includes(column.name);
                        const locked = isPk || column.identity || column.generated;
                        const value =
                          drafts[rowIndex]?.[column.name] ??
                          asInputValue(row[columnPosition]);

                        return (
                          <td key={`${rowIndex}-${column.name}`}>
                            <input
                              className={locked ? "locked" : ""}
                              disabled={locked}
                              value={value}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [rowIndex]: {
                                    ...(current[rowIndex] ?? {}),
                                    [column.name]: event.target.value,
                                  },
                                }))
                              }
                            />
                          </td>
                        );
                      })}
                      <td className="admin-table-editor-row-actions">
                        <button type="button" onClick={() => void saveRow(rowIndex)} disabled={loading || !drafts[rowIndex]}>Save</button>
                        <button type="button" className="danger" onClick={() => void deleteRow(rowIndex)} disabled={loading}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {loading && <div className="admin-table-editor-loading">Working...</div>}
      </section>
    </div>
  );
}
