import { describe, expect, it } from "vitest";
import { migrateMetaSaveData, migrateRunState, runMigrationChain, type Migration } from "./migrations.js";
import { createDefaultMetaSaveData, createDefaultRunState } from "./schema.js";

// --- Generic chain-walking mechanism -----------------------------------
//
// Exercises `runMigrationChain` directly against a fake two-version schema
// so the mechanism is proven generically, independent of whatever the real
// current schema version happens to be (both real schemas are still v1
// today, so their own migration chains never actually walk a step).

interface FakeWidgetV2 {
  schemaVersion: number;
  name: string;
  level: number;
}

function createDefaultFakeWidget(): FakeWidgetV2 {
  return { schemaVersion: 2, name: "default", level: 1 };
}

function isFakeWidgetV2(value: unknown): value is FakeWidgetV2 {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.schemaVersion === "number" && typeof record.name === "string" && typeof record.level === "number";
}

describe("runMigrationChain", () => {
  it("walks a registered v1 -> v2 migration and upgrades old-shaped data", () => {
    const v1ToV2: Migration<FakeWidgetV2> = {
      fromVersion: 1,
      migrate: (data) => {
        const record = data as { schemaVersion: number; name: string };
        return { schemaVersion: 2, name: record.name, level: 1 };
      },
    };

    const oldShapedData = { schemaVersion: 1, name: "torch" };

    const result = runMigrationChain(oldShapedData, {
      migrations: [v1ToV2],
      currentVersion: 2,
      createDefault: createDefaultFakeWidget,
      isValidShape: isFakeWidgetV2,
    });

    expect(result).toEqual({ schemaVersion: 2, name: "torch", level: 1 });
  });

  it("passes already-current-version data through unchanged (modulo shape validation)", () => {
    const current = { schemaVersion: 2, name: "already-current", level: 7 };

    const result = runMigrationChain(current, {
      migrations: [],
      currentVersion: 2,
      createDefault: createDefaultFakeWidget,
      isValidShape: isFakeWidgetV2,
    });

    expect(result).toEqual(current);
  });

  it("falls back to defaults when a migration step is missing from the chain", () => {
    const oldShapedData = { schemaVersion: 1, name: "torch" };

    const result = runMigrationChain(oldShapedData, {
      migrations: [], // no v1 -> v2 step registered
      currentVersion: 2,
      createDefault: createDefaultFakeWidget,
      isValidShape: isFakeWidgetV2,
    });

    expect(result).toEqual(createDefaultFakeWidget());
  });

  it("falls back to defaults when a migration function throws", () => {
    const throwingMigration: Migration<FakeWidgetV2> = {
      fromVersion: 1,
      migrate: () => {
        throw new Error("boom");
      },
    };

    const result = runMigrationChain(
      { schemaVersion: 1, name: "torch" },
      {
        migrations: [throwingMigration],
        currentVersion: 2,
        createDefault: createDefaultFakeWidget,
        isValidShape: isFakeWidgetV2,
      },
    );

    expect(result).toEqual(createDefaultFakeWidget());
  });

  it("falls back to defaults when the declared version is newer than currentVersion", () => {
    const fromTheFuture = { schemaVersion: 99, name: "time traveler", level: 1 };

    const result = runMigrationChain(fromTheFuture, {
      migrations: [],
      currentVersion: 2,
      createDefault: createDefaultFakeWidget,
      isValidShape: isFakeWidgetV2,
    });

    expect(result).toEqual(createDefaultFakeWidget());
  });

  it("falls back to defaults when the final migrated shape still fails validation", () => {
    const producesGarbage: Migration<FakeWidgetV2> = {
      fromVersion: 1,
      // Deliberately returns something that doesn't satisfy FakeWidgetV2.
      migrate: () => ({ nope: true }) as unknown as FakeWidgetV2,
    };

    const result = runMigrationChain(
      { schemaVersion: 1, name: "torch" },
      {
        migrations: [producesGarbage],
        currentVersion: 2,
        createDefault: createDefaultFakeWidget,
        isValidShape: isFakeWidgetV2,
      },
    );

    expect(result).toEqual(createDefaultFakeWidget());
  });
});

// --- Real meta/run migration wrappers -----------------------------------

describe("migrateMetaSaveData", () => {
  it("passes through valid current-version data unchanged", () => {
    const data = {
      schemaVersion: 1,
      ichor: 250,
      unlockedSchools: ["fire", "earth"],
      permanentUnlocks: ["reliquary.dash-upgrade"],
      startingLevelBonus: 3,
    };
    expect(migrateMetaSaveData(data)).toEqual(data);
  });

  const malformedInputs: unknown[] = [
    undefined,
    null,
    "not an object",
    42,
    { schemaVersion: 0, ichor: 10, unlockedSchools: [], permanentUnlocks: [], startingLevelBonus: 0 },
    { schemaVersion: 1 }, // missing required fields
    { schemaVersion: 1, ichor: "not a number", unlockedSchools: [], permanentUnlocks: [], startingLevelBonus: 0 },
  ];

  it.each(malformedInputs)("falls back to defaults for malformed input: %j", (raw) => {
    expect(migrateMetaSaveData(raw)).toEqual(createDefaultMetaSaveData());
  });
});

describe("migrateRunState", () => {
  it("passes through valid current-version data unchanged", () => {
    const data = {
      schemaVersion: 1,
      currentWingId: "wing-fire",
      currentFloorIndex: 2,
      activeSchoolId: "fire",
      activeFormId: "solid",
      activePerkIds: ["momentum"],
      motes: 40,
      slotLevels: { passive: 1, primary: 4, secondary: 3, tertiary: 2, ultimate: 1 },
    };
    expect(migrateRunState(data)).toEqual(data);
  });

  const malformedInputs: unknown[] = [
    undefined,
    null,
    42,
    { schemaVersion: 0 },
    {
      schemaVersion: 1,
      currentWingId: null,
      currentFloorIndex: 0,
      activeSchoolId: null,
      activeFormId: null,
      activePerkIds: [],
      motes: 0,
      slotLevels: "not a record",
    },
    {
      schemaVersion: 1,
      currentWingId: null,
      currentFloorIndex: 0,
      activeSchoolId: null,
      activeFormId: null,
      activePerkIds: [],
      motes: 0,
      slotLevels: { passive: 0, primary: 0, secondary: 0, tertiary: 0 /* missing ultimate */ },
    },
  ];

  it.each(malformedInputs)("falls back to defaults for malformed input: %j", (raw) => {
    expect(migrateRunState(raw)).toEqual(createDefaultRunState());
  });
});
