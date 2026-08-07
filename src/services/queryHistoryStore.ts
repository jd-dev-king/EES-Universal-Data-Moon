import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("query-history.json");

const HISTORY_KEY = "query-history";
const MAX_HISTORY = 250;

export interface QueryHistoryEntry {
  id: string;

  connectionName: string;
  databaseName: string;

  sql: string;

  success: boolean;
  message?: string | null;

  rowCount: number;
  durationMs: number;

  executedAt: string;
}

export async function loadQueryHistory(): Promise<
  QueryHistoryEntry[]
> {
  return (
    (await store.get<QueryHistoryEntry[]>(
      HISTORY_KEY,
    )) ?? []
  );
}

export async function addQueryHistory(
  entry: Omit<QueryHistoryEntry, "id" | "executedAt">,
): Promise<QueryHistoryEntry> {
  const current = await loadQueryHistory();

  const saved: QueryHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    executedAt: new Date().toISOString(),
  };

  const next = [saved, ...current].slice(
    0,
    MAX_HISTORY,
  );

  await store.set(HISTORY_KEY, next);
  await store.save();

  return saved;
}

export async function clearQueryHistory(): Promise<void> {
  await store.set(HISTORY_KEY, []);
  await store.save();
}