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
