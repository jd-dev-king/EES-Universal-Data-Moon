import {
  API_BASE_URL,
  MANAGED_EES_API_BASE_URL,
} from "./apiBase";

import type {
  DatabaseConnectionForm,
} from "../features/connections/types";


export interface ConnectionTestResponse {
  success: boolean;
  message: string;
  server_version?: string | null;
  database?: string | null;
}


export interface DatabaseSchema {
  name: string;
  tables: string[];
  views: string[];
  functions: string[];
  sequences: string[];
}


export interface DatabaseCatalogResponse {
  success: boolean;
  message?: string;
  database?: string | null;
  schemas: DatabaseSchema[];
}


/*
 * ------------------------------------------------------------
 * PRIVATE / ADMIN CONNECTION PAYLOAD
 * ------------------------------------------------------------
 *
 * Used by the existing connection dialog.
 * Credentials are supplied by the user and sent to the backend.
 */

function buildConnectionPayload(
  form: DatabaseConnectionForm,
) {
  return form.method === "url"
    ? {
      method: "url",
      name: form.name,
      connection_url: form.connectionUrl,
      ssl_mode: form.sslMode,
    }
    : {
      method: "host",
      name: form.name,
      host: form.host,
      port: Number(form.port),
      database: form.database,
      username: form.username,
      password: form.password,
      ssl_mode: form.sslMode,
    };
}


/*
 * ------------------------------------------------------------
 * PRIVATE / ADMIN CONNECTION TEST
 * ------------------------------------------------------------
 */

export async function testPostgresConnection(
  form: DatabaseConnectionForm,
): Promise<ConnectionTestResponse> {
  const response = await fetch(
    `${API_BASE_URL}/connections/test`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildConnectionPayload(form),
      ),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Connection service returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}


/*
 * ------------------------------------------------------------
 * PRIVATE / ADMIN DATABASE CATALOG
 * ------------------------------------------------------------
 */

export async function loadPostgresCatalog(
  form: DatabaseConnectionForm,
): Promise<DatabaseCatalogResponse> {
  const response = await fetch(
    `${API_BASE_URL}/connections/catalog`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildConnectionPayload(form),
      ),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Catalog service returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}


/*
 * ------------------------------------------------------------
 * QUERY RESPONSE
 * ------------------------------------------------------------
 */

export interface QueryRunResponse {
  success: boolean;
  message?: string | null;

  columns: string[];
  rows: unknown[][];

  row_count: number;
  duration_ms: number;

  read_only?: boolean;
}


/*
 * ------------------------------------------------------------
 * PRIVATE / ADMIN SQL QUERY
 * ------------------------------------------------------------
 */

export async function runPostgresQuery(
  form: DatabaseConnectionForm,
  sql: string,
): Promise<QueryRunResponse> {
  const response = await fetch(
    `${API_BASE_URL}/queries/run`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        connection:
          buildConnectionPayload(form),

        sql,
      }),
    },
  );

  if (!response.ok) {
    let message =
      `Query service returned HTTP ${response.status}.`;

    try {
      const error = await response.json();

      if (error?.detail) {
        message = error.detail;
      } else if (error?.message) {
        message = error.message;
      }
    } catch {
      // Keep fallback message.
    }

    throw new Error(message);
  }

  return response.json();
}


/*
 * ------------------------------------------------------------
 * PRIVATE / ADMIN OBJECT METADATA
 * ------------------------------------------------------------
 */

export interface ColumnMetadata {
  name: string;
  data_type: string;
  nullable: boolean;
  default?: string | null;
  position: number;
  primary_key: boolean;
}


export interface IndexMetadata {
  name: string;
  definition: string;
}


export interface ObjectMetadataResponse {
  success: boolean;
  message?: string | null;

  schema?: string | null;
  name?: string | null;
  object_type?: string | null;

  columns: ColumnMetadata[];
  indexes: IndexMetadata[];
}


export async function loadObjectMetadata(
  form: DatabaseConnectionForm,
  schemaName: string,
  objectName: string,
): Promise<ObjectMetadataResponse> {
  const response = await fetch(
    `${API_BASE_URL}/connections/object-metadata`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        connection:
          buildConnectionPayload(form),

        schema_name: schemaName,
        object_name: objectName,
      }),
    },
  );

  if (!response.ok) {
    let message =
      `Metadata service returned HTTP ${response.status}.`;

    try {
      const error = await response.json();

      if (error?.detail) {
        message = error.detail;
      } else if (error?.message) {
        message = error.message;
      }
    } catch {
      // Keep fallback message.
    }

    throw new Error(message);
  }

  return response.json();
}


/*
 * ============================================================
 * MANAGED EES DATA PLATFORM
 * ============================================================
 *
 * These routes NEVER receive PostgreSQL credentials.
 *
 * The Railway-hosted EES Universal Data Moon API resolves
 * DATABASE_URL server-side and provides governed read-only
 * access to ees_data_platform.
 *
 * Browser:
 *
 *   Data Moon UI
 *       ↓
 *   /api/*
 *       ↓
 *   Data Moon Railway API
 *       ↓
 *   DATABASE_URL
 *       ↓
 *   ees_data_platform
 */


/*
 * ------------------------------------------------------------
 * MANAGED HEALTH
 * ------------------------------------------------------------
 */

export interface ManagedDatabaseHealth {
  status: string;
  service: string;
  version: string;

  database: string;
  database_user: string;

  mode: string;
}


export async function getManagedDatabaseHealth(): Promise<ManagedDatabaseHealth> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/health`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Managed database health returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}


/*
 * ------------------------------------------------------------
 * MANAGED SCHEMA LIST
 * ------------------------------------------------------------
 */

interface ManagedSchemaListResponse {
  schemas: string[];
}


export async function loadManagedSchemas(): Promise<string[]> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/catalog/schemas`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Managed schema service returned HTTP ${response.status}.`,
    );
  }

  const data: ManagedSchemaListResponse =
    await response.json();

  return data.schemas ?? [];
}


/*
 * ------------------------------------------------------------
 * MANAGED TABLE / VIEW LIST
 * ------------------------------------------------------------
 */

export interface ManagedCatalogObject {
  name: string;
  type: string;
}


interface ManagedSchemaObjectsResponse {
  schema: string;
  tables: ManagedCatalogObject[];
}


export async function loadManagedSchemaObjects(
  schemaName: string,
): Promise<ManagedCatalogObject[]> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/catalog/schemas/${encodeURIComponent(
      schemaName,
    )}/tables`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Unable to load managed schema ${schemaName}.`,
    );
  }

  const data: ManagedSchemaObjectsResponse =
    await response.json();

  return data.tables ?? [];
}


/*
 * ------------------------------------------------------------
 * MANAGED FULL CATALOG
 * ------------------------------------------------------------
 */

export async function loadManagedCatalog(): Promise<DatabaseCatalogResponse> {
  const health =
    await getManagedDatabaseHealth();

  const schemaNames =
    await loadManagedSchemas();

  const schemas: DatabaseSchema[] =
    await Promise.all(
      schemaNames.map(
        async (
          schemaName,
        ): Promise<DatabaseSchema> => {
          const objects =
            await loadManagedSchemaObjects(
              schemaName,
            );

          const tables =
            objects
              .filter(
                (item) =>
                  item.type
                    .toUpperCase() ===
                  "BASE TABLE",
              )
              .map(
                (item) =>
                  item.name,
              );

          const views =
            objects
              .filter((item) => {
                const type =
                  item.type.toUpperCase();

                return (
                  type === "VIEW" ||
                  type ===
                  "MATERIALIZED VIEW"
                );
              })
              .map(
                (item) =>
                  item.name,
              );

          return {
            name: schemaName,
            tables,
            views,
            functions: [],
            sequences: [],
          };
        },
      ),
    );

  return {
    success: true,
    message:
      "Managed EES Data Platform catalog loaded.",
    database:
      health.database ||
      "ees_data_platform",
    schemas,
  };
}


/*
 * ------------------------------------------------------------
 * MANAGED COLUMN METADATA
 * ------------------------------------------------------------
 */

export interface ManagedColumnMetadata {
  name: string;
  data_type: string;
  nullable: boolean;
  default?: string | null;
  position: number;
}


export interface ManagedColumnsResponse {
  schema: string;
  table: string;
  columns: ManagedColumnMetadata[];
}


export async function loadManagedColumns(
  schemaName: string,
  tableName: string,
): Promise<ManagedColumnsResponse> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/catalog/${encodeURIComponent(
      schemaName,
    )}/${encodeURIComponent(
      tableName,
    )}/columns`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let message =
      `Managed metadata returned HTTP ${response.status}.`;

    try {
      const error =
        await response.json();

      if (error?.detail) {
        message = error.detail;
      }
    } catch {
      // Keep fallback.
    }

    throw new Error(message);
  }

  return response.json();
}

export async function loadManagedObjectMetadata(
  schemaName: string,
  objectName: string,
): Promise<ObjectMetadataResponse> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/catalog/${encodeURIComponent(
      schemaName,
    )}/${encodeURIComponent(
      objectName,
    )}/metadata`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let message =
      `Managed metadata returned HTTP ${response.status}.`;

    try {
      const error = await response.json();

      if (error?.detail) {
        message = error.detail;
      }
    } catch {
      // Keep fallback message.
    }

    throw new Error(message);
  }

  return response.json();
}


/*
 * ------------------------------------------------------------
 * MANAGED ROW COUNT
 * ------------------------------------------------------------
 */

export interface ManagedRowCountResponse {
  schema: string;
  table: string;
  row_count: number;
}


export async function loadManagedRowCount(
  schemaName: string,
  tableName: string,
): Promise<ManagedRowCountResponse> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/catalog/${encodeURIComponent(
      schemaName,
    )}/${encodeURIComponent(
      tableName,
    )}/count`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Managed row count returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}


/*
 * ------------------------------------------------------------
 * MANAGED TABLE SAMPLE
 * ------------------------------------------------------------
 */

export interface ManagedTableSampleResponse {
  schema: string;
  table: string;

  columns: string[];
  rows: unknown[][];

  row_count: number;
}


export async function loadManagedTableSample(
  schemaName: string,
  tableName: string,
  limit = 25,
): Promise<ManagedTableSampleResponse> {
  const safeLimit =
    Math.max(
      1,
      Math.min(
        100,
        Math.floor(limit),
      ),
    );

  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/catalog/${encodeURIComponent(
      schemaName,
    )}/${encodeURIComponent(
      tableName,
    )}/sample?limit=${safeLimit}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let message =
      `Managed table preview returned HTTP ${response.status}.`;

    try {
      const error =
        await response.json();

      if (error?.detail) {
        message = error.detail;
      }
    } catch {
      // Keep fallback.
    }

    throw new Error(message);
  }

  return response.json();
}


/*
 * ------------------------------------------------------------
 * MANAGED READ-ONLY QUERY
 * ------------------------------------------------------------
 */

export async function runManagedQuery(
  sql: string,
  limit = 250,
): Promise<QueryRunResponse> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/query`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        sql,
        limit: Math.min(limit, 500),
      }),
    },
  );

  if (!response.ok) {
    let message =
      `Managed query returned HTTP ${response.status}.`;

    try {
      const error =
        await response.json();

      if (error?.detail) {
        message =
          typeof error.detail === "string"
            ? error.detail
            : JSON.stringify(error.detail);
      } else if (error?.message) {
        message =
          typeof error.message === "string"
            ? error.message
            : JSON.stringify(error.message);
      }
    } catch {
      // Keep fallback.
    }

    throw new Error(message);
  }

  return response.json();
}
/* ============================================================
 * MANAGED EES DOCUMENT STORE / MONGODB
 * ============================================================ */

export interface DocumentCollectionSummary {
  name: string;
  document_count: number;
}

export interface DocumentCollectionsResponse {
  database: string;
  collections: DocumentCollectionSummary[];
}

export interface DocumentQueryResponse {
  success: boolean;
  collection: string;
  documents: Record<string, unknown>[];
  document_count: number;
}

async function documentApiError(response: Response, fallback: string) {
  try {
    const error = await response.json();
    const detail = error?.detail ?? error?.message;
    return typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : fallback;
  } catch {
    return fallback;
  }
}

export async function loadDocumentCollections(): Promise<DocumentCollectionsResponse> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/documents/collections`,
    { cache: "no-store", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await documentApiError(response, `Document catalog returned HTTP ${response.status}.`));
  }
  return response.json();
}

export async function browseDocumentCollection(
  collection: string,
  limit = 50,
): Promise<DocumentQueryResponse> {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/documents/collections/${encodeURIComponent(collection)}?limit=${safeLimit}`,
    { cache: "no-store", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await documentApiError(response, `Document browse returned HTTP ${response.status}.`));
  }
  return response.json();
}

export async function runDocumentQuery(
  collection: string,
  filter: Record<string, unknown>,
  limit = 100,
  sortField?: string,
  sortDirection = -1,
): Promise<DocumentQueryResponse> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/documents/query`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection,
        filter,
        limit: Math.max(1, Math.min(500, Math.floor(limit))),
        sort_field: sortField || null,
        sort_direction: sortDirection >= 0 ? 1 : -1,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await documentApiError(response, `Document query returned HTTP ${response.status}.`));
  }
  return response.json();
}

export interface DocumentAggregationResponse {
  success: boolean;
  collection: string;
  results: Record<string, unknown>[];
  result_count: number;
  duration_ms: number;
  read_only: boolean;
}

export async function runDocumentAggregation(
  collection: string,
  pipeline: Record<string, unknown>[],
  limit = 250,
): Promise<DocumentAggregationResponse> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/documents/aggregate`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection,
        pipeline,
        limit: Math.max(1, Math.min(500, Math.floor(limit))),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await documentApiError(
        response,
        `Document aggregation returned HTTP ${response.status}.`,
      ),
    );
  }

  return response.json();
}



export type SavedVisualizationChartType = "bar" | "line" | "scatter" | "pie";

export interface SavedVisualization {
  _id: string;
  title: string;
  collection: string;
  system_key?: string | null;
  dashboard_name: string;
  chart_type: SavedVisualizationChartType;
  x_key: string;
  y_key: string;
  pipeline: Record<string, unknown>[];
  rows: Record<string, unknown>[];
  created_at: string;
  created_by?: string;
}

export async function loadSavedVisualizations(): Promise<SavedVisualization[]> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/documents/visualizations`,
    { cache: "no-store", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await documentApiError(response, `Saved visualizations returned HTTP ${response.status}.`));
  }
  const data = await response.json();
  return data.visualizations || [];
}

export async function saveDocumentVisualization(input: {
  title: string;
  collection: string;
  system_key?: string;
  dashboard_name: string;
  chart_type: SavedVisualizationChartType;
  x_key: string;
  y_key: string;
  pipeline: Record<string, unknown>[];
  rows: Record<string, unknown>[];
}): Promise<SavedVisualization> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/documents/admin/visualizations`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(await documentApiError(response, `Save visualization returned HTTP ${response.status}.`));
  }
  const data = await response.json();
  return data.visualization;
}

export async function deleteDocumentVisualization(id: string): Promise<void> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/documents/admin/visualizations/${encodeURIComponent(id)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await documentApiError(response, `Delete visualization returned HTTP ${response.status}.`));
  }
}
