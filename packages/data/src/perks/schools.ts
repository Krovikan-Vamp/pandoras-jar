import type { CombatEventMap, ModifierOp, Perk, SchoolId } from "@pithos/sim";

/**
 * The 20 School Perks (GDD.md §6 "Perks" → "School Perks"), 4 per School
 * (Earth/Fire/Water/Air/Aether). Sibling files (owned by other Wave 2
 * agents) cover Universal/Form/Rare — this file is School Perks only. Same
 * `Perk.apply`/`remove` contract as `./universal.ts`/`./forms.ts`/`./rare.ts`
 * (see those files' headers for the general pattern this content pass
 * follows); this header repeats only what's specific to School Perks.
 *
 * ## Three recurring mechanical patterns
 *
 * 1. **"While Soaked"/"while burning"-style gating** — none of the five
 *    Schools' passives (Stoneskin, Kindling, Undertow, Tailwind, Starlight
 *    Attunement — see `packages/data/src/schools/*.ts`) have a live runtime
 *    yet; they're descriptive `PassiveEffect` data only, and there is no
 *    status-effect resolver anywhere in `packages/sim` that tracks "is
 *    target X currently Soaked/burning." Perks whose GDD text depends on
 *    such a status (Tidecaller, Pressure, Ember Cascade) therefore track
 *    their own best-effort approximation from `CombatEventBus` — e.g.
 *    "Soaked" is approximated as "was hit with `damageType: 'water'`
 *    within the last few seconds," mirroring `water_soaked`'s ~3-4s
 *    duration in `schools/water.ts`. This is the same shape of pattern
 *    `perks/forms.ts` uses for "while in Form X" via its `createFormTracker`
 *    (a closure-scoped map populated by a bus subscription, gating a
 *    `Modifier.condition`) — not a workaround, the documented
 *    expressible-today pattern for this task.
 *
 * 2. **Custom `StatKey`s: `add`/`mult` vs. `override`** — per
 *    `ModifierRegistry.ts`'s fold (`(additiveSum + 1) * multProduct`,
 *    identity `1` with no active modifiers): `add`/`mult` are correct for
 *    genuine *multiplier*-style stats meant to stack against a `1.0`
 *    baseline (`maxHealthMultiplier`, `fireDotDurationMultiplier`,
 *    `airGlideDurationMultiplier`, and `damageMultiplier` itself). They are
 *    *not* correct for flat quantities, counts, chances, or flags (a stun
 *    chance, a stack-cap bonus, a knockback force, a reveal radius) —
 *    folding those through `(sum + 1) * product` would silently add a
 *    bogus `+1`. Those instead use `op: "override"`, which bypasses the
 *    fold arithmetic and returns the literal value directly (see
 *    `ModifierRegistry.ts`'s fold(): "the registry short-circuits" on any
 *    active override) — exactly the convention `perks/forms.ts` documents
 *    and uses throughout (e.g. `criticalDoubleChance`,
 *    `gasDotMaxStacksBonus`).
 *
 * 3. **`ModifierRegistryImpl` only re-folds a stat on `register`/`unregister`
 *    — never "live"** — its `get()` caches the folded value per stat and
 *    only clears that cache inside `register()`/`unregister()` (see its
 *    class doc: "Recompute is lazy and cached per-stat... `register`/
 *    `unregister` invalidate the entire cache"). A `condition` callback is
 *    re-run only when a fold happens, so a modifier registered once with a
 *    condition that flips later purely inside a bus handler (our "Soaked"
 *    tracking, our Liquid-Form flag) will NOT be picked up by `get()` on its
 *    own — nothing told the cache it's stale. `ModifierRegistry.test.ts`
 *    hits this exact edge case and works around it with a throwaway
 *    `register()` call "to force cache invalidation"; `perks/forms.ts`
 *    documents the same thing as its own pattern #3. Every perk below whose
 *    condition depends on state a *later* event mutates (Tidecaller,
 *    Pressure, Healing Spring) re-registers the same modifier (same
 *    id/stat/op/value/condition) from inside that event's handler — a no-op
 *    content change that forces `ModifierRegistryImpl` to drop its cache so
 *    the next `get()` re-folds against the now-current condition. Ember
 *    Cascade and Phoenix Ash don't need this: they register/unregister a
 *    fresh value directly at the moment their triggering event fires,
 *    rather than parking a `condition` callback for some later, unrelated
 *    `get()` to re-evaluate.
 *
 * ## What's fully wired today vs. declared-for-later
 *
 * `damageMultiplier` is the one stat actually consumed by real combat code
 * today (`combat/resolveAttack.ts`): Tidecaller registers onto it, so that
 * perk has a genuine, live effect on computed damage whenever its condition
 * holds (Pressure's own effect is a separate, forward-declared stat — see
 * its own comment below). `Golem's Heart` reuses `maxHealthMultiplier` — the
 * same placeholder stat `perks/rare.ts`'s Glass Cannon already established —
 * so the two are mutually stacking today even though nothing yet reads
 * `maxHealthMultiplier` when computing an actor's effective max HP. Every
 * other invented stat here is forward-declared data, matching this task's
 * brief ("inventing a new stat key is fine if consistent and documented");
 * spatial effects (cracks, knockback, pull, a minimap) that need
 * position/ECS/rendering data this package doesn't have are flagged with a
 * one-line "PLACEHOLDER GAP" comment at the point they're not fully
 * expressible, per perk, below.
 */

// ---------------------------------------------------------------------------
// Shared helpers (internal — not exported; every Perk below is built from
// one of these three shapes).
// ---------------------------------------------------------------------------

interface StatModifierSpec {
  stat: string;
  op: ModifierOp;
  value: number;
}

/**
 * A perk that registers one or more always-on, unconditional modifiers —
 * mirrors `perks/forms.ts`'s `createStaticModifierPerk` (generalized here to
 * accept more than one modifier, for perks like Zephyr's Focus that touch
 * two stats at once). Covers every School Perk whose whole effect is "just
 * expose this numeric knob," with no bus-driven gating needed.
 */
function createStaticModifierPerk(config: {
  id: string;
  displayName: string;
  description: string;
  modifiers: StatModifierSpec[];
}): Perk {
  const modifierId = (actorId: string, index: number) => `${config.id}:${actorId}:${index}`;

  return {
    id: config.id,
    tier: "school",
    displayName: config.displayName,
    description: config.description,
    apply(registry, _bus, actorId) {
      config.modifiers.forEach((modifier, index) => {
        registry.register({ id: modifierId(actorId, index), stat: modifier.stat, op: modifier.op, value: modifier.value });
      });
    },
    remove(registry, _bus, actorId) {
      config.modifiers.forEach((_modifier, index) => registry.unregister(modifierId(actorId, index)));
    },
  };
}

/**
 * Tracks which targets are currently (approximately) "Soaked" — see the
 * file-level doc's pattern #1 — plus, per actor, the last target that actor
 * itself landed a hit on. Shared by every Water perk below whose effect is
 * gated on "the enemy I just hit is Soaked."
 */
function createSoakedTracker() {
  const soakedUntilByTarget = new Map<string, number>();
  const lastTargetHitByActor = new Map<string, string>();
  const SOAKED_TRACK_MS = 4000; // mirrors water_soaked's ~3-4s duration in schools/water.ts

  return {
    onHit(event: CombatEventMap["onHit"], observingActorId: string): void {
      if (event.damageType === "water") {
        soakedUntilByTarget.set(event.targetId, Date.now() + SOAKED_TRACK_MS);
      }
      if (event.attackerId === observingActorId) {
        lastTargetHitByActor.set(observingActorId, event.targetId);
      }
    },
    isLastHitTargetSoaked(actorId: string): boolean {
      const target = lastTargetHitByActor.get(actorId);
      if (target === undefined) {
        return false;
      }
      const expiresAt = soakedUntilByTarget.get(target);
      return expiresAt !== undefined && expiresAt > Date.now();
    },
    forget(actorId: string): void {
      lastTargetHitByActor.delete(actorId);
    },
  };
}

/**
 * A perk that registers a single modifier gated on "the enemy this actor
 * just hit is currently Soaked" (`createSoakedTracker`). Backs both
 * Tidecaller and Pressure — the only difference between the two is which
 * stat/op they contribute to. See `PERK_WATER_TIDECALLER`'s own comment for
 * the "Soaked" approximation's limits and the `damageMultiplier` exception.
 *
 * Per the file-level doc's pattern #3, the `onHit` handler doesn't just feed
 * `tracker` — it also re-registers the modifier so `ModifierRegistryImpl`
 * drops its cache and the next `get()` reflects the actor's current
 * "last-hit target Soaked?" state immediately, not whenever some unrelated
 * `register`/`unregister` call next happens to run. (The Soaked window's
 * silent time-based expiry has the same residual approximation Bulwark's
 * `perks/forms.ts` doc calls out: it only becomes visible on this actor's
 * *next* hit, not at the exact instant the window closes.)
 */
function createSoakedGatedPerk(config: {
  id: string;
  displayName: string;
  description: string;
  stat: string;
  op: ModifierOp;
  value: number;
}): Perk {
  const tracker = createSoakedTracker();
  const hitHandlerByActor = new Map<string, (event: CombatEventMap["onHit"]) => void>();
  const modifierId = (actorId: string) => `${config.id}:${actorId}`;

  const registerModifier = (registry: Parameters<Perk["apply"]>[0], actorId: string): void => {
    registry.register({
      id: modifierId(actorId),
      stat: config.stat,
      op: config.op,
      value: config.value,
      condition: () => tracker.isLastHitTargetSoaked(actorId),
    });
  };

  return {
    id: config.id,
    tier: "school",
    displayName: config.displayName,
    description: config.description,
    apply(registry, bus, actorId) {
      registerModifier(registry, actorId);

      const hitHandler = (event: CombatEventMap["onHit"]) => {
        tracker.onHit(event, actorId);
        registerModifier(registry, actorId); // force ModifierRegistryImpl's cache to drop — see pattern #3
      };
      hitHandlerByActor.set(actorId, hitHandler);
      bus.on("onHit", hitHandler);
    },
    remove(registry, bus, actorId) {
      const hitHandler = hitHandlerByActor.get(actorId);
      if (hitHandler) {
        bus.off("onHit", hitHandler);
        hitHandlerByActor.delete(actorId);
      }
      tracker.forget(actorId);
      registry.unregister(modifierId(actorId));
    },
  };
}

// ---------------------------------------------------------------------------
// Earth
// ---------------------------------------------------------------------------

const EARTH_PETRIFY_STUN_CHANCE = 0.12;

/**
 * Petrify — "chance on hit to briefly stun."
 *
 * PLACEHOLDER GAP: there is no target-status-application API anywhere in
 * `packages/sim` — `CombatEventBus` only reports events after the fact, a
 * `Perk` can't command "stun entity X." Registers the proc-chance knob (an
 * `override`'d fraction, per the file-level doc's stat convention) a future
 * on-hit resolution/status system would roll against and apply the stun
 * through.
 */
export const PERK_EARTH_PETRIFY: Perk = createStaticModifierPerk({
  id: "earth_petrify",
  displayName: "Petrify",
  description: "Chance on hit to briefly stun.",
  modifiers: [{ stat: "earthPetrifyStunChance", op: "override", value: EARTH_PETRIFY_STUN_CHANCE }],
});

const EARTH_FORTIFY_STONESKIN_MAX_STACK_BONUS = 3;

/**
 * Fortify — "raises the cap on Stoneskin's damage-reduction stacks."
 *
 * PLACEHOLDER GAP: Stoneskin (`earth_stoneskin`, `schools/earth.ts`) is
 * descriptive-only — "damage reduction that stacks the longer you hold your
 * ground, or the more hits you take" has no runtime stacking/cap system
 * yet. Registers `earthStoneskinMaxStackBonus` (an `override`'d flat count,
 * mirroring `perks/forms.ts`'s `gasDotMaxStacksBonus`) for a future
 * Stoneskin implementation to add on top of its own base cap.
 */
export const PERK_EARTH_FORTIFY: Perk = createStaticModifierPerk({
  id: "earth_fortify",
  displayName: "Fortify",
  description: "Raises the cap on Stoneskin's damage-reduction stacks.",
  modifiers: [
    { stat: "earthStoneskinMaxStackBonus", op: "override", value: EARTH_FORTIFY_STONESKIN_MAX_STACK_BONUS },
  ],
});

const EARTH_QUAKE_STEP_SLOW_MAGNITUDE = 0.2;

/**
 * Quake Step — "dash leaves cracks that slow enemies."
 *
 * PLACEHOLDER GAP: a crack is a positioned, timed spatial hazard —
 * `CombatEventBus`/`ModifierRegistry` carry no position data at all, so
 * spawning/placing it is future combat-runtime/rendering work, the same
 * category as `perks/forms.ts`'s Aftershock/Riptide. What's expressible is
 * the slow's magnitude, declared as `earthQuakeStepSlowMagnitude` (an
 * `override`'d fraction) for that future system to read when it spawns a
 * crack — it would listen for `onDash` itself and bake this magnitude into
 * the hazard it creates, so this perk doesn't need its own `onDash`
 * subscription just to expose a static number.
 */
export const PERK_EARTH_QUAKE_STEP: Perk = createStaticModifierPerk({
  id: "earth_quake_step",
  displayName: "Quake Step",
  description: "Dash leaves cracks that slow enemies.",
  modifiers: [{ stat: "earthQuakeStepSlowMagnitude", op: "override", value: EARTH_QUAKE_STEP_SLOW_MAGNITUDE }],
});

const EARTH_GOLEMS_HEART_MAX_HEALTH_MULTIPLIER = 1.2;

/**
 * Golem's Heart — "flat max HP increase."
 *
 * Reuses `maxHealthMultiplier` — the same placeholder stat `perks/rare.ts`'s
 * Glass Cannon already established for max-HP changes (`mult`, 1.0
 * baseline) — rather than inventing an Earth-specific duplicate, so the two
 * stack correctly if an actor has both. The GDD calls this "flat," but
 * since no flat-HP stat convention exists anywhere in this codebase yet
 * (Health, per Glass Cannon's own comment, is "a plain component with no
 * `ModifierRegistry` integration yet"), this is expressed the same
 * percentage-based way as every other max-HP perk so far, for a future
 * Health/ECS integration to read uniformly.
 */
export const PERK_EARTH_GOLEMS_HEART: Perk = createStaticModifierPerk({
  id: "earth_golems_heart",
  displayName: "Golem's Heart",
  description: "Flat max HP increase.",
  modifiers: [{ stat: "maxHealthMultiplier", op: "mult", value: EARTH_GOLEMS_HEART_MAX_HEALTH_MULTIPLIER }],
});

export const SCHOOL_PERKS_EARTH: Perk[] = [
  PERK_EARTH_PETRIFY,
  PERK_EARTH_FORTIFY,
  PERK_EARTH_QUAKE_STEP,
  PERK_EARTH_GOLEMS_HEART,
];

// ---------------------------------------------------------------------------
// Fire
// ---------------------------------------------------------------------------

const FIRE_EMBER_CASCADE_BURNING_TRACK_MS = 4000; // mirrors "burning"'s ~3-4s duration in schools/fire.ts

/**
 * Ember Cascade — "killing a burning enemy spreads fire to nearby foes."
 *
 * PLACEHOLDER GAP: "burning" (`schools/fire.ts`'s Kindling passive) has no
 * live status-effect runtime to query, so this perk approximates it itself
 * — the same "while burning" closure-tracking pattern documented at the top
 * of this file: any `onHit` this actor lands with `damageType: "fire"`
 * marks the target as burning for a few seconds. The actual "ignite nearby
 * foes" AoE needs a spatial/ECS query this package doesn't have (same
 * category as Quake Step's cracks), so each qualifying kill instead
 * increments `fireEmberCascadeProcCount` (an `override`'d, ever-increasing
 * count — any increase is the signal a future AoE-ignite system should
 * watch for and act on).
 */
function createFireEmberCascadePerk(): Perk {
  const id = "fire_ember_cascade";
  const burningUntilByTarget = new Map<string, number>();
  const procCountByActor = new Map<string, number>();
  const hitHandlerByActor = new Map<string, (event: CombatEventMap["onHit"]) => void>();
  const killHandlerByActor = new Map<string, (event: CombatEventMap["onKill"]) => void>();
  const procCountModifierId = (actorId: string) => `${id}:${actorId}`;

  return {
    id,
    tier: "school",
    displayName: "Ember Cascade",
    description: "Killing a burning enemy spreads fire to nearby foes.",
    apply(registry, bus, actorId) {
      procCountByActor.set(actorId, 0);

      const hitHandler = (event: CombatEventMap["onHit"]) => {
        if (event.attackerId === actorId && event.damageType === "fire") {
          burningUntilByTarget.set(event.targetId, Date.now() + FIRE_EMBER_CASCADE_BURNING_TRACK_MS);
        }
      };
      const killHandler = (event: CombatEventMap["onKill"]) => {
        if (event.killerId !== actorId) {
          return;
        }
        const burningUntil = burningUntilByTarget.get(event.victimId);
        burningUntilByTarget.delete(event.victimId);
        if (burningUntil !== undefined && burningUntil > Date.now()) {
          const nextCount = (procCountByActor.get(actorId) ?? 0) + 1;
          procCountByActor.set(actorId, nextCount);
          registry.unregister(procCountModifierId(actorId));
          registry.register({
            id: procCountModifierId(actorId),
            stat: "fireEmberCascadeProcCount",
            op: "override",
            value: nextCount,
          });
        }
      };
      hitHandlerByActor.set(actorId, hitHandler);
      killHandlerByActor.set(actorId, killHandler);
      bus.on("onHit", hitHandler);
      bus.on("onKill", killHandler);
    },
    remove(registry, bus, actorId) {
      const hitHandler = hitHandlerByActor.get(actorId);
      if (hitHandler) {
        bus.off("onHit", hitHandler);
        hitHandlerByActor.delete(actorId);
      }
      const killHandler = killHandlerByActor.get(actorId);
      if (killHandler) {
        bus.off("onKill", killHandler);
        killHandlerByActor.delete(actorId);
      }
      procCountByActor.delete(actorId);
      registry.unregister(procCountModifierId(actorId));
    },
  };
}

export const PERK_FIRE_EMBER_CASCADE: Perk = createFireEmberCascadePerk();

const FIRE_SLOW_BURN_DOT_DURATION_MULTIPLIER = 1.5;

/**
 * Slow Burn — "longer DoT duration." Fully expressible today as a
 * multiplier-style stat: `fireDotDurationMultiplier` (1.0 baseline) for a
 * future burn/status system to multiply a `StatusEffectApplication.
 * durationSeconds` by before applying "burning" to a target.
 */
export const PERK_FIRE_SLOW_BURN: Perk = createStaticModifierPerk({
  id: "fire_slow_burn",
  displayName: "Slow Burn",
  description: "Longer DoT duration.",
  modifiers: [
    { stat: "fireDotDurationMultiplier", op: "mult", value: FIRE_SLOW_BURN_DOT_DURATION_MULTIPLIER },
  ],
});

const FIRE_BACKDRAFT_DETONATION_DAMAGE_MULTIPLIER = 1.35;

/**
 * Backdraft — "larger Kindling detonations."
 *
 * PLACEHOLDER GAP: Kindling's detonation (`schools/fire.ts`) isn't
 * implemented as runtime behavior yet, and "larger" also implies a bigger
 * AoE radius — this registry only folds scalar stats, it has no spatial
 * radius concept. Registers the damage half, `fireKindlingDetonationDamageMultiplier`
 * (1.0 baseline), for a future Kindling implementation to read; the radius
 * half is left undeclared until a radius-bearing stat convention exists
 * elsewhere in this codebase.
 */
export const PERK_FIRE_BACKDRAFT: Perk = createStaticModifierPerk({
  id: "fire_backdraft",
  displayName: "Backdraft",
  description: "Larger Kindling detonations.",
  modifiers: [
    {
      stat: "fireKindlingDetonationDamageMultiplier",
      op: "mult",
      value: FIRE_BACKDRAFT_DETONATION_DAMAGE_MULTIPLIER,
    },
  ],
});

/**
 * Phoenix Ash — "once per run, death instead leaves a fire nova and you
 * keep going."
 *
 * PLACEHOLDER GAP: same as Second Wind (`perks/universal.ts`) — `onKill`
 * only reports a kill as already resolved, there is no cancelable
 * pre-death hook in `CombatEventMap` today, so nothing here can actually
 * prevent the run from ending. What this implements, exactly mirroring
 * Second Wind's pattern: a closure-scoped `usedThisExpedition` flag (once
 * per run is *not* interface-level state — `Perk.apply`/`remove` take no
 * run-scoped reset parameter — so callers MUST construct a fresh instance
 * via `createPerkFirePhoenixAsh()` for every new expedition;
 * `PERK_FIRE_PHOENIX_ASH` below is a convenience singleton for callers that
 * only ever run one expedition). While unused, `firePhoenixAshAvailable`
 * reads `1` (an `override`, so a future death-handling system can check it
 * unambiguously); the actor's own death (`onKill` with `victimId ===
 * actorId`) consumes it by unregistering the modifier. That future system
 * is expected to check this stat immediately before finalizing a killing
 * blow against this actor: if set, cancel the death, spawn the fire nova,
 * and let this perk's bookkeeping mark the charge spent.
 */
export function createPerkFirePhoenixAsh(): Perk {
  let usedThisExpedition = false;
  const killHandlerByActor = new Map<string, (event: CombatEventMap["onKill"]) => void>();
  const availabilityModifierId = (actorId: string) => `fire_phoenix_ash:${actorId}`;

  return {
    id: "fire_phoenix_ash",
    tier: "school",
    displayName: "Phoenix Ash",
    description: "Once per run, death instead leaves a fire nova and you keep going.",
    apply(registry, bus, actorId) {
      if (!usedThisExpedition) {
        registry.register({
          id: availabilityModifierId(actorId),
          stat: "firePhoenixAshAvailable",
          op: "override",
          value: 1,
        });
      }

      const handler = (event: CombatEventMap["onKill"]) => {
        if (event.victimId !== actorId || usedThisExpedition) {
          return;
        }
        usedThisExpedition = true;
        registry.unregister(availabilityModifierId(actorId));
      };
      killHandlerByActor.set(actorId, handler);
      bus.on("onKill", handler);
    },
    remove(registry, bus, actorId) {
      const handler = killHandlerByActor.get(actorId);
      if (handler) {
        bus.off("onKill", handler);
        killHandlerByActor.delete(actorId);
      }
      registry.unregister(availabilityModifierId(actorId));
    },
  };
}

export const PERK_FIRE_PHOENIX_ASH: Perk = createPerkFirePhoenixAsh();

export const SCHOOL_PERKS_FIRE: Perk[] = [
  PERK_FIRE_EMBER_CASCADE,
  PERK_FIRE_SLOW_BURN,
  PERK_FIRE_BACKDRAFT,
  PERK_FIRE_PHOENIX_ASH,
];

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

const WATER_TIDECALLER_DAMAGE_BONUS = 0.25;

/**
 * Tidecaller — "Soaked enemies take increased damage from all sources."
 *
 * The only School Perk here that's fully live end-to-end today for the
 * actor wielding it: it registers onto `damageMultiplier`, the exact stat
 * `combat/resolveAttack.ts` already reads
 * (`baseTimeline.baseDamage * flavor.damageMultiplier *
 * modifiers.get("damageMultiplier")`), gated on the "Soaked" approximation
 * described at the top of this file. The GDD's "from all sources" is only
 * partially honored: this registry is per-actor, so the bonus applies to
 * *this actor's* damage against a target it (or anyone) has soaked, not
 * damage dealt by other sources (allies/hazards) — genuinely "all sources"
 * would need a shared, target-keyed damage pipeline that doesn't exist yet.
 */
export const PERK_WATER_TIDECALLER: Perk = createSoakedGatedPerk({
  id: "water_tidecaller",
  displayName: "Tidecaller",
  description: "Soaked enemies take increased damage from all sources.",
  stat: "damageMultiplier",
  op: "add",
  value: WATER_TIDECALLER_DAMAGE_BONUS,
});

const WATER_UNDERTOW_CURRENT_ATTACK_SPEED_PENALTY_BONUS = 0.15;

/**
 * Undertow Current — "slows also reduce enemy attack speed."
 *
 * PLACEHOLDER GAP: this actor's `ModifierRegistry` only ever holds *this
 * actor's* stats — there's no handle here onto an enemy's own stat block to
 * actually slow its attack speed. Registers
 * `waterUndertowAttackSpeedPenaltyBonus` (an `override`'d fraction) as the
 * extra attack-speed reduction a future enemy-status system would tack on,
 * on top of a slow's own magnitude, whenever it looks up whether the
 * slow's source actor holds this perk.
 */
export const PERK_WATER_UNDERTOW_CURRENT: Perk = createStaticModifierPerk({
  id: "water_undertow_current",
  displayName: "Undertow Current",
  description: "Slows also reduce enemy attack speed.",
  modifiers: [
    {
      stat: "waterUndertowAttackSpeedPenaltyBonus",
      op: "override",
      value: WATER_UNDERTOW_CURRENT_ATTACK_SPEED_PENALTY_BONUS,
    },
  ],
});

const WATER_HEALING_SPRING_HP_PER_SECOND = 5;

/**
 * Healing Spring — "standing in your own Liquid pool restores HP over
 * time."
 *
 * PLACEHOLDER GAP: "standing in your own Liquid pool" narrows to "the
 * actor is currently in Liquid Form" — the closest signal `onFormSwap`
 * gives us (mirroring `perks/forms.ts`'s `createFormTracker` pattern, only
 * for the single Form this perk cares about); this package has no
 * position/hazard-volume data to check actual overlap with a placed pool,
 * so a future movement/hazard system would need to refine this to true
 * pool-standing. `waterHealingSpringHpPerSecond` is an `override`'d flat
 * HP/sec value, active only while the condition holds. Per the file-level
 * doc's pattern #3, the `onFormSwap` handler re-registers this modifier on
 * every swap (not just flipping the tracked flag), forcing
 * `ModifierRegistryImpl` to drop its cache so the next `get()` reflects the
 * actor's current Form immediately.
 */
function createWaterHealingSpringPerk(): Perk {
  const id = "water_healing_spring";
  const inLiquidFormByActor = new Map<string, boolean>();
  const formSwapHandlerByActor = new Map<string, (event: CombatEventMap["onFormSwap"]) => void>();
  const modifierId = (actorId: string) => `${id}:${actorId}`;

  const registerModifier = (registry: Parameters<Perk["apply"]>[0], actorId: string): void => {
    registry.register({
      id: modifierId(actorId),
      stat: "waterHealingSpringHpPerSecond",
      op: "override",
      value: WATER_HEALING_SPRING_HP_PER_SECOND,
      condition: () => inLiquidFormByActor.get(actorId) === true,
    });
  };

  return {
    id,
    tier: "school",
    displayName: "Healing Spring",
    description: "Standing in your own Liquid pool restores HP over time.",
    apply(registry, bus, actorId) {
      inLiquidFormByActor.set(actorId, false);
      registerModifier(registry, actorId);

      const formSwapHandler = (event: CombatEventMap["onFormSwap"]) => {
        if (event.actorId !== actorId) {
          return;
        }
        inLiquidFormByActor.set(actorId, event.toForm === "liquid");
        registerModifier(registry, actorId); // force ModifierRegistryImpl's cache to drop — see pattern #3
      };
      formSwapHandlerByActor.set(actorId, formSwapHandler);
      bus.on("onFormSwap", formSwapHandler);
    },
    remove(registry, bus, actorId) {
      const formSwapHandler = formSwapHandlerByActor.get(actorId);
      if (formSwapHandler) {
        bus.off("onFormSwap", formSwapHandler);
        formSwapHandlerByActor.delete(actorId);
      }
      inLiquidFormByActor.delete(actorId);
      registry.unregister(modifierId(actorId));
    },
  };
}

export const PERK_WATER_HEALING_SPRING: Perk = createWaterHealingSpringPerk();

const WATER_PRESSURE_STUN_CHANCE_ON_SOAKED_BONUS = 0.15;

/**
 * Pressure — "hits on Soaked enemies have a chance to stun."
 *
 * Same "Soaked" approximation and `createSoakedGatedPerk` machinery as
 * Tidecaller. PLACEHOLDER GAP: same as Earth's Petrify — no
 * target-status-application API exists to actually roll and apply a stun.
 * `waterPressureStunChanceOnSoakedBonus` (an `override`'d fraction, active
 * only while the last-hit target is Soaked) is the probability knob a
 * future on-hit resolution system would roll against.
 */
export const PERK_WATER_PRESSURE: Perk = createSoakedGatedPerk({
  id: "water_pressure",
  displayName: "Pressure",
  description: "Hits on Soaked enemies have a chance to stun.",
  stat: "waterPressureStunChanceOnSoakedBonus",
  op: "override",
  value: WATER_PRESSURE_STUN_CHANCE_ON_SOAKED_BONUS,
});

export const SCHOOL_PERKS_WATER: Perk[] = [
  PERK_WATER_TIDECALLER,
  PERK_WATER_UNDERTOW_CURRENT,
  PERK_WATER_HEALING_SPRING,
  PERK_WATER_PRESSURE,
];

// ---------------------------------------------------------------------------
// Air
// ---------------------------------------------------------------------------

const AIR_DOWNBURST_KNOCKBACK_FORCE = 8;

/**
 * Downburst — "dash knocks back enemies in your path."
 *
 * PLACEHOLDER GAP: knocking back "enemies in your path" needs live
 * position/physics data (who's in front of the actor, how far to push
 * them) that neither `CombatEventBus` nor `ModifierRegistry` model — the
 * same category as Earth's Quake Step. A future dash-resolution system
 * would listen for `onDash` itself and read `airDownburstKnockbackForce`
 * (an `override`'d force magnitude, units/sec scaled the same way
 * `perks/forms.ts`'s Riptide scales `liquidPoolPullStrength`) when it
 * applies the knockback.
 */
export const PERK_AIR_DOWNBURST: Perk = createStaticModifierPerk({
  id: "air_downburst",
  displayName: "Downburst",
  description: "Dash knocks back enemies in your path.",
  modifiers: [{ stat: "airDownburstKnockbackForce", op: "override", value: AIR_DOWNBURST_KNOCKBACK_FORCE }],
});

const AIR_STATIC_GUST_SHOCK_MAGNITUDE = 4;

/**
 * Static Gust — "Air/Gas clouds also apply a minor shock."
 *
 * PLACEHOLDER GAP: no status-effect resolver exists to actually apply a
 * "shock" tick to a target. A future combat system resolving an Air+Gas
 * hit already knows, from `FormFlavor`/`ResolvedAttack`, that it's
 * resolving an Air-School Gas-Form hit — it doesn't need this perk to
 * re-derive that context via its own Form tracking, only to expose the
 * shock's magnitude: `airStaticGustShockMagnitude` (an `override`'d flat
 * damage amount, mirroring `perks/forms.ts`'s Vapor Trail's
 * `gasVaporTrailDamagePerTick`).
 */
export const PERK_AIR_STATIC_GUST: Perk = createStaticModifierPerk({
  id: "air_static_gust",
  displayName: "Static Gust",
  description: "Air/Gas clouds also apply a minor shock.",
  modifiers: [{ stat: "airStaticGustShockMagnitude", op: "override", value: AIR_STATIC_GUST_SHOCK_MAGNITUDE }],
});

const AIR_UPDRAFT_GLIDE_DURATION_MULTIPLIER = 1.5;

/**
 * Updraft — "significantly longer glide duration."
 *
 * PLACEHOLDER GAP: glide duration lives entirely in
 * `MovementConfig.glideMaxDuration`/`MovementState.glideRemaining`
 * (`packages/sim/src/movement/types.ts`), computed by `MovementController`
 * with no `ModifierRegistry` awareness at all — the same gap as
 * `perks/universal.ts`'s Vigilant Eye (vision range). Registers
 * `airGlideDurationMultiplier` (1.0 baseline) for a future movement-perk
 * integration pass to multiply `glideMaxDuration` by.
 */
export const PERK_AIR_UPDRAFT: Perk = createStaticModifierPerk({
  id: "air_updraft",
  displayName: "Updraft",
  description: "Significantly longer glide duration.",
  modifiers: [{ stat: "airGlideDurationMultiplier", op: "mult", value: AIR_UPDRAFT_GLIDE_DURATION_MULTIPLIER }],
});

const AIR_ZEPHYRS_FOCUS_BONUS_MULTIPLIER = 1.3;
const AIR_ZEPHYRS_FOCUS_DURATION_MULTIPLIER = 1.4;

/**
 * Zephyr's Focus — "Tailwind's bonus is stronger and lasts longer."
 *
 * PLACEHOLDER GAP: Tailwind (`air_tailwind`, `schools/air.ts`) is
 * descriptive-only — "landing a hit grants a brief, stacking boost to
 * move/attack speed" has no runtime stacking system yet. Registers the two
 * numeric knobs the GDD calls out ("stronger" / "lasts longer") as
 * multiplier-style stats (1.0 baseline each) for a future Tailwind
 * implementation to read.
 */
export const PERK_AIR_ZEPHYRS_FOCUS: Perk = createStaticModifierPerk({
  id: "air_zephyrs_focus",
  displayName: "Zephyr's Focus",
  description: "Tailwind's bonus is stronger and lasts longer.",
  modifiers: [
    { stat: "airTailwindBonusMultiplier", op: "mult", value: AIR_ZEPHYRS_FOCUS_BONUS_MULTIPLIER },
    { stat: "airTailwindDurationMultiplier", op: "mult", value: AIR_ZEPHYRS_FOCUS_DURATION_MULTIPLIER },
  ],
});

export const SCHOOL_PERKS_AIR: Perk[] = [
  PERK_AIR_DOWNBURST,
  PERK_AIR_STATIC_GUST,
  PERK_AIR_UPDRAFT,
  PERK_AIR_ZEPHYRS_FOCUS,
];

// ---------------------------------------------------------------------------
// Aether
// ---------------------------------------------------------------------------

const AETHER_ECHO_CHANCE_BONUS = 0.15;

/**
 * Echo — "increased chance for abilities to fire twice."
 *
 * Directly amplifies Starlight Attunement (`aether_starlight_attunement`,
 * `schools/aether.ts`: "abilities have a chance to echo, firing a second
 * time"), which is itself descriptive-only — no runtime ability-cast
 * resolver exists yet to roll and re-fire an ability. Registers
 * `aetherEchoChanceBonus` as an `override`'d fraction (same treatment as
 * `perks/forms.ts`'s Volatile Core `criticalDoubleChance` — a proc chance
 * for a duplicate/second action) for that future resolver to roll against.
 */
export const PERK_AETHER_ECHO: Perk = createStaticModifierPerk({
  id: "aether_echo",
  displayName: "Echo",
  description: "Increased chance for abilities to fire twice.",
  modifiers: [{ stat: "aetherEchoChanceBonus", op: "override", value: AETHER_ECHO_CHANCE_BONUS }],
});

const AETHER_STARBOUND_ULTIMATE_COOLDOWN_MULTIPLIER = 0.8;

/**
 * Starbound — "reduced Ultimate cooldown." Fully expressible today as a
 * multiplier-style stat, scoped specifically to the Ultimate (not the
 * generic, unconsumed `cooldownMultiplier` StatKey, which would also
 * incorrectly cut dash/ability cooldowns): `aetherUltimateCooldownMultiplier`
 * (1.0 baseline) for a future Ultimate-cooldown resolver to multiply
 * `UltimateBehavior.cooldownSeconds` by.
 */
export const PERK_AETHER_STARBOUND: Perk = createStaticModifierPerk({
  id: "aether_starbound",
  displayName: "Starbound",
  description: "Reduced Ultimate cooldown.",
  modifiers: [
    {
      stat: "aetherUltimateCooldownMultiplier",
      op: "mult",
      value: AETHER_STARBOUND_ULTIMATE_COOLDOWN_MULTIPLIER,
    },
  ],
});

const AETHER_FRACTAL_INSIGHT_REVEAL_RADIUS = 15;

/**
 * Fractal Insight — "reveals nearby Reagents/secrets on the minimap."
 *
 * PLACEHOLDER GAP: there is no minimap anywhere in this codebase yet — not
 * even a partial system, unlike glide duration (which at least has a
 * `MovementConfig` field waiting to be read). Registers
 * `aetherFractalInsightRevealRadius` (an `override`'d radius) so that
 * whenever a minimap/reagent-detection system lands, it can query this per
 * actor to decide the reveal radius around them; entirely inert until then.
 */
export const PERK_AETHER_FRACTAL_INSIGHT: Perk = createStaticModifierPerk({
  id: "aether_fractal_insight",
  displayName: "Fractal Insight",
  description: "Reveals nearby Reagents/secrets on the minimap.",
  modifiers: [
    { stat: "aetherFractalInsightRevealRadius", op: "override", value: AETHER_FRACTAL_INSIGHT_REVEAL_RADIUS },
  ],
});

const AETHER_EVENT_HORIZON_PULL_FORCE = 3;

/**
 * Event Horizon — "Aether hits pull enemies slightly before damaging."
 *
 * PLACEHOLDER GAP: pulling a target toward a point is spatial simulation
 * (live positions, a per-frame force) that neither `CombatEventBus` nor
 * `ModifierRegistry` model — the same category as Downburst/Quake Step.
 * Unlike those, this effect isn't conditional on anything beyond "this was
 * an Aether hit," which a future combat system resolving the hit already
 * knows from `FormFlavor.damageType`; it would read
 * `aetherEventHorizonPullForce` (an `override`'d pull-force magnitude) when
 * sequencing the pull before the damage.
 */
export const PERK_AETHER_EVENT_HORIZON: Perk = createStaticModifierPerk({
  id: "aether_event_horizon",
  displayName: "Event Horizon",
  description: "Aether hits pull enemies slightly before damaging.",
  modifiers: [{ stat: "aetherEventHorizonPullForce", op: "override", value: AETHER_EVENT_HORIZON_PULL_FORCE }],
});

export const SCHOOL_PERKS_AETHER: Perk[] = [
  PERK_AETHER_ECHO,
  PERK_AETHER_STARBOUND,
  PERK_AETHER_FRACTAL_INSIGHT,
  PERK_AETHER_EVENT_HORIZON,
];

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export const SCHOOL_PERKS_BY_SCHOOL: Record<SchoolId, Perk[]> = {
  earth: SCHOOL_PERKS_EARTH,
  fire: SCHOOL_PERKS_FIRE,
  water: SCHOOL_PERKS_WATER,
  air: SCHOOL_PERKS_AIR,
  aether: SCHOOL_PERKS_AETHER,
};

export const SCHOOL_PERKS: Perk[] = [
  ...SCHOOL_PERKS_BY_SCHOOL.earth,
  ...SCHOOL_PERKS_BY_SCHOOL.fire,
  ...SCHOOL_PERKS_BY_SCHOOL.water,
  ...SCHOOL_PERKS_BY_SCHOOL.air,
  ...SCHOOL_PERKS_BY_SCHOOL.aether,
];
