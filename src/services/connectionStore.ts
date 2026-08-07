import { HybridStore } from "./hybridStore";

import type {
  DatabaseConnectionForm,
} from "../features/connections/types";

const store = new HybridStore("connections.json");

export interface SavedConnection {
  id: string;

  type: DatabaseConnectionForm["type"];
  method: DatabaseConnectionForm["method"];

  name: string;

  host: string;
  port: string;
  database: string;
  username: string;

  connectionUrl: string;

  sslMode: DatabaseConnectionForm["sslMode"];

  createdAt: string;
  updatedAt: string;
}

const CONNECTIONS_KEY = "saved-connections";

export async function loadSavedConnections(): Promise<
  SavedConnection[]
> {
  return (
    (await store.get<SavedConnection[]>(
      CONNECTIONS_KEY,
    )) ?? []
  );
}

export async function saveConnection(
  form: DatabaseConnectionForm,
): Promise<SavedConnection> {
  const connections =
    await loadSavedConnections();

  const now = new Date().toISOString();

  const existing =
    connections.find(
      (connection) =>
        connection.name === form.name,
    );

  const saved: SavedConnection = {
    id:
      existing?.id ??
      crypto.randomUUID(),

    type: form.type,
    method: form.method,

    name: form.name,

    host: form.host,
    port: form.port,
    database: form.database,
    username: form.username,

    connectionUrl:
      sanitizeConnectionUrl(
        form.connectionUrl,
      ),

    sslMode: form.sslMode,

    createdAt:
      existing?.createdAt ?? now,

    updatedAt: now,
  };

  const nextConnections = existing
    ? connections.map((connection) =>
        connection.id === existing.id
          ? saved
          : connection,
      )
    : [...connections, saved];

  await store.set(
    CONNECTIONS_KEY,
    nextConnections,
  );

  await store.save();

  return saved;
}

export async function deleteSavedConnection(
  id: string,
): Promise<void> {
  const connections =
    await loadSavedConnections();

  const nextConnections =
    connections.filter(
      (connection) =>
        connection.id !== id,
    );

  await store.set(
    CONNECTIONS_KEY,
    nextConnections,
  );

  await store.save();
}

function sanitizeConnectionUrl(
  connectionUrl: string,
): string {
  if (!connectionUrl.trim()) {
    return "";
  }

  try {
    const url =
      new URL(connectionUrl);

    url.password = "";

    return url.toString();
  } catch {
    return "";
  }
}

export function savedConnectionToForm(
  connection: SavedConnection,
): DatabaseConnectionForm {
  return {
    type: connection.type,
    method: connection.method,

    name: connection.name,

    host: connection.host,
    port: connection.port,
    database: connection.database,
    username: connection.username,

    password: "",

    connectionUrl:
      connection.connectionUrl,

    sslMode:
      connection.sslMode,
  };
}