/**
 * Typed wrapper around `mitt` — the backbone of the perk/modifier hook
 * system (TECHNICAL_SPEC.md §3, "Perk/modifier hook system"). Combat, the
 * Flux/Form machine, and boss AI emit these events; `Perk.apply()`
 * implementations subscribe to react to them (see Perk.ts).
 *
 * Entities are referenced by plain `string` ids only — this package never
 * imports miniplex or holds a live entity reference, so it stays fully
 * decoupled from the ECS world and unit-testable headless.
 */
import mitt, { type Emitter } from "mitt";

import type { DamageType, FormId } from "../combat/types.js";

/**
 * The full combat event map. Keep payloads flat and JSON-serializable —
 * perks (and, later, save/replay tooling) should be able to consume these
 * without reaching back into ECS/render state.
 */
export type CombatEventMap = {
  /** attackerId's attack connected with targetId for `damage` of `damageType`. Fired for every landed hit, crit or not — see `onCrit` for the crit-specific companion event. */
  onHit: { attackerId: string; targetId: string; damage: number; damageType: DamageType };
  /** attackerId's hit on targetId rolled as a critical hit. Fired in addition to (not instead of) `onHit` for the same hit. */
  onCrit: { attackerId: string; targetId: string; damage: number };
  /** killerId's action reduced victimId's health to zero. */
  onKill: { killerId: string; victimId: string };
  /** actorId took `amount` damage of `damageType`, from any source (hazards/DoTs included, not just a direct attacker hit). */
  onTakeDamage: { actorId: string; amount: number; damageType: DamageType };
  /** actorId swapped Form via the Flux/Form-shift machine (state/FormFluxMachine.ts). */
  onFormSwap: { actorId: string; fromForm: FormId; toForm: FormId };
  /** actorId performed a dash. */
  onDash: { actorId: string };
  /** roomId had its last enemy defeated. */
  onRoomClear: { roomId: string };
};

/** The concrete `mitt` emitter type, specialized to `CombatEventMap`. */
export type CombatEventBus = Emitter<CombatEventMap>;

/** Factory for a fresh, empty combat event bus. Typically one per run/actor-set, not one per actor. */
export function createEventBus(): CombatEventBus {
  return mitt<CombatEventMap>();
}
