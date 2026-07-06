import { openDB, type IDBPDatabase } from "idb";
import { migrateMetaSaveData, migrateRunState } from "./migrations.js";
import type { MetaSaveData, RunState } from "./schema.js";
import type { SaveAdapter } from "./SaveAdapter.js";

const DB_NAME = "pithos-save";
const DB_VERSION = 1;
const STORE_NAME = "pithos-save";
const META_KEY = "meta";
const RUN_KEY = "run";

function openSaveDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

/**
 * Web `SaveAdapter` backed by IndexedDB via `idb` — docs/TECHNICAL_SPEC.md
 * §3. A single object store (`"pithos-save"`) holds two keys, `"meta"` and
 * `"run"`. Every load is routed through `migrateMetaSaveData`/
 * `migrateRunState` so malformed or stale data self-heals into sane
 * defaults instead of throwing. Browser-only (relies on the global
 * `indexedDB`) — not meant to run under Tauri/desktop.
 */
export class IndexedDbSaveAdapter implements SaveAdapter {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDb(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openSaveDb();
    }
    return this.dbPromise;
  }

  async loadMeta(): Promise<MetaSaveData> {
    const db = await this.getDb();
    const raw = await db.get(STORE_NAME, META_KEY);
    return migrateMetaSaveData(raw);
  }

  async saveMeta(data: MetaSaveData): Promise<void> {
    const db = await this.getDb();
    await db.put(STORE_NAME, data, META_KEY);
  }

  async loadRun(): Promise<RunState | null> {
    const db = await this.getDb();
    const raw = await db.get(STORE_NAME, RUN_KEY);
    if (raw === undefined) {
      return null;
    }
    return migrateRunState(raw);
  }

  async saveRun(data: RunState): Promise<void> {
    const db = await this.getDb();
    await db.put(STORE_NAME, data, RUN_KEY);
  }

  async clearRun(): Promise<void> {
    const db = await this.getDb();
    await db.delete(STORE_NAME, RUN_KEY);
  }
}
