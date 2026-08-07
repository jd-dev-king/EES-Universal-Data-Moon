import type {
  SavedQuery,
} from "../../services/savedQueryStore";

interface SavedQueriesPanelProps {
  queries: SavedQuery[];

  onSelect: (
    query: SavedQuery,
  ) => void;

  onDelete: (
    query: SavedQuery,
  ) => void;
}

export default function SavedQueriesPanel({
  queries,
  onSelect,
  onDelete,
}: SavedQueriesPanelProps) {
  return (
    <div className="saved-queries-panel">
      <div className="saved-queries-header">
        <div>
          <span>
            SAVED QUERIES
          </span>

          <strong>
            {queries.length} saved
          </strong>
        </div>
      </div>

      {queries.length === 0 ? (
        <div className="saved-queries-empty">
          No saved queries yet.
        </div>
      ) : (
        <div className="saved-queries-list">
          {queries.map(
            (query) => (
              <div
                className="saved-query-card"
                key={query.id}
              >
                <button
                  type="button"
                  className="saved-query-main"
                  onClick={() =>
                    onSelect(
                      query,
                    )
                  }
                >
                  <div className="saved-query-top">
                    <strong>
                      {query.name}
                    </strong>

                    <span>
                      {new Date(
                        query.updatedAt,
                      ).toLocaleString()}
                    </span>
                  </div>

                  <code>
                    {query.sql}
                  </code>

                  <div className="saved-query-meta">
                    {query.connectionName && (
                      <span>
                        {
                          query.connectionName
                        }
                      </span>
                    )}

                    {query.databaseName && (
                      <span>
                        {
                          query.databaseName
                        }
                      </span>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  className="saved-query-delete"
                  onClick={() =>
                    onDelete(
                      query,
                    )
                  }
                  title="Delete saved query"
                >
                  ×
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}