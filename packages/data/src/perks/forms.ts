import type { CombatEventBus, CombatEventMap, FormId, ModifierOp, Perk } from "@pithos/sim";

/**
 * The 16 Form Perks (GDD.md §6 "Perks" → "Form Perks"), 4 per Form
 * (Solid/Liquid/Gas/Plasma). Sibling files (owned by other Wave 2 agents)
 * cover Universal/School/Rare — this file is Form Perks only.
 *
 * ## Three recurring mechanical patterns
 *
 * 1. **"While in Form X"** — `CombatEventMap.onFormSwap` only fires once at
 *    the moment of a swap; it isn't a queryable "current Form" state. Every
 *    perk below that's conditional on "being in Form X" therefore tracks its
 *    own current-Form flag per actor (via `createFormTracker`, subscribing
 *    to `onFormSwap`) and gates a `Modifier.condition` callback on it. This
 *    is the pattern this task's brief calls out as "the correct,
 *    expressible-today pattern" — not a workaround.
 *
 * 2. **Custom `StatKey`s and `ModifierRegistryImpl`'s fold baseline** —
 *    `ModifierRegistryImpl.get()` always returns identity `1` for a stat
 *    with no active modifiers (`(additiveSum + 1) * multProduct`, see
 *    ModifierRegistry.ts and its test "defaults to the identity value (1)").
 *    That's correct for *multiplier*-style stats (`damageMultiplier`,
 *    `moveSpeedMultiplier`, our own `dashDistanceMultiplier`,
 *    `maxFluxMultiplier`, `damageTakenMultiplier`, `knockbackMultiplier`,
 *    `gasCloudRadiusMultiplier` — 1.0 = unchanged baseline, `add` deltas are
 *    percentages), so those use `op: "add"`/`"mult"` exactly like the
 *    built-in stats. It is *not* correct for flat quantities, counts,
 *    chances, or flags (a lifesteal fraction, a target count, a crit-double
 *    chance, a Flux-refund amount) — folding those through `(sum + 1) *
 *    product` would silently add a bogus "+1". Those instead use
 *    `op: "override"`, which bypasses the fold arithmetic entirely and
 *    returns the literal value directly (see ModifierRegistry.ts fold():
 *    "the registry short-circuits" on any active override). Each such stat
 *    is documented inline where it's introduced.
 *
 * 3. **`ModifierRegistryImpl` only re-folds a stat on `register`/`unregister`
 *    — never "live"** — its `get()` caches the folded value per stat and
 *    only clears that cache inside `register()`/`unregister()` (see its
 *    class doc: "Recompute is lazy and cached per-stat... `register`/
 *    `unregister` invalidate the entire cache"). A `condition` callback is
 *    re-run only when a fold happens, so a modifier registered once with a
 *    condition that flips later (e.g. our current-Form flag, updated purely
 *    inside an `onFormSwap` handler) will NOT be picked up by `get()` on its
 *    own — nothing told the cache it's stale. `ModifierRegistry.test.ts`
 *    hits this exact edge case and works around it with a throwaway
 *    `register()` call "to force cache invalidation." Every "while in Form
 *    X" perk below does the equivalent for real: its `onFormSwap` handler
 *    re-registers the same modifier(s) (same id/stat/op/value/condition) on
 *    every relevant swap, which is a no-op change in content but forces
 *    `ModifierRegistryImpl` to drop its cache so the next `get()` re-folds
 *    against the now-current condition.
 *
 * ## What's fully wired today vs. declared-for-later
 *
 * `damageMultiplier` is the one custom-relevant stat actually consumed by
 * real combat code today (`combat/resolveAttack.ts`), so perks that touch it
 * (Unstable Form) have a fully end-to-end-live effect. Every other invented
 * stat here (`lifestealFraction`, `pendingPlasmaFluxRefund`,
 * `plasmaChainTargetCount`, etc.) is forward-declared data: nothing in
 * `packages/sim` reads it yet, matching this task's brief ("inventing a new
 * stat key is fine if consistent and documented"). Effects that need a
 * spatial hazard system, a per-attacker/target status system, or a
 * continuous movement/idle signal that doesn't exist on `CombatEventBus` at
 * all are flagged with a one-line comment at the point they're not fully
 * expressible, per perk, below.
 */

// ---------------------------------------------------------------------------
// Shared helpers (internal — not exported; every Perk below is built from
// one of these shapes).
// ---------------------------------------------------------------------------

/**
 * Tracks each actor's current Form by subscribing to `onFormSwap` (file-level
 * doc pattern #1). Used by the event-triggered perks below (Bulwark, Viscosity,
 * Vapor Trail, Arc Reactor) purely to answer "is this actor in Form X *right
 * now*" from inside an already-firing event handler — which is safe, since
 * those handlers don't rely on `ModifierRegistryImpl` re-polling a `condition`
 * on its own (pattern #3 doesn't apply: they either register unconditionally,
 * or re-register fresh at the moment the tracked value changes). Perks that
 * DO need a registered modifier's `condition` to depend on this — i.e. every
 * "while in Form X" passive buff — use `createFormGatedPerk` below instead,
 * which additionally forces cache invalidation on every swap.
 */
function createFormTracker() {
  const formByActor = new Map<string, FormId>();
  const handlerByActor = new Map<string, (event: CombatEventMap["onFormSwap"]) => void>();

  return {
    subscribe(bus: CombatEventBus, actorId: string): void {
      const handler = (event: CombatEventMap["onFormSwap"]) => {
        if (event.actorId === actorId) {
          formByActor.set(actorId, event.toForm);
        }
      };
      handlerByActor.set(actorId, handler);
      bus.on("onFormSwap", handler);
    },
    unsubscribe(bus: CombatEventBus, actorId: string): void {
      const handler = handlerByActor.get(actorId);
      if (handler) {
        bus.off("onFormSwap", handler);
        handlerByActor.delete(actorId);
      }
      formByActor.delete(actorId);
    },
    isIn(actorId: string, form: FormId): boolean {
      return formByActor.get(actorId) === form;
    },
  };
}

interface StatModifierSpec {
  stat: string;
  op: ModifierOp;
  value: number;
}

/**
 * A perk that registers one or more always-on modifiers, each gated on
 * "actor is currently in `form`" — tracked per actor via `onFormSwap` (see
 * file-level doc pattern #1). Covers every Form Perk whose whole effect is
 * "passively buff/debuff a stat while in this Form" — no event trigger
 * beyond the Form swap itself is needed.
 *
 * Per file-level doc pattern #3: the `onFormSwap` handler doesn't just
 * update the tracked-Form flag, it also re-registers every modifier so
 * `ModifierRegistryImpl`'s cache is forced to drop and the next `get()`
 * reflects the actor's new Form immediately, not whenever some unrelated
 * `register`/`unregister` call next happens to run.
 */
function createFormGatedPerk(config: {
  id: string;
  displayName: string;
  description: string;
  form: FormId;
  modifiers: StatModifierSpec[];
}): Perk {
  const formByActor = new Map<string, FormId>();
  const handlerByActor = new Map<string, (event: CombatEventMap["onFormSwap"]) => void>();
  const modifierId = (actorId: string, index: number) => `${config.id}:${actorId}:${index}`;

  const registerAll = (registry: Parameters<Perk["apply"]>[0], actorId: string): void => {
    config.modifiers.forEach((modifier, index) => {
      registry.register({
        id: modifierId(actorId, index),
        stat: modifier.stat,
        op: modifier.op,
        value: modifier.value,
        condition: () => formByActor.get(actorId) === config.form,
      });
    });
  };

  return {
    id: config.id,
    tier: "form",
    displayName: config.displayName,
    description: config.description,
    apply(registry, bus, actorId) {
      registerAll(registry, actorId);

      const handler = (event: CombatEventMap["onFormSwap"]) => {
        if (event.actorId !== actorId) {
          return;
        }
        formByActor.set(actorId, event.toForm);
        registerAll(registry, actorId); // force ModifierRegistryImpl's cache to drop — see pattern #3
      };
      handlerByActor.set(actorId, handler);
      bus.on("onFormSwap", handler);
    },
    remove(registry, bus, actorId) {
      config.modifiers.forEach((_modifier, index) => registry.unregister(modifierId(actorId, index)));
      const handler = handlerByActor.get(actorId);
      if (handler) {
        bus.off("onFormSwap", handler);
        handlerByActor.delete(actorId);
      }
      formByActor.delete(actorId);
    },
  };
}

/**
 * A perk that registers a single always-on, unconditional modifier — for
 * Form Perks that buff a Form-exclusive ability's own numbers (e.g. a Gas
 * cloud's radius, a Plasma burst's chain-target count) rather than the
 * actor's general stats. These don't need Form-tracking: the stat itself is
 * only ever consulted by code resolving that Form's own ability, so there's
 * nothing to gate.
 */
function createStaticModifierPerk(config: {
  id: string;
  displayName: string;
  description: string;
  stat: string;
  op: ModifierOp;
  value: number;
}): Perk {
  const modifierId = (actorId: string) => `${config.id}:${actorId}`;

  return {
    id: config.id,
    tier: "form",
    displayName: config.displayName,
    description: config.description,
    apply(registry, _bus, actorId) {
      registry.register({ id: modifierId(actorId), stat: config.stat, op: config.op, value: config.value });
    },
    remove(registry, _bus, actorId) {
      registry.unregister(modifierId(actorId));
    },
  };
}

// ---------------------------------------------------------------------------
// Solid
// ---------------------------------------------------------------------------

const BULWARK_STILL_THRESHOLD_MS = 3000;
const BULWARK_DAMAGE_TAKEN_MULTIPLIER = 0.5;

/**
 * Bulwark — "brief shield after standing still for a few seconds" (while in
 * Solid). Two independent gaps stack here:
 *
 *  - `CombatEventMap` has no continuous movement/idle/tick event at all
 *    (see EventBus.ts — `onDash` is the only movement-adjacent event), so
 *    true "standing still" can't be observed today. This approximates it
 *    with the best available signal: a wall-clock timer that resets on
 *    `onDash` (the one real movement event) and on `apply`.
 *  - Per file-level doc pattern #3, `ModifierRegistryImpl` only re-folds a
 *    stat inside `register()`/`unregister()`, never purely from time
 *    passing — so even with the timer above, the shield's condition is only
 *    actually re-evaluated at the moment of an `onDash` or `onFormSwap`
 *    event (this perk re-registers on both, to force that), not the exact
 *    instant `BULWARK_STILL_THRESHOLD_MS` elapses. A future periodic tick
 *    event on the bus would let this re-register on a timer for exact
 *    behavior; until then, "shield's been up for a few seconds" becomes
 *    visible on the next Form swap or dash after that, not before.
 *
 * Once a proper movement/idle/tick event exists, swapping the trigger for
 * it is a small, isolated change — the registered effect (a
 * `damageTakenMultiplier` shield) doesn't need to move.
 */
export const PERK_SOLID_BULWARK: Perk = (() => {
  const tracker = createFormTracker();
  const lastDashAtByActor = new Map<string, number>();
  const dashHandlerByActor = new Map<string, (event: CombatEventMap["onDash"]) => void>();
  const formSwapHandlerByActor = new Map<string, (event: CombatEventMap["onFormSwap"]) => void>();
  const modifierId = (actorId: string) => `solid_bulwark:${actorId}`;

  const registerShield = (registry: Parameters<Perk["apply"]>[0], actorId: string): void => {
    registry.register({
      id: modifierId(actorId),
      stat: "damageTakenMultiplier",
      op: "mult",
      value: BULWARK_DAMAGE_TAKEN_MULTIPLIER,
      condition: () => {
        const lastDashAt = lastDashAtByActor.get(actorId) ?? 0;
        return tracker.isIn(actorId, "solid") && Date.now() - lastDashAt >= BULWARK_STILL_THRESHOLD_MS;
      },
    });
  };

  return {
    id: "solid_bulwark",
    tier: "form",
    displayName: "Bulwark",
    description: "Standing still for a few seconds while in Solid raises a brief shield that reduces incoming damage.",
    apply(registry, bus, actorId) {
      tracker.subscribe(bus, actorId);
      lastDashAtByActor.set(actorId, Date.now());

      const dashHandler = (event: CombatEventMap["onDash"]) => {
        if (event.actorId === actorId) {
          lastDashAtByActor.set(actorId, Date.now());
          registerShield(registry, actorId); // force ModifierRegistryImpl's cache to drop — see pattern #3
        }
      };
      dashHandlerByActor.set(actorId, dashHandler);
      bus.on("onDash", dashHandler);

      const formSwapHandler = (event: CombatEventMap["onFormSwap"]) => {
        if (event.actorId === actorId) {
          registerShield(registry, actorId); // force ModifierRegistryImpl's cache to drop — see pattern #3
        }
      };
      formSwapHandlerByActor.set(actorId, formSwapHandler);
      bus.on("onFormSwap", formSwapHandler);

      registerShield(registry, actorId);
    },
    remove(registry, bus, actorId) {
      registry.unregister(modifierId(actorId));
      const dashHandler = dashHandlerByActor.get(actorId);
      if (dashHandler) {
        bus.off("onDash", dashHandler);
        dashHandlerByActor.delete(actorId);
      }
      const formSwapHandler = formSwapHandlerByActor.get(actorId);
      if (formSwapHandler) {
        bus.off("onFormSwap", formSwapHandler);
        formSwapHandlerByActor.delete(actorId);
      }
      lastDashAtByActor.delete(actorId);
      tracker.unsubscribe(bus, actorId);
    },
  };
})();

const SOLID_AFTERSHOCK_CRATER_DAMAGE_FRACTION = 0.5;

/**
 * Aftershock — "Solid hits leave a damaging crater". The crater itself is a
 * spatial hazard (a positioned, timed area that damages whoever stands in
 * it) — `CombatEventBus`/`ModifierRegistry` carry no position data at all,
 * so spawning/placing it is future combat-runtime/rendering work, not a gap
 * in this perk's authoring. What IS expressible today is the numeric size
 * of that crater's damage relative to the hit that spawned it, declared here
 * as `solidAftershockCraterDamageFraction` (an `override`, since it's a
 * literal fraction, not a multiplier stacking with a 1.0 baseline) for that
 * future system to read once it exists.
 */
export const PERK_SOLID_AFTERSHOCK: Perk = createFormGatedPerk({
  id: "solid_aftershock",
  displayName: "Aftershock",
  description: "Solid hits leave behind a damaging crater.",
  form: "solid",
  modifiers: [{ stat: "solidAftershockCraterDamageFraction", op: "override", value: SOLID_AFTERSHOCK_CRATER_DAMAGE_FRACTION }],
});

/**
 * Unmovable — "immune to knockback while in Solid". `knockbackMultiplier`
 * follows the built-in multiplier convention (1.0 = normal knockback
 * applies, matching the fold's identity baseline for actors without this
 * perk); `override`-ing it to 0 while in Solid means any future
 * knockback-resolution code that multiplies its base knockback by this stat
 * gets zero.
 */
export const PERK_SOLID_UNMOVABLE: Perk = createFormGatedPerk({
  id: "solid_unmovable",
  displayName: "Unmovable",
  description: "Immune to knockback while in Solid.",
  form: "solid",
  modifiers: [{ stat: "knockbackMultiplier", op: "override", value: 0 }],
});

/**
 * Landslide — "Solid Charge-release also roots enemies hit". The
 * charge-release moment itself isn't observable via `CombatEventBus` today:
 * `FormFluxMachine.consumeChargeOnSwapOut` computes `released: boolean` but
 * is pure state (per its own doc, "never spawns effects or listens for
 * events") and nothing re-emits that flag onto the bus — `onFormSwap` fires
 * for every swap, charged or not. So this perk can't detect the trigger
 * itself yet; what it CAN do is declare the flag a future release-resolution
 * step should consult: `solidLandslideRootsOnRelease` is `1` (present) only
 * for actors holding this perk (default `1` from the fold's identity
 * baseline is otherwise irrelevant here since nothing else ever touches this
 * key), read alongside `consumeChargeOnSwapOut`'s `released` result once
 * that plumbing exists.
 */
export const PERK_SOLID_LANDSLIDE: Perk = createStaticModifierPerk({
  id: "solid_landslide",
  displayName: "Landslide",
  description: "Solid's Charge-release burst also roots the enemies it hits.",
  stat: "solidLandslideRootsOnRelease",
  op: "override",
  value: 1,
});

// ---------------------------------------------------------------------------
// Liquid
// ---------------------------------------------------------------------------

const LIQUID_OSMOSIS_LIFESTEAL_FRACTION = 0.15;

/**
 * Osmosis — "increased lifesteal while in Liquid". `lifestealFraction` is a
 * literal 0..1 fraction of damage dealt returned as healing, so it's an
 * `override` (not `add`/`mult` — those would fold against the 1.0 identity
 * baseline, which doesn't apply to a fraction meant to default to 0 for
 * actors without any lifesteal source).
 */
export const PERK_LIQUID_OSMOSIS: Perk = createFormGatedPerk({
  id: "liquid_osmosis",
  displayName: "Osmosis",
  description: "Increased lifesteal while in Liquid.",
  form: "liquid",
  modifiers: [{ stat: "lifestealFraction", op: "override", value: LIQUID_OSMOSIS_LIFESTEAL_FRACTION }],
});

const LIQUID_RIPTIDE_PULL_STRENGTH = 4;

/**
 * Riptide — "Liquid pools pull enemies toward their center". Pulling
 * entities toward a point is spatial simulation (needs live positions and a
 * per-frame force application) that neither `CombatEventBus` nor
 * `ModifierRegistry` model — genuinely a future combat-runtime concern, the
 * same category as Aftershock's crater. The expressible piece is the pull's
 * strength (units/sec, scaled against `DEFAULT_MOVEMENT_CONFIG.baseSpeed =
 * 6` the same way `forms.ts` scales its own numbers — noticeably slower
 * than base move speed so it reads as a "pull," not a yank), declared
 * unconditionally since it's exclusive to the Liquid pool ability itself.
 */
export const PERK_LIQUID_RIPTIDE: Perk = createStaticModifierPerk({
  id: "liquid_riptide",
  displayName: "Riptide",
  description: "Liquid pools pull enemies toward their center.",
  stat: "liquidPoolPullStrength",
  op: "override",
  value: LIQUID_RIPTIDE_PULL_STRENGTH,
});

const LIQUID_VISCOSITY_MAGNITUDE_PER_STACK = 0.08;
const LIQUID_VISCOSITY_MAX_STACKS = 5;

/**
 * Viscosity — "Liquid hits apply increasingly severe slow". The escalating
 * part is inherently per-(attacker,target) state — `ModifierRegistry` is a
 * flat per-actor `StatBlock`, it has no concept of "this stat, but only
 * against that target," so it can't itself carry an answer that varies
 * per-enemy. What's fully expressible and implemented here: real per-target
 * hit-stack bookkeeping (`hitStacksByActor`, incremented on `onHit` while in
 * Liquid, capped at `LIQUID_VISCOSITY_MAX_STACKS`) plus the flat per-stack
 * magnitude constant (`liquidViscosityMagnitudePerStack`, an `override`
 * since it's a literal magnitude). Actually applying that per-target,
 * escalating status effect needs a status-effect system keyed by
 * attacker/target pairs, which doesn't exist yet — future combat-runtime
 * work; when it lands, it can read both pieces declared here.
 */
export const PERK_LIQUID_VISCOSITY: Perk = (() => {
  const tracker = createFormTracker();
  const hitStacksByActor = new Map<string, Map<string, number>>();
  const hitHandlerByActor = new Map<string, (event: CombatEventMap["onHit"]) => void>();
  const modifierId = (actorId: string) => `liquid_viscosity:${actorId}`;

  return {
    id: "liquid_viscosity",
    tier: "form",
    displayName: "Viscosity",
    description: "Liquid hits apply an increasingly severe slow the more times you land on the same target.",
    apply(registry, bus, actorId) {
      tracker.subscribe(bus, actorId);
      hitStacksByActor.set(actorId, new Map());

      const hitHandler = (event: CombatEventMap["onHit"]) => {
        if (event.attackerId !== actorId || !tracker.isIn(actorId, "liquid")) {
          return;
        }
        const stacks = hitStacksByActor.get(actorId);
        if (!stacks) {
          return;
        }
        const next = Math.min(LIQUID_VISCOSITY_MAX_STACKS, (stacks.get(event.targetId) ?? 0) + 1);
        stacks.set(event.targetId, next);
      };
      hitHandlerByActor.set(actorId, hitHandler);
      bus.on("onHit", hitHandler);

      registry.register({
        id: modifierId(actorId),
        stat: "liquidViscosityMagnitudePerStack",
        op: "override",
        value: LIQUID_VISCOSITY_MAGNITUDE_PER_STACK,
      });
    },
    remove(registry, bus, actorId) {
      registry.unregister(modifierId(actorId));
      const hitHandler = hitHandlerByActor.get(actorId);
      if (hitHandler) {
        bus.off("onHit", hitHandler);
        hitHandlerByActor.delete(actorId);
      }
      hitStacksByActor.delete(actorId);
      tracker.unsubscribe(bus, actorId);
    },
  };
})();

const LIQUID_RESERVOIR_MAX_FLUX_BONUS = 0.25;

/**
 * Reservoir — "bonus max Flux while in Liquid". `maxFluxMultiplier` follows
 * the built-in multiplier convention exactly like `damageMultiplier`: 1.0
 * baseline, `add` deltas are percentages. A future Flux-system integration
 * multiplies `FluxState.maxFlux` by this to get the actor's effective cap.
 */
export const PERK_LIQUID_RESERVOIR: Perk = createFormGatedPerk({
  id: "liquid_reservoir",
  displayName: "Reservoir",
  description: "Bonus max Flux while in Liquid.",
  form: "liquid",
  modifiers: [{ stat: "maxFluxMultiplier", op: "add", value: LIQUID_RESERVOIR_MAX_FLUX_BONUS }],
});

// ---------------------------------------------------------------------------
// Gas
// ---------------------------------------------------------------------------

const GAS_VAPOR_TRAIL_DAMAGE_PER_TICK = 6;

/**
 * Vapor Trail — "sprinting in Gas leaves a damaging cloud behind you".
 * `CombatEventMap` has no dedicated "sprint" event and no continuous
 * position stream — `onDash` is the only real movement signal on the bus,
 * so it stands in for "sprinting" here. Spawning/positioning the actual
 * trailing cloud needs the same spatial hazard system Aftershock/Riptide
 * need — future combat-runtime/rendering work. `triggerCountByActor` tracks
 * real per-actor occurrences (dashes while in Gas) so that system has
 * something concrete to consume once it exists; the per-tick damage
 * magnitude is declared as `gasVaporTrailDamagePerTick`.
 */
export const PERK_GAS_VAPOR_TRAIL: Perk = (() => {
  const tracker = createFormTracker();
  const triggerCountByActor = new Map<string, number>();
  const dashHandlerByActor = new Map<string, (event: CombatEventMap["onDash"]) => void>();
  const modifierId = (actorId: string) => `gas_vapor_trail:${actorId}`;

  return {
    id: "gas_vapor_trail",
    tier: "form",
    displayName: "Vapor Trail",
    description: "Sprinting in Gas leaves a damaging cloud behind you.",
    apply(registry, bus, actorId) {
      tracker.subscribe(bus, actorId);
      triggerCountByActor.set(actorId, 0);

      const dashHandler = (event: CombatEventMap["onDash"]) => {
        if (event.actorId === actorId && tracker.isIn(actorId, "gas")) {
          triggerCountByActor.set(actorId, (triggerCountByActor.get(actorId) ?? 0) + 1);
        }
      };
      dashHandlerByActor.set(actorId, dashHandler);
      bus.on("onDash", dashHandler);

      registry.register({
        id: modifierId(actorId),
        stat: "gasVaporTrailDamagePerTick",
        op: "override",
        value: GAS_VAPOR_TRAIL_DAMAGE_PER_TICK,
      });
    },
    remove(registry, bus, actorId) {
      registry.unregister(modifierId(actorId));
      const dashHandler = dashHandlerByActor.get(actorId);
      if (dashHandler) {
        bus.off("onDash", dashHandler);
        dashHandlerByActor.delete(actorId);
      }
      triggerCountByActor.delete(actorId);
      tracker.unsubscribe(bus, actorId);
    },
  };
})();

const GAS_DIFFUSION_RADIUS_BONUS = 0.3;

/**
 * Diffusion — "larger Gas cloud radius". `gasCloudRadiusMultiplier` follows
 * the multiplier convention (1.0 baseline); unconditional because it's
 * exclusive to Gas's own ability radius, not a general actor stat.
 */
export const PERK_GAS_DIFFUSION: Perk = createStaticModifierPerk({
  id: "gas_diffusion",
  displayName: "Diffusion",
  description: "Gas clouds have a larger radius.",
  stat: "gasCloudRadiusMultiplier",
  op: "add",
  value: GAS_DIFFUSION_RADIUS_BONUS,
});

const GAS_FEATHERWEIGHT_DASH_DISTANCE_BONUS = 0.25;

/**
 * Featherweight — "increased dash distance while in Gas".
 * `dashDistanceMultiplier` follows the multiplier convention (1.0
 * baseline); a future dash-resolution step multiplies base dash distance by
 * this.
 */
export const PERK_GAS_FEATHERWEIGHT: Perk = createFormGatedPerk({
  id: "gas_featherweight",
  displayName: "Featherweight",
  description: "Increased dash distance while in Gas.",
  form: "gas",
  modifiers: [{ stat: "dashDistanceMultiplier", op: "add", value: GAS_FEATHERWEIGHT_DASH_DISTANCE_BONUS }],
});

const GAS_TOXIC_BLOOM_MAX_STACKS_BONUS = 2;

/**
 * Toxic Bloom — "Gas DoT can stack higher". `gasDotMaxStacksBonus` is a flat
 * count added on top of the DoT system's own base stack cap, so it's an
 * `override` (an `add` would fold through the `(sum + 1)` identity baseline
 * meant for multipliers, silently inflating the count by 1). Unconditional
 * since it's exclusive to Gas's own DoT stacking rules.
 */
export const PERK_GAS_TOXIC_BLOOM: Perk = createStaticModifierPerk({
  id: "gas_toxic_bloom",
  displayName: "Toxic Bloom",
  description: "Gas damage-over-time effects can stack higher.",
  stat: "gasDotMaxStacksBonus",
  op: "override",
  value: GAS_TOXIC_BLOOM_MAX_STACKS_BONUS,
});

// ---------------------------------------------------------------------------
// Plasma
// ---------------------------------------------------------------------------

const PLASMA_OVERLOAD_CHAIN_TARGET_COUNT = 3;

/**
 * Overload — "Plasma Charge-release chains to 2 extra enemies". Same
 * charge-release-detection gap as Landslide (see that perk's comment):
 * `FormFluxMachine` never surfaces `released` onto `CombatEventBus`. The
 * expressible piece is the resulting chain-target count, declared as
 * `plasmaChainTargetCount` via `override` — chosen as *total* targets
 * (original + 2 extra = 3) rather than "extra only" so that the fold's
 * identity baseline of `1` (for actors without this perk) already reads
 * correctly as "just the original target, no chain."
 */
export const PERK_PLASMA_OVERLOAD: Perk = createStaticModifierPerk({
  id: "plasma_overload",
  displayName: "Overload",
  description: "Plasma's Charge-release burst chains to 2 extra enemies.",
  stat: "plasmaChainTargetCount",
  op: "override",
  value: PLASMA_OVERLOAD_CHAIN_TARGET_COUNT,
});

const PLASMA_VOLATILE_CORE_CRIT_DOUBLE_CHANCE = 0.2;

/**
 * Volatile Core — "chance for Plasma hits to critically double". The RNG
 * roll and damage-doubling itself needs crit-resolution combat code that
 * doesn't exist yet — `onCrit`/`onHit` are past-tense notifications fired
 * after damage is already computed (see `combat/resolveAttack.ts`, which
 * only reads `damageMultiplier`; there's no pre-damage hook a perk could
 * use to mutate an in-flight hit). What's expressible is the chance value
 * itself: `criticalDoubleChance`, an `override`'d fraction, gated on being
 * in Plasma, for that future resolver to roll against.
 */
export const PERK_PLASMA_VOLATILE_CORE: Perk = createFormGatedPerk({
  id: "plasma_volatile_core",
  displayName: "Volatile Core",
  description: "Plasma hits have a chance to critically double.",
  form: "plasma",
  modifiers: [{ stat: "criticalDoubleChance", op: "override", value: PLASMA_VOLATILE_CORE_CRIT_DOUBLE_CHANCE }],
});

const PLASMA_UNSTABLE_FORM_DAMAGE_BONUS = 0.25;
const PLASMA_UNSTABLE_FORM_DAMAGE_TAKEN_BONUS = 0.2;

/**
 * Unstable Form — "+damage in Plasma, but you take more damage while in
 * it". The only Form Perk here that's fully live end-to-end today:
 * `damageMultiplier` is the exact stat `combat/resolveAttack.ts` already
 * reads (`baseTimeline.baseDamage * flavor.damageMultiplier *
 * modifiers.get("damageMultiplier")`), so the damage half of this perk
 * takes effect on the very next resolved attack while in Plasma, no future
 * wiring needed. `damageTakenMultiplier` (the downside) follows the same
 * multiplier convention for whenever incoming-damage resolution consumes
 * it.
 */
export const PERK_PLASMA_UNSTABLE_FORM: Perk = createFormGatedPerk({
  id: "plasma_unstable_form",
  displayName: "Unstable Form",
  description: "Deal more damage in Plasma, but take more damage while in it.",
  form: "plasma",
  modifiers: [
    { stat: "damageMultiplier", op: "add", value: PLASMA_UNSTABLE_FORM_DAMAGE_BONUS },
    { stat: "damageTakenMultiplier", op: "add", value: PLASMA_UNSTABLE_FORM_DAMAGE_TAKEN_BONUS },
  ],
});

const PLASMA_ARC_REACTOR_FLUX_REFUND_PER_KILL = 15;

/**
 * Arc Reactor — "kills in Plasma refund Flux". `Perk.apply` only receives
 * `(registry, bus, actorId)` — no reference to the actor's
 * `FormFluxMachine` — so a perk can't call `FormFluxMachine.refundOnKill`
 * itself; there's no imperative "grant Flux now" surface available to perk
 * code today. Following Perk.ts's documented pattern of pushing a modifier
 * when a triggering event fires, this instead accumulates the *owed*
 * refund into `pendingPlasmaFluxRefund` (an `override`, since it's a literal
 * amount) each qualifying kill. A future integration point where perks and
 * Flux/Form state meet is expected to drain that stat into real Flux via
 * `refundOnKill` and let it settle back to baseline.
 */
export const PERK_PLASMA_ARC_REACTOR: Perk = (() => {
  const tracker = createFormTracker();
  const pendingRefundByActor = new Map<string, number>();
  const killHandlerByActor = new Map<string, (event: CombatEventMap["onKill"]) => void>();
  const modifierId = (actorId: string) => `plasma_arc_reactor:${actorId}`;

  return {
    id: "plasma_arc_reactor",
    tier: "form",
    displayName: "Arc Reactor",
    description: "Kills scored while in Plasma refund Flux.",
    apply(registry, bus, actorId) {
      tracker.subscribe(bus, actorId);
      pendingRefundByActor.set(actorId, 0);

      const killHandler = (event: CombatEventMap["onKill"]) => {
        if (event.killerId !== actorId || !tracker.isIn(actorId, "plasma")) {
          return;
        }
        const pending = (pendingRefundByActor.get(actorId) ?? 0) + PLASMA_ARC_REACTOR_FLUX_REFUND_PER_KILL;
        pendingRefundByActor.set(actorId, pending);
        registry.register({
          id: modifierId(actorId),
          stat: "pendingPlasmaFluxRefund",
          op: "override",
          value: pending,
        });
      };
      killHandlerByActor.set(actorId, killHandler);
      bus.on("onKill", killHandler);
    },
    remove(registry, bus, actorId) {
      registry.unregister(modifierId(actorId));
      const killHandler = killHandlerByActor.get(actorId);
      if (killHandler) {
        bus.off("onKill", killHandler);
        killHandlerByActor.delete(actorId);
      }
      pendingRefundByActor.delete(actorId);
      tracker.unsubscribe(bus, actorId);
    },
  };
})();

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export const FORM_PERKS_BY_FORM: Record<FormId, Perk[]> = {
  solid: [PERK_SOLID_BULWARK, PERK_SOLID_AFTERSHOCK, PERK_SOLID_UNMOVABLE, PERK_SOLID_LANDSLIDE],
  liquid: [PERK_LIQUID_OSMOSIS, PERK_LIQUID_RIPTIDE, PERK_LIQUID_VISCOSITY, PERK_LIQUID_RESERVOIR],
  gas: [PERK_GAS_VAPOR_TRAIL, PERK_GAS_DIFFUSION, PERK_GAS_FEATHERWEIGHT, PERK_GAS_TOXIC_BLOOM],
  plasma: [PERK_PLASMA_OVERLOAD, PERK_PLASMA_VOLATILE_CORE, PERK_PLASMA_UNSTABLE_FORM, PERK_PLASMA_ARC_REACTOR],
};

export const FORM_PERKS: Perk[] = [
  ...FORM_PERKS_BY_FORM.solid,
  ...FORM_PERKS_BY_FORM.liquid,
  ...FORM_PERKS_BY_FORM.gas,
  ...FORM_PERKS_BY_FORM.plasma,
];
