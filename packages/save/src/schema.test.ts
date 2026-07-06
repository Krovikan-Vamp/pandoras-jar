import { describe, expect, it } from "vitest";
import {
  CURRENT_META_SCHEMA_VERSION,
  CURRENT_RUN_SCHEMA_VERSION,
  createDefaultMetaSaveData,
  createDefaultRunState,
  LOADOUT_SLOT_IDS,
} from "./schema.js";

describe("createDefaultMetaSaveData", () => {
  it("returns a fresh, empty meta save at the current schema version", () => {
    expect(createDefaultMetaSaveData()).toEqual({
      schemaVersion: CURRENT_META_SCHEMA_VERSION,
      ichor: 0,
      unlockedSchools: [],
      permanentUnlocks: [],
      startingLevelBonus: 0,
    });
  });

  it("returns a fresh object/arrays on every call (no shared mutable state)", () => {
    const a = createDefaultMetaSaveData();
    const b = createDefaultMetaSaveData();
    expect(a).not.toBe(b);
    expect(a.unlockedSchools).not.toBe(b.unlockedSchools);

    a.ichor = 999;
    a.unlockedSchools.push("fire");
    expect(b.ichor).toBe(0);
    expect(b.unlockedSchools).toEqual([]);
  });
});

describe("createDefaultRunState", () => {
  it("returns a fresh, zeroed run state at the current schema version", () => {
    expect(createDefaultRunState()).toEqual({
      schemaVersion: CURRENT_RUN_SCHEMA_VERSION,
      currentWingId: null,
      currentFloorIndex: 0,
      activeSchoolId: null,
      activeFormId: null,
      activePerkIds: [],
      motes: 0,
      slotLevels: { passive: 0, primary: 0, secondary: 0, tertiary: 0, ultimate: 0 },
    });
  });

  it("has a zeroed level for every declared loadout slot", () => {
    const run = createDefaultRunState();
    for (const slot of LOADOUT_SLOT_IDS) {
      expect(run.slotLevels[slot]).toBe(0);
    }
  });

  it("returns a fresh object on every call (no shared mutable state)", () => {
    const a = createDefaultRunState();
    const b = createDefaultRunState();
    expect(a).not.toBe(b);
    expect(a.slotLevels).not.toBe(b.slotLevels);

    a.motes = 50;
    a.slotLevels.primary = 5;
    expect(b.motes).toBe(0);
    expect(b.slotLevels.primary).toBe(0);
  });
});
