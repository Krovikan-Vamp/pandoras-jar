import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbSaveAdapter } from "./IndexedDbSaveAdapter.js";
import { createDefaultMetaSaveData, createDefaultRunState, type MetaSaveData, type RunState } from "./schema.js";

const DB_NAME = "pithos-save";
const STORE_NAME = "pithos-save";

beforeEach(() => {
  // Fresh, empty IndexedDB per test — every adapter instance opens the same
  // "pithos-save" database name, so without this, state would leak between
  // tests in this file.
  globalThis.indexedDB = new IDBFactory();
});

/** Writes directly to the store, bypassing the adapter's typed save methods,
 * to simulate a corrupted/pre-migration blob already sitting in IndexedDB. */
async function writeRaw(key: string, value: unknown): Promise<void> {
  const db = await openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    },
  });
  await db.put(STORE_NAME, value, key);
  db.close();
}

describe("IndexedDbSaveAdapter", () => {
  it("loadMeta returns sane defaults when nothing has been saved yet", async () => {
    const adapter = new IndexedDbSaveAdapter();
    expect(await adapter.loadMeta()).toEqual(createDefaultMetaSaveData());
  });

  it("loadRun returns null when no run is in progress", async () => {
    const adapter = new IndexedDbSaveAdapter();
    expect(await adapter.loadRun()).toBeNull();
  });

  it("round-trips meta save data", async () => {
    const adapter = new IndexedDbSaveAdapter();
    const meta: MetaSaveData = {
      schemaVersion: 1,
      ichor: 1234,
      unlockedSchools: ["fire", "water"],
      permanentUnlocks: ["reliquary.stamina-1"],
      startingLevelBonus: 5,
    };

    await adapter.saveMeta(meta);

    expect(await adapter.loadMeta()).toEqual(meta);
  });

  it("round-trips run state", async () => {
    const adapter = new IndexedDbSaveAdapter();
    const run: RunState = {
      schemaVersion: 1,
      currentWingId: "wing-earth",
      currentFloorIndex: 3,
      activeSchoolId: "earth",
      activeFormId: "solid",
      activePerkIds: ["bulwark", "momentum"],
      motes: 220,
      slotLevels: { passive: 2, primary: 5, secondary: 4, tertiary: 3, ultimate: 1 },
    };

    await adapter.saveRun(run);

    expect(await adapter.loadRun()).toEqual(run);
  });

  it("clearRun removes the saved run without touching meta", async () => {
    const adapter = new IndexedDbSaveAdapter();
    const meta: MetaSaveData = { ...createDefaultMetaSaveData(), ichor: 50 };
    const run: RunState = { ...createDefaultRunState(), motes: 10 };

    await adapter.saveMeta(meta);
    await adapter.saveRun(run);

    await adapter.clearRun();

    expect(await adapter.loadRun()).toBeNull();
    expect(await adapter.loadMeta()).toEqual(meta);
  });

  it("self-heals a malformed/pre-migration meta blob on load instead of throwing", async () => {
    await writeRaw("meta", { schemaVersion: 0, garbage: true });

    const adapter = new IndexedDbSaveAdapter();
    await expect(adapter.loadMeta()).resolves.toEqual(createDefaultMetaSaveData());
  });

  it("self-heals a malformed run blob on load instead of throwing", async () => {
    await writeRaw("run", "not even an object");

    const adapter = new IndexedDbSaveAdapter();
    await expect(adapter.loadRun()).resolves.toEqual(createDefaultRunState());
  });
});
