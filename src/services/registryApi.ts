const API_BASE_URL =
  "http://127.0.0.1:8000";

export type EesSystemStatus =
  | "active"
  | "development"
  | "offline"
  | "archived";

export interface EesSystem {
  system_id: string;

  system_name: string;
  system_key: string;

  domain: string;
  system_type: string;

  description?: string | null;

  status: EesSystemStatus;

  data_role?: string | null;

  primary_database?: string | null;

  api_base_url?: string | null;

  repository_url?: string | null;

  owner_name?: string | null;

  created_at: string;
  updated_at: string;
}

export interface EesDataset {
  dataset_id: string;

  system_id: string;

  dataset_name: string;
  dataset_key: string;

  domain: string;

  database_name?: string | null;

  schema_name?: string | null;

  object_name?: string | null;

  object_type?:
    | "table"
    | "view"
    | "materialized_view"
    | "file"
    | "stream"
    | "api"
    | null;

  source_type:
    | "postgresql"
    | "csv"
    | "parquet"
    | "duckdb"
    | "api"
    | "stream"
    | "nosql";

  classification: string;

  refresh_mode:
    | "realtime"
    | "scheduled"
    | "event"
    | "manual"
    | "static";

  description?: string | null;

  is_active: boolean;

  created_at: string;
  updated_at: string;
}

export interface RegistryOverview {
  success: boolean;

  systems: number;
  datasets: number;
  relationships: number;

  active_systems: number;
  active_datasets: number;
}

export async function loadRegistryOverview(): Promise<
  RegistryOverview
> {
  const response =
    await fetch(
      `${API_BASE_URL}/registry/overview`,
    );

  if (!response.ok) {
    throw new Error(
      `Registry overview returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}

export async function loadEesSystems(): Promise<
  EesSystem[]
> {
  const response =
    await fetch(
      `${API_BASE_URL}/registry/systems`,
    );

  if (!response.ok) {
    throw new Error(
      `EES systems service returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}

export async function loadEesDatasets(
  systemId?: string,
): Promise<EesDataset[]> {
  const url =
    systemId
      ? `${API_BASE_URL}/registry/datasets?system_id=${encodeURIComponent(
          systemId,
        )}`
      : `${API_BASE_URL}/registry/datasets`;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `EES datasets service returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}