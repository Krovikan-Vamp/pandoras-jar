import type { FormDefinition, FormId } from "@pithos/sim";

/**
 * The four School-agnostic Forms (GDD.md §4 "The Four Forms";
 * TECHNICAL_SPEC.md §3 "School × Form data model"). These are pure
 * *behavior* — timings, hitbox shapes, damage, Flux/Charge tuning. Any
 * School plays the exact same numbers here; only `FormFlavor` (in
 * `schools.ts`, owned by another agent) re-skins damage type/VFX/material
 * on top.
 *
 * Numbers are scaled against `DEFAULT_MOVEMENT_CONFIG.baseSpeed = 6`
 * units/sec (packages/sim/src/movement/types.ts) — there's no other
 * numeric baseline yet, so ranges/speeds are picked to feel plausible next
 * to a character moving ~6 units/sec, and damage/timing are tuned relative
 * to each other rather than against a fixed DPS target.
 *
 * A note on "committal Solid": `FormDefinition` only has a swap-*in* cost
 * (`fluxCostToSwapIn`) — there's no field for a swap-*out* cost. Rather than
 * bolt one on outside the given contract, Solid's commitment is expressed
 * through the Charge system instead: it's *cheap* to swap into (low
 * `fluxCostToSwapIn`) but has the highest `chargeParams.maxCharge` and a
 * slow `buildRatePerSecond`, so leaving early forfeits a large, slow-built
 * investment. That sunk-cost dynamic is what makes Solid feel "sticky"
 * without needing a field the type contract doesn't define.
 */

export const FORM_SOLID: FormDefinition = {
  id: "solid",
  displayName: "Solid",
  // Heavy melee cleave, short range. Slow windup/recovery, highest base
  // damage of the four primaries — tanky, committal, area-denial identity.
  primaryAttack: {
    windupSeconds: 0.35,
    activeSeconds: 0.25,
    recoverySeconds: 0.45,
    hitbox: { kind: "melee", range: 1.5, arcDegrees: 120 },
    baseDamage: 28,
  },
  // Ground-slam knockback: wide radial melee hitbox (arcDegrees 360) that
  // applies a knockback status to everything it catches.
  secondaryAbility: {
    id: "solid_ground_slam",
    cooldownSeconds: 8,
    timeline: {
      windupSeconds: 0.5,
      activeSeconds: 0.2,
      recoverySeconds: 0.6,
      hitbox: { kind: "melee", range: 3, arcDegrees: 360 },
      baseDamage: 18,
    },
    onHitStatus: { statusId: "knockback", durationSeconds: 0.3, magnitude: 6 },
  },
  moveSpeedMultiplier: 0.8,
  // Cheap to swap in — the cost of committing to Solid lives in its slow,
  // high-cap Charge curve below, not here (see file-level note above).
  fluxCostToSwapIn: 10,
  chargeParams: {
    buildRatePerSecond: 12,
    maxCharge: 100,
    releaseThreshold: 0.65,
  },
  // Shockwave nova on swap-out: an even wider, harder-hitting version of the
  // ground slam, radial (arcDegrees 360) to sell "everything around you".
  burstOnSwapOut: {
    id: "solid_shockwave_nova",
    timeline: {
      windupSeconds: 0.1,
      activeSeconds: 0.15,
      recoverySeconds: 0.3,
      hitbox: { kind: "melee", range: 5, arcDegrees: 360 },
      baseDamage: 45,
    },
    radius: 5,
  },
};

export const FORM_LIQUID: FormDefinition = {
  id: "liquid",
  displayName: "Liquid",
  // Flowing arc-strike / mid-range wave. Faster and lighter-hitting than
  // Solid — sustain/repositioning identity, not a burst-damage one.
  primaryAttack: {
    windupSeconds: 0.2,
    activeSeconds: 0.3,
    recoverySeconds: 0.25,
    hitbox: { kind: "wave", range: 4, width: 2 },
    baseDamage: 16,
  },
  // Lingering corrosive/healing pool: a short-range wave that plants a
  // pool at the caster's feet. Whether the lingering tick corrodes (vs.
  // enemies) or heals (vs. the caster/allies) is a target-type resolution
  // left to future combat-runtime code — this data only defines the single
  // canonical tick applied by the pool.
  secondaryAbility: {
    id: "liquid_corrosive_pool",
    cooldownSeconds: 10,
    timeline: {
      windupSeconds: 0.3,
      activeSeconds: 0.1,
      recoverySeconds: 0.4,
      hitbox: { kind: "wave", range: 1, width: 3 },
      baseDamage: 4,
    },
    onHitStatus: { statusId: "liquid_pool_tick", durationSeconds: 5, magnitude: 3 },
  },
  moveSpeedMultiplier: 1.0,
  fluxCostToSwapIn: 18,
  chargeParams: {
    buildRatePerSecond: 10,
    maxCharge: 80,
    releaseThreshold: 0.6,
  },
  // Tidal surge on swap-out: a large outward wave.
  burstOnSwapOut: {
    id: "liquid_tidal_surge",
    timeline: {
      windupSeconds: 0.1,
      activeSeconds: 0.2,
      recoverySeconds: 0.25,
      hitbox: { kind: "wave", range: 6, width: 4 },
      baseDamage: 30,
    },
    radius: 6,
  },
};

export const FORM_GAS: FormDefinition = {
  id: "gas",
  displayName: "Gas",
  // Spread shot / DoT cloud: one projectile's stats. "Spread" is modeled by
  // the caller firing several of these per activation, not by this package.
  // Low per-projectile damage since several land per use; fast and cheap
  // to throw out, matching Gas's speed/evasion identity.
  primaryAttack: {
    windupSeconds: 0.15,
    activeSeconds: 0.1,
    recoverySeconds: 0.2,
    hitbox: { kind: "projectile", speed: 14, radius: 0.3, maxRange: 9 },
    baseDamage: 8,
  },
  // Smoke-cover: a short self-centered burst that blinds anything caught in
  // it, covering an escape/reposition rather than dealing real damage.
  secondaryAbility: {
    id: "gas_smoke_cover",
    cooldownSeconds: 12,
    timeline: {
      windupSeconds: 0.2,
      activeSeconds: 0.15,
      recoverySeconds: 0.3,
      hitbox: { kind: "wave", range: 0.5, width: 4 },
      baseDamage: 2,
    },
    onHitStatus: { statusId: "blinded", durationSeconds: 2, magnitude: 1 },
  },
  // Highest moveSpeedMultiplier of the four Forms — the speed/evasion identity.
  moveSpeedMultiplier: 1.3,
  fluxCostToSwapIn: 14,
  chargeParams: {
    buildRatePerSecond: 14,
    maxCharge: 70,
    releaseThreshold: 0.55,
  },
  // Vapor implosion on swap-out: the cloud collapses inward then bursts,
  // leaving a lingering DoT patch (poisoned) rather than a single hard hit.
  burstOnSwapOut: {
    id: "gas_vapor_implosion",
    timeline: {
      windupSeconds: 0.1,
      activeSeconds: 0.2,
      recoverySeconds: 0.2,
      hitbox: { kind: "wave", range: 4, width: 5 },
      baseDamage: 20,
    },
    radius: 4.5,
  },
};

export const FORM_PLASMA: FormDefinition = {
  id: "plasma",
  displayName: "Plasma",
  // Precise bolt/beam, single-target. Long windup (charge-up), near-instant
  // active window, and the highest base damage of the four primaries —
  // glass-cannon identity: high-risk/high-reward.
  primaryAttack: {
    windupSeconds: 0.4,
    activeSeconds: 0.05,
    recoverySeconds: 0.35,
    hitbox: { kind: "beam", length: 8, width: 0.3 },
    baseDamage: 38,
  },
  // Chain-overload burst: a fast bolt that marks its target as "overloaded"
  // for a future combat-runtime chain-lightning resolver to hop off of —
  // this data seeds the first link's timeline/damage only.
  secondaryAbility: {
    id: "plasma_chain_overload",
    cooldownSeconds: 9,
    timeline: {
      windupSeconds: 0.25,
      activeSeconds: 0.05,
      recoverySeconds: 0.3,
      hitbox: { kind: "projectile", speed: 20, radius: 0.2, maxRange: 10 },
      baseDamage: 22,
    },
    onHitStatus: { statusId: "overloaded", durationSeconds: 1.5, magnitude: 1 },
  },
  moveSpeedMultiplier: 0.95,
  // Most expensive Form to swap into and the slowest/lowest Charge cap —
  // fitting the glass-cannon "high-risk" framing: getting in costs a lot,
  // but the threshold to pay off (releaseThreshold) is the lowest of the
  // four, so that investment converts to a burst sooner.
  fluxCostToSwapIn: 26,
  chargeParams: {
    buildRatePerSecond: 8,
    maxCharge: 60,
    releaseThreshold: 0.5,
  },
  // Chain-lightning burst on swap-out: the most dramatic burst of the four,
  // both in damage and in reach (radius), selling "high-risk/high-reward".
  burstOnSwapOut: {
    id: "plasma_chain_lightning",
    timeline: {
      windupSeconds: 0.05,
      activeSeconds: 0.1,
      recoverySeconds: 0.2,
      hitbox: { kind: "beam", length: 10, width: 0.5 },
      baseDamage: 55,
    },
    radius: 10,
  },
};

export const ALL_FORMS: Record<FormId, FormDefinition> = {
  solid: FORM_SOLID,
  liquid: FORM_LIQUID,
  gas: FORM_GAS,
  plasma: FORM_PLASMA,
};
