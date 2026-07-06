import { World } from "miniplex";
import type { FluxState, FormId, SchoolId } from "../combat/types.js";
import type { MovementState } from "../movement/types.js";

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Health {
  current: number;
  max: number;
}

export interface CombatIdentity {
  schoolId: SchoolId;
  formId: FormId;
  flux: FluxState;
}

/**
 * The entity shape for the full game. All components are optional so that
 * `world.with(...)` can narrow to the archetypes that actually need them
 * (miniplex's standard pattern) — e.g. a plain player entity has
 * `position`/`velocity`/`movement`/`health`/`combat`/`perks` populated,
 * while a static hazard volume might only have `position`.
 */
export interface Entity {
  position?: Vector3;
  velocity?: Vector3;
  /**
   * Tag + data component: presence marks the entity as movement-controlled,
   * and its value is the `MovementState` produced by `MovementController`.
   */
  movement?: MovementState;
  health?: Health;
  /** Presence marks the entity as combat-capable (player, enemy, or boss). */
  combat?: CombatIdentity;
  /** Ids of currently-active `Perk`s (see `perks/`), resolved against the perk registry — this package stores only the id list, not perk objects. */
  perks?: string[];
  isPlayer?: true;
  isEnemy?: true;
  isBoss?: true;
}

export function createWorld(): World<Entity> {
  return new World<Entity>();
}
