import { IS_TAURI } from "./apiBase";

type JsonValue = unknown;

export class HybridStore {
  private readonly fileName: string;
  private tauriStore: any | null = null;

  constructor(fileName: string) {
    this.fileName = fileName;
  }

  private storageKey(key: string) {
    return `ees-data-moon:${this.fileName}:${key}`;
  }

  private async getTauriStore() {
    if (!IS_TAURI) return null;
    if (this.tauriStore) return this.tauriStore;

    const { LazyStore } = await import("@tauri-apps/plugin-store");
    this.tauriStore = new LazyStore(this.fileName);
    return this.tauriStore;
  }

  async get<T extends JsonValue>(key: string): Promise<T | null> {
    const store = await this.getTauriStore();
    if (store) {
      return ((await store.get(key)) as T | null) ?? null;
    }

    const raw = localStorage.getItem(this.storageKey(key));
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T extends JsonValue>(key: string, value: T): Promise<void> {
    const store = await this.getTauriStore();
    if (store) {
      await store.set(key, value);
      return;
    }

    localStorage.setItem(this.storageKey(key), JSON.stringify(value));
  }

  async save(): Promise<void> {
    const store = await this.getTauriStore();
    if (store) await store.save();
  }
}
