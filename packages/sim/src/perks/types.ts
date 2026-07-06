/**
 * Minimal stat/modifier contract that `combat/resolveAttack.ts` depends on.
 * The full perk system (Perk, PerkEffect, EventBus, ModifierRegistry
 * implementation) is built out in this same directory — this file just
 * establishes the boundary other systems compile against, so combat code
 * never needs to import perk *definitions*, only this generic interface.
 */

export type StatKey =
  | "damageMultiplier"
  | "cooldownMultiplier"
  | "moveSpeedMultiplier"
  | "fluxRegenMultiplier"
  | "chargeRateMultiplier"
  | (string & {});

export interface StatBlock {
  /** Resolves a stat's current value (base 1.0 for multipliers, 0 for flat bonuses not modeled here yet). */
  get(stat: StatKey): number;
}

/** Read-only view combat code needs — the full registry (with mutation/perk-registration methods) lives in ModifierRegistry.ts. */
export interface ModifierRegistry extends StatBlock {}
