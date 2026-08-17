import { API_BASE_URL } from "./apiBase";

export interface AdminSession { authenticated: boolean; username?: string; }
export interface AdminStatementResult {
  command: string;
  columns: string[];
  rows: unknown[][];
  row_count: number;
}

export interface AdminQueryResult {
  success: boolean;
  message?: string | null;

  columns: string[];
  rows: unknown[][];

  row_count: number;
  duration_ms: number;

  admin?: boolean;

  statements_executed?: number;
  total_affected?: number;

  results?: AdminStatementResult[];

  username?: string;
}

async function parseError(response: Response, fallback: string) {
  try { const data = await response.json(); return data?.detail ?? data?.message ?? fallback; } catch { return fallback; }
}

export async function getAdminSession(): Promise<AdminSession> {
  const response = await fetch(`${API_BASE_URL}/api/admin/session`, { credentials: "include", cache: "no-store" });
  if (response.status === 401) return { authenticated: false };
  if (!response.ok) throw new Error(await parseError(response, "Unable to check admin session."));
  return response.json();
}

export async function adminLogin(username: string, password: string): Promise<AdminSession> {
  const response = await fetch(`${API_BASE_URL}/api/admin/login`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
  if (!response.ok) throw new Error(await parseError(response, "Admin sign-in failed."));
  return response.json();
}

export async function adminLogout(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/admin/logout`, { method: "POST", credentials: "include" });
}

export async function runManagedAdminQuery(sql: string, limit = 1000): Promise<AdminQueryResult> {
  const response = await fetch(`${API_BASE_URL}/api/admin/query`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql, limit }) });
  if (!response.ok) throw new Error(await parseError(response, `Admin query returned HTTP ${response.status}.`));
  return response.json();
}


export interface DemoAdminOverview {
  admin: string; sessions: number; active_sessions: number; reset_requests: number; pending_reset_requests: number;
}
export interface DemoResetRequest {
  request_id: string;
  session_id?: string | null;
  reset_scope: string;
  operator: string;
  reason: string;
  status: string;
  requested_at: string;
  completed_at?: string | null;
  admin_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}
export interface DemoSessionRow {
  session_id: string; status: string; created_at: string; last_seen_at: string; active_entities: number; entities?: string | null;
}

export async function getDemoAdminOverview(): Promise<DemoAdminOverview> {
  const response = await fetch(`${API_BASE_URL}/api/admin/demo/overview`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response, "Unable to load demo admin overview."));
  return response.json();
}

export async function getDemoResetRequests(): Promise<{rows: DemoResetRequest[]; message?: string}> {
  const response = await fetch(`${API_BASE_URL}/api/admin/demo/reset-requests`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response, "Unable to load reset requests."));
  return response.json();
}

export async function getDemoSessions(): Promise<{rows: DemoSessionRow[]; message?: string}> {
  const response = await fetch(`${API_BASE_URL}/api/admin/demo/sessions`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response, "Unable to load demo sessions."));
  return response.json();
}

export async function reviewDemoResetRequest(requestId: string, status: string, adminNote?: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/admin/demo/reset-requests/${encodeURIComponent(requestId)}`, {
    method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, admin_note: adminNote ?? null }),
  });
  if (!response.ok) throw new Error(await parseError(response, "Unable to update reset request."));
}


export interface DemoBaselineStatus {
  admin: string;
  active_sessions: number;
  safe_for_global_reconciliation: boolean;
  supply_baseline_rows: number;
  staging_baseline_rows: number;
  bulk_baseline_rows: number;
  po_pool_next?: number | null;
  po_pool_generation?: number | null;
}

export async function getDemoBaselineStatus(): Promise<DemoBaselineStatus> {
  const response = await fetch(`${API_BASE_URL}/api/admin/demo/baseline-status`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await parseError(response, "Unable to load demo baseline status."));
  return response.json();
}

export async function restoreDemoInventoryBaseline(confirmation: string, adminNote?: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/admin/demo/restore-inventory-baseline`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation, admin_note: adminNote ?? null }),
  });
  if (!response.ok) throw new Error(await parseError(response, "Unable to restore demo inventory baseline."));
  return response.json();
}

export async function resetDemoPoPool(confirmation: string, adminNote?: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/admin/demo/reset-po-pool`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation, admin_note: adminNote ?? null }),
  });
  if (!response.ok) throw new Error(await parseError(response, "Unable to reset demo PO pool."));
  return response.json();
}


export async function getDemoResetHistory(): Promise<{rows: DemoResetRequest[]}> {
  const response = await fetch(`${API_BASE_URL}/api/admin/demo/reset-history`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await parseError(response, "Unable to load demo reset history."));
  return response.json();
}


export interface AdminTableEditorColumn {
  name: string;
  data_type: string;
  udt_name: string;
  nullable: boolean;
  default?: string | null;
  identity: boolean;
  generated: boolean;
  ordinal_position: number;
}

export interface AdminTableEditorResponse {
  schema: string;
  table: string;
  admin: string;
  columns: AdminTableEditorColumn[];
  primary_key: string[];
  rows: unknown[][];
  row_count: number;
  total_rows: number;
  limit: number;
  offset: number;
}

export async function loadAdminTableEditor(
  schemaName: string,
  tableName: string,
  limit = 100,
  offset = 0,
): Promise<AdminTableEditorResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/table-editor/${encodeURIComponent(schemaName)}/${encodeURIComponent(tableName)}?limit=${limit}&offset=${offset}`,
    { credentials: "include", cache: "no-store" },
  );
  if (!response.ok) throw new Error(await parseError(response, "Unable to open Admin Table Editor."));
  return response.json();
}

export async function updateAdminTableRow(
  schemaName: string,
  tableName: string,
  primaryKey: Record<string, unknown>,
  changes: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/table-editor/${encodeURIComponent(schemaName)}/${encodeURIComponent(tableName)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primary_key: primaryKey, changes }),
    },
  );
  if (!response.ok) throw new Error(await parseError(response, "Unable to update table row."));
}

export async function createAdminTableRow(
  schemaName: string,
  tableName: string,
  values: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/table-editor/${encodeURIComponent(schemaName)}/${encodeURIComponent(tableName)}`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
  if (!response.ok) throw new Error(await parseError(response, "Unable to insert table row."));
}

export async function deleteAdminTableRow(
  schemaName: string,
  tableName: string,
  primaryKey: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/table-editor/${encodeURIComponent(schemaName)}/${encodeURIComponent(tableName)}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primary_key: primaryKey }),
    },
  );
  if (!response.ok) throw new Error(await parseError(response, "Unable to delete table row."));
}
