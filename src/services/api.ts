import { API_BASE_URL } from "./apiBase";
import type { DatabaseConnectionForm } from "../features/connections/types";

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

/* Payload builder for the connection form. This is used to convert the form data into the expected payload for the API. */
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

/* Test a PostgreSQL connection using the provided form data. This function sends a POST request to the API to test the connection and returns the response. */

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

/* Load the database catalog for a PostgreSQL connection using the provided form data. This function sends a POST request to the API to retrieve the catalog and returns the response. */

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

/* Run a SQL query on a PostgreSQL connection using the provided form data. This function sends a POST request to the API to execute the query and returns the response. */

export interface QueryRunResponse {
  success: boolean;
  message?: string | null;

  columns: string[];
  rows: unknown[][];

  row_count: number;
  duration_ms: number;
}

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
    throw new Error(
      `Query service returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}

/* Load metadata for a specific database object (table, view, etc.) using the provided form data. This function sends a POST request to the API to retrieve the metadata and returns the response. */

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
    throw new Error(
      `Metadata service returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}