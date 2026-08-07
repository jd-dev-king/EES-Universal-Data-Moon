import { HybridStore } from "./hybridStore";

const store = new HybridStore("saved-queries.json");

const SAVED_QUERIES_KEY = "saved-queries";

export interface SavedQuery {
  id: string;

  name: string;
  sql: string;

  connectionName?: string | null;
  databaseName?: string | null;

  createdAt: string;
  updatedAt: string;
}

export async function loadSavedQueries(): Promise<
  SavedQuery[]
> {
  return (
    (await store.get<SavedQuery[]>(
      SAVED_QUERIES_KEY,
    )) ?? []
  );
}

export async function saveQuery(
  name: string,
  sql: string,
  connectionName?: string | null,
  databaseName?: string | null,
): Promise<SavedQuery> {
  const current =
    await loadSavedQueries();

  const now =
    new Date().toISOString();

  const existing =
    current.find(
      (query) =>
        query.name.trim().toLowerCase() ===
        name.trim().toLowerCase(),
    );

  const saved: SavedQuery = {
    id:
      existing?.id ??
      crypto.randomUUID(),

    name: name.trim(),

    sql,

    connectionName:
      connectionName ?? null,

    databaseName:
      databaseName ?? null,

    createdAt:
      existing?.createdAt ?? now,

    updatedAt: now,
  };

  const next = existing
    ? current.map((query) =>
        query.id === existing.id
          ? saved
          : query,
      )
    : [saved, ...current];

  await store.set(
    SAVED_QUERIES_KEY,
    next,
  );

  await store.save();

  return saved;
}

export async function deleteSavedQuery(
  id: string,
): Promise<void> {
  const current =
    await loadSavedQueries();

  const next =
    current.filter(
      (query) =>
        query.id !== id,
    );

  await store.set(
    SAVED_QUERIES_KEY,
    next,
  );

  await store.save();
}