import { API_BASE_URL } from "./apiBase";
import type {
  DatabaseConnectionForm,
} from "../features/connections/types";

export type CsvImportMode =
  | "create"
  | "append"
  | "replace";

export interface CsvColumnPreview {
  source_name: string;
  postgres_name: string;
  inferred_type: string;
  nullable: boolean;
}

export interface CsvPreviewResponse {
  success: boolean;
  message?: string | null;

  file_name?: string | null;
  delimiter?: string | null;
  encoding?: string | null;

  total_rows: number;

  columns: CsvColumnPreview[];

  preview_rows: Record<
    string,
    unknown
  >[];
}

export interface DestinationColumn {
  name: string;
  data_type: string;
  nullable: boolean;
  position: number;
}

export interface CsvValidationResponse {
  success: boolean;
  valid: boolean;

  message?: string | null;

  table_exists: boolean;
  source_rows: number;

  destination_columns:
    DestinationColumn[];

  warnings: string[];
}

export interface CsvRejectedRow {
  row_number: number;
  reason: string;

  row: Record<
    string,
    unknown
  >;
}

export interface CsvImportResponse {
  success: boolean;
  message?: string | null;

  schema_name?: string | null;
  table_name?: string | null;

  mode?: CsvImportMode | null;

  rows_read: number;
  rows_imported: number;
  rows_rejected: number;

  rejected_rows:
    CsvRejectedRow[];

  duration_ms: number;
}

function buildConnectionPayload(
  form: DatabaseConnectionForm,
) {
  return form.method === "url"
    ? {
        method: "url",
        name: form.name,

        connection_url:
          form.connectionUrl,

        ssl_mode:
          form.sslMode,
      }
    : {
        method: "host",
        name: form.name,

        host: form.host,
        port: Number(
          form.port,
        ),

        database:
          form.database,

        username:
          form.username,

        password:
          form.password,

        ssl_mode:
          form.sslMode,
      };
}

export async function previewCsv(
  filePath: string,
): Promise<CsvPreviewResponse> {
  const response =
    await fetch(
      `${API_BASE_URL}/imports/csv/preview`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          file_path:
            filePath,
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      `CSV preview service returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}

export async function validateCsvImport(
  form: DatabaseConnectionForm,
  filePath: string,
  schemaName: string,
  tableName: string,
  mode: CsvImportMode,
  columns: CsvColumnPreview[],
): Promise<CsvValidationResponse> {
  const response =
    await fetch(
      `${API_BASE_URL}/imports/csv/validate`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          connection:
            buildConnectionPayload(
              form,
            ),

          file_path:
            filePath,

          schema_name:
            schemaName,

          table_name:
            tableName,

          mode,

          columns,
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      `CSV validation service returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}

export async function importCsvToPostgres(
  form: DatabaseConnectionForm,
  filePath: string,
  schemaName: string,
  tableName: string,
  mode: CsvImportMode,
  columns: CsvColumnPreview[],
): Promise<CsvImportResponse> {
  const response =
    await fetch(
      `${API_BASE_URL}/imports/csv/import`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          connection:
            buildConnectionPayload(
              form,
            ),

          file_path:
            filePath,

          schema_name:
            schemaName,

          table_name:
            tableName,

          mode,

          columns,
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      `CSV import service returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}