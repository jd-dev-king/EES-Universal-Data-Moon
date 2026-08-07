import { useState } from "react";

import type {
  DatabaseCatalogResponse,
  DatabaseSchema,
} from "../../services/api";


/* ConnectionExplorer is a component that displays the connection tree for a given connection and database. It allows users to expand and collapse the connection, database, and schemas, as well as preview objects by double-clicking on them. */

interface ConnectionExplorerProps {
  connectionName: string;
  databaseName: string;
  catalog: DatabaseCatalogResponse;

  onPreviewObject: (
    schemaName: string,
    objectName: string,
  ) => void;

  onSelectObject: (
    schemaName: string,
    objectName: string,
  ) => void;
}

export default function ConnectionExplorer({
  connectionName,
  databaseName,
  catalog,
  onPreviewObject,
  onSelectObject,
}: ConnectionExplorerProps) {
  const [expandedConnection, setExpandedConnection] =
    useState(true);

  const [expandedDatabase, setExpandedDatabase] =
    useState(true);

  const [expandedSchemas, setExpandedSchemas] =
    useState<Record<string, boolean>>({});

  function toggleSchema(schema: DatabaseSchema) {
    setExpandedSchemas((current) => ({
      ...current,
      [schema.name]: !current[schema.name],
    }));
  }

  return (
    <div className="connection-tree">
      <button
        className="tree-row connection-row"
        onClick={() =>
          setExpandedConnection(
            (current) => !current,
          )
        }
      >
        <span>
          {expandedConnection ? "▾" : "▸"}
        </span>

        <span className="connection-dot" />

        <strong>{connectionName}</strong>
      </button>

      {expandedConnection && (
        <div className="tree-level">
          <button
            className="tree-row"
            onClick={() =>
              setExpandedDatabase(
                (current) => !current,
              )
            }
          >
            <span>
              {expandedDatabase ? "▾" : "▸"}
            </span>

            <span>Database</span>
          </button>

          {expandedDatabase && (
            <div className="tree-level">
              <div className="tree-row database-name">
                <span>◫</span>
                <strong>{databaseName}</strong>
              </div>

              <div className="tree-level">
                <div className="tree-section-title">
                  Schemas
                </div>

                {catalog.schemas.map((schema) => {
                  const expanded =
                    expandedSchemas[schema.name] ??
                    false;

                  return (
                    <div key={schema.name}>
                      <button
                        className="tree-row"
                        onClick={() =>
                          toggleSchema(schema)
                        }
                      >
                        <span>
                          {expanded
                            ? "▾"
                            : "▸"}
                        </span>

                        <span>{schema.name}</span>
                      </button>

                      {expanded && (
                        <div className="tree-level">
                          <div className="tree-object">
                            Tables
                            <span>
                              {schema.tables.length}
                            </span>
                          </div>

                          {schema.tables.map(
                            (table) => (
                              <button
                                className="tree-object-item tree-object-button"
                                key={`table-${table}`}
                                onClick={() =>
                                  onSelectObject(schema.name, table)
                                }
                                onDoubleClick={() =>
                                  onPreviewObject(schema.name, table)
                                }
                                title="Click for details • Double-click to preview"
                              >
                                ▦ {table}
                              </button>
                            ),
                          )}

                          <div className="tree-object">
                            Views
                            <span>{schema.views.length}</span>
                          </div>

                          {schema.views.map((view) => (
                            <button
                              className="tree-object-item tree-object-button"
                              key={`view-${view}`}
                              onClick={() =>
                                onSelectObject(schema.name, view)
                              }
                              onDoubleClick={() =>
                                onPreviewObject(schema.name, view)
                              }
                              title="Click for details • Double-click to preview"
                            >
                              ◫ {view}
                            </button>
                          ))}

                          <div className="tree-object">
                            Functions
                            <span>
                              {
                                schema.functions
                                  .length
                              }
                            </span>
                          </div>

                          <div className="tree-object">
                            Sequences
                            <span>
                              {
                                schema.sequences
                                  .length
                              }
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}