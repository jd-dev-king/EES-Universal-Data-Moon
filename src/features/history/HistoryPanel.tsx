import type {
  QueryHistoryEntry,
} from "../../services/queryHistoryStore";

interface HistoryPanelProps {
  entries: QueryHistoryEntry[];
  onSelect: (entry: QueryHistoryEntry) => void;
  onClear: () => void;
}

export default function HistoryPanel({
  entries,
  onSelect,
  onClear,
}: HistoryPanelProps) {
  return (
    <div className="history-panel">
      <div className="history-header">
        <div>
          <span>QUERY HISTORY</span>
          <strong>{entries.length} entries</strong>
        </div>

        <button
          type="button"
          onClick={onClear}
          disabled={entries.length === 0}
        >
          Clear
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="history-empty">
          No query history yet.
        </div>
      ) : (
        <div className="history-list">
          {entries.map((entry) => (
            <button
              type="button"
              key={entry.id}
              className="history-item"
              onClick={() => onSelect(entry)}
            >
              <div className="history-item-top">
                <span
                  className={`history-status ${
                    entry.success
                      ? "success"
                      : "error"
                  }`}
                />

                <strong>
                  {entry.databaseName}
                </strong>

                <span className="history-time">
                  {new Date(
                    entry.executedAt,
                  ).toLocaleString()}
                </span>
              </div>

              <code>
                {entry.sql}
              </code>

              <div className="history-meta">
                <span>
                  {entry.rowCount} rows
                </span>

                <span>
                  {entry.durationMs} ms
                </span>

                <span>
                  {entry.connectionName}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}