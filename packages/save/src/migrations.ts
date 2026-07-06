import {
  CURRENT_META_SCHEMA_VERSION,
  CURRENT_RUN_SCHEMA_VERSION,
  createDefaultMetaSaveData,
  createDefaultRunState,
  LOADOUT_SLOT_IDS,
  type MetaSaveData,
  type RunState,
} from "./schema.js";

/**
 * One step in an explicit migration chain (docs/TECHNICAL_SPEC.md §3:
 * "Version the save schema with an explicit migration chain (v1 -> v2 -> ...)
 * from day one"). `fromVersion` is the schema version the incoming `data`
 * is shaped like; `migrate` returns data shaped like `fromVersion + 1`.
 */
export type Migration<T> = {
  fromVersion: number;
  migrate: (data: unknown) => T;
};

interface MigrationChainOptions<T extends { schemaVersion: number }> {
  migrations: readonly Migration<T>[];
  currentVersion: number;
  createDefault: () => T;
  /** Final structural check applied once the chain reaches `currentVersion`. */
  isValidShape: (data: unknown) => data is T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Returns the declared schema version, or null if `raw` is missing/malformed/version 0. */
function readSchemaVersion(raw: unknown): number | null {
  if (!isRecord(raw)) {
    return null;
  }
  const version = raw.schemaVersion;
  return typeof version === "number" && Number.isInteger(version) && version >= 1 ? version : null;
}

/**
 * Generic migration-chain runner shared by meta/run save data. Walks
 * registered migrations from the data's declared version up to
 * `currentVersion`, one step at a time. Never throws — any failure (missing
 * version, malformed data, a gap in the migration chain, a migration
 * function that throws, or a final shape that still doesn't validate) falls
 * back to `createDefault()` instead of crashing the caller.
 */
export function runMigrationChain<T extends { schemaVersion: number }>(
  raw: unknown,
  options: MigrationChainOptions<T>,
): T {
  const { migrations, currentVersion, createDefault, isValidShape } = options;

  const startVersion = readSchemaVersion(raw);
  if (startVersion === null || startVersion > currentVersion) {
    return createDefault();
  }

  try {
    let version = startVersion;
    let data: unknown = raw;

    while (version < currentVersion) {
      const step = migrations.find((migration) => migration.fromVersion === version);
      if (!step) {
        // No registered migration bridges this version gap — don't guess.
        return createDefault();
      }
      data = step.migrate(data);
      version += 1;
    }

    if (!isValidShape(data)) {
      return createDefault();
    }

    return { ...data, schemaVersion: currentVersion };
  } catch {
    return createDefault();
  }
}

function isMetaSaveDataShape(value: unknown): value is MetaSaveData {
  if (!isRecord(value)) return false;
  if (typeof value.schemaVersion !== "number") return false;
  if (typeof value.ichor !== "number") return false;
  if (!Array.isArray(value.unlockedSchools) || !value.unlockedSchools.every((entry) => typeof entry === "string")) {
    return false;
  }
  if (!Array.isArray(value.permanentUnlocks) || !value.permanentUnlocks.every((entry) => typeof entry === "string")) {
    return false;
  }
  return typeof value.startingLevelBonus === "number";
}

function isRunStateShape(value: unknown): value is RunState {
  if (!isRecord(value)) return false;
  if (typeof value.schemaVersion !== "number") return false;
  if (typeof value.currentWingId !== "string" && value.currentWingId !== null) return false;
  if (typeof value.currentFloorIndex !== "number") return false;
  if (typeof value.activeSchoolId !== "string" && value.activeSchoolId !== null) return false;
  if (typeof value.activeFormId !== "string" && value.activeFormId !== null) return false;
  if (!Array.isArray(value.activePerkIds) || !value.activePerkIds.every((entry) => typeof entry === "string")) {
    return false;
  }
  if (typeof value.motes !== "number") return false;
  if (!isRecord(value.slotLevels)) return false;
  const slotLevels = value.slotLevels;
  return LOADOUT_SLOT_IDS.every((slot) => typeof slotLevels[slot] === "number");
}

/**
 * Template/example migration. Unreachable today — `runMigrationChain` only
 * walks versions strictly below `currentVersion`, and
 * `CURRENT_META_SCHEMA_VERSION` is still 1 — but it's registered here so the
 * shape of a real v1 -> v2 migration is obvious the moment one is needed:
 * evolve `MetaSaveData` in schema.ts, bump `CURRENT_META_SCHEMA_VERSION`,
 * then replace this identity migration with the real transform (and add a
 * new `{ fromVersion: 2, migrate: ... }` entry for the step after that).
 */
const META_MIGRATIONS: readonly Migration<MetaSaveData>[] = [
  {
    fromVersion: 1,
    migrate: (data) => data as MetaSaveData,
  },
];

/** Same idea as `META_MIGRATIONS` — see that comment. */
const RUN_MIGRATIONS: readonly Migration<RunState>[] = [
  {
    fromVersion: 1,
    migrate: (data) => data as RunState,
  },
];

export function migrateMetaSaveData(raw: unknown): MetaSaveData {
  return runMigrationChain(raw, {
    migrations: META_MIGRATIONS,
    currentVersion: CURRENT_META_SCHEMA_VERSION,
    createDefault: createDefaultMetaSaveData,
    isValidShape: isMetaSaveDataShape,
  });
}

export function migrateRunState(raw: unknown): RunState {
  return runMigrationChain(raw, {
    migrations: RUN_MIGRATIONS,
    currentVersion: CURRENT_RUN_SCHEMA_VERSION,
    createDefault: createDefaultRunState,
    isValidShape: isRunStateShape,
  });
}
