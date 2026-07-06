import type { FormId, SchoolId } from "@pithos/sim";

/**
 * Two-tier save split matching hub/expedition — docs/TECHNICAL_SPEC.md §3
 * ("Save system"): `MetaSaveData` persists across runs (Ichor + permanent
 * unlocks, GDD §12); `RunState` is scoped to the current expedition (active
 * build, GDD §7) and is discarded on death/completion via
 * `SaveAdapter.clearRun()`.
 *
 * Both carry a `schemaVersion` field — load-bearing for `migrations.ts`,
 * which walks an explicit migration chain up to the constants below.
 */

export const CURRENT_META_SCHEMA_VERSION = 1;
export const CURRENT_RUN_SCHEMA_VERSION = 1;

/** The five loadout slots every build has, regardless of School/Form — GDD §5. */
export type LoadoutSlotId = "passive" | "primary" | "secondary" | "tertiary" | "ultimate";

export const LOADOUT_SLOT_IDS: readonly LoadoutSlotId[] = [
  "passive",
  "primary",
  "secondary",
  "tertiary",
  "ultimate",
];

/**
 * Hub-persistent meta-progression (GDD §12): a single currency, Ichor,
 * spent at the Reliquary/School Shrines on permanent unlocks. This package
 * stays agnostic of what each unlock id actually *does* — that's owned by
 * `packages/data`.
 */
export interface MetaSaveData {
  schemaVersion: number;
  ichor: number;
  unlockedSchools: SchoolId[];
  /** Permanent Reliquary/Shrine purchase ids — opaque to this package. */
  permanentUnlocks: string[];
  /**
   * Flat starting-level bonus purchased at the hub (GDD §5: "starting-level
   * boosts"). Kept as a single number rather than per-slot for simplicity;
   * revisit if the design wants per-slot granularity later.
   */
  startingLevelBonus: number;
}

/**
 * In-run state (GDD §7): lost at run's end (death or completion) — spent
 * currency here is Motes, not Ichor. `slotLevels` tracks the 5-slot loadout
 * (GDD §5), nominally capped at 20 total per run; this package only stores
 * the numbers, it doesn't enforce that cap.
 */
export interface RunState {
  schemaVersion: number;
  currentWingId: string | null;
  currentFloorIndex: number;
  activeSchoolId: SchoolId | null;
  activeFormId: FormId | null;
  activePerkIds: string[];
  motes: number;
  slotLevels: Record<LoadoutSlotId, number>;
}

export function createDefaultMetaSaveData(): MetaSaveData {
  return {
    schemaVersion: CURRENT_META_SCHEMA_VERSION,
    ichor: 0,
    unlockedSchools: [],
    permanentUnlocks: [],
    startingLevelBonus: 0,
  };
}

export function createDefaultRunState(): RunState {
  return {
    schemaVersion: CURRENT_RUN_SCHEMA_VERSION,
    currentWingId: null,
    currentFloorIndex: 0,
    activeSchoolId: null,
    activeFormId: null,
    activePerkIds: [],
    motes: 0,
    slotLevels: {
      passive: 0,
      primary: 0,
      secondary: 0,
      tertiary: 0,
      ultimate: 0,
    },
  };
}
