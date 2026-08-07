import type {
  ObjectMetadataResponse,
} from "../../services/api";

interface ObjectDetailsProps {
  metadata: ObjectMetadataResponse;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export default function ObjectDetails({
  metadata,
  loading,
  error,
  onClose,
}: ObjectDetailsProps) {
  if (loading) {
    return (
      <div className="object-details">
        <div className="object-details-header">
          <strong>Object Details</strong>

          <button onClick={onClose}>
            ×
          </button>
        </div>

        <div className="object-details-empty">
          Loading metadata...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="object-details">
        <div className="object-details-header">
          <strong>Object Details</strong>

          <button onClick={onClose}>
            ×
          </button>
        </div>

        <div className="object-details-error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="object-details">
      <div className="object-details-header">
        <div>
          <span className="object-details-eyebrow">
            {metadata.object_type ?? "OBJECT"}
          </span>

          <strong>
            {metadata.schema}.{metadata.name}
          </strong>
        </div>

        <button onClick={onClose}>
          ×
        </button>
      </div>

      <div className="object-details-body">
        <section>
          <div className="object-details-section-title">
            Columns
          </div>

          <div className="metadata-table">
            <div className="metadata-row metadata-head">
              <span>Name</span>
              <span>Type</span>
              <span>Null</span>
              <span>Key</span>
            </div>

            {metadata.columns.map((column) => (
              <div
                className="metadata-row"
                key={column.name}
              >
                <span>{column.name}</span>

                <span>{column.data_type}</span>

                <span>
                  {column.nullable ? "YES" : "NO"}
                </span>

                <span>
                  {column.primary_key ? "PK" : ""}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="object-details-section-title">
            Defaults
          </div>

          {metadata.columns
            .filter((column) => column.default)
            .map((column) => (
              <div
                className="metadata-default"
                key={`default-${column.name}`}
              >
                <strong>{column.name}</strong>
                <span>{column.default}</span>
              </div>
            ))}

          {metadata.columns.every(
            (column) => !column.default,
          ) && (
            <div className="object-details-empty">
              No column defaults.
            </div>
          )}
        </section>

        <section>
          <div className="object-details-section-title">
            Indexes
          </div>

          {metadata.indexes.map((index) => (
            <div
              className="metadata-index"
              key={index.name}
            >
              <strong>{index.name}</strong>
              <code>{index.definition}</code>
            </div>
          ))}

          {metadata.indexes.length === 0 && (
            <div className="object-details-empty">
              No indexes found.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}