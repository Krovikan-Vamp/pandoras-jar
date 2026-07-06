import type { MetaSaveData, RunState } from "./schema.js";

/**
 * Platform-agnostic persistence contract — docs/TECHNICAL_SPEC.md §3.
 * `IndexedDbSaveAdapter` (web) and, eventually, `TauriFsSaveAdapter`
 * (desktop) both implement this against the same two-tier
 * `MetaSaveData`/`RunState` schema; callers select an implementation at
 * runtime (e.g. via `window.__TAURI__` feature detection) without knowing
 * which backend they're talking to.
 */
export interface SaveAdapter {
  loadMeta(): Promise<MetaSaveData>;
  saveMeta(data: MetaSaveData): Promise<void>;
  /** Resolves to null if there's no run in progress. */
  loadRun(): Promise<RunState | null>;
  saveRun(data: RunState): Promise<void>;
  /** Called on run completion/death — `RunState` doesn't persist across runs. */
  clearRun(): Promise<void>;
}
