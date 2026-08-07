import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("settings.json");

const SETTINGS_KEY = "app-settings";

export interface AppSettings {
  defaultSslMode:
    | "disable"
    | "allow"
    | "prefer"
    | "require"
    | "verify-ca"
    | "verify-full";

  connectionTimeoutSeconds: number;

  resultRowLimit: number;

  autocompleteEnabled: boolean;
  autoFormatEnabled: boolean;
  confirmDestructiveSql: boolean;

  maxHistoryEntries: number;

  securePasswordStorageEnabled: boolean;
}

export const defaultSettings: AppSettings = {
  defaultSslMode: "prefer",

  connectionTimeoutSeconds: 5,

  resultRowLimit: 1000,

  autocompleteEnabled: true,
  autoFormatEnabled: false,
  confirmDestructiveSql: true,

  maxHistoryEntries: 250,

  securePasswordStorageEnabled: false,
};

export async function loadSettings(): Promise<AppSettings> {
  const saved =
    await store.get<Partial<AppSettings>>(
      SETTINGS_KEY,
    );

  return {
    ...defaultSettings,
    ...(saved ?? {}),
  };
}

export async function saveSettings(
  settings: AppSettings,
): Promise<void> {
  await store.set(
    SETTINGS_KEY,
    settings,
  );

  await store.save();
}

export async function resetSettings(): Promise<AppSettings> {
  await store.set(
    SETTINGS_KEY,
    defaultSettings,
  );

  await store.save();

  return {
    ...defaultSettings,
  };
}