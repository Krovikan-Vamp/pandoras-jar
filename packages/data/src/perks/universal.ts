import type { CombatEventMap, Perk } from "@pithos/sim";

/**
 * Universal Perks (GDD.md §6, "Universal Perks" table) — the 8 perks
 * available to every build regardless of School/Form, offered Hades-boon
 * style (pick 1 of 3) after clearing a room.
 *
 * `Perk.apply`/`remove` (packages/sim/src/perks/Perk.ts) is the entire
 * integration surface with the rest of the sim: register `Modifier`s into
 * the actor's `ModifierRegistryImpl` and/or subscribe to `CombatEventBus`
 * events, and `remove` must reverse exactly that. See `Perk.test.ts`'s
 * "triple-kill-frenzy" fixture for the worked pattern this file follows
 * throughout (per-actor bookkeeping in a closure-scoped `Map`, lazy
 * modifier registration from inside an event handler, symmetric teardown).
 *
 * Several of these perks reference systems that don't exist in
 * `packages/sim` yet:
 *   - vision range lives entirely inside `MovementController`'s own
 *     `MovementConfig`/`MovementState` (packages/sim/src/movement/*) and is
 *     never read from `ModifierRegistry`;
 *   - Reagents/Motes aren't modeled as a resource/drop-table type anywhere;
 *   - crowd-control duration and Form-swap Flux cost are plain fields
 *     (`StatusEffectApplication.durationSeconds`, `FormDefinition.
 *     fluxCostToSwapIn`) that nothing currently multiplies through a perk
 *     stat;
 *   - there is no bus event that samples an actor's *current* move speed
 *     over time (only the discrete, one-shot `onDash`).
 *
 * Per this content pass's brief, those perks are still authored as
 * correctly-typed, fully wired-into-today's-primitives `Perk`s: each
 * registers the closest reasonable placeholder `StatKey` (an open string,
 * per perks/types.ts) and/or hooks the closest available `CombatEventMap`
 * event, with an inline "PLACEHOLDER GAP" comment calling out exactly what
 * a future integration pass needs to read for the effect to actually
 * matter. Nothing here invents a new `CombatEventMap` event type.
 */

/**
 * Second Wind — "Survive one killing blow at 1 HP (once per expedition)."
 *
 * PLACEHOLDER GAP: actually preventing death needs (a) read access to the
 * actor's current/remaining HP and (b) a cancelable pre-death hook fired
 * *before* HP is finalized at <= 0. Neither exists yet — `Health` lives on
 * the ECS entity (ecs/world.ts) and is opaque to the perk system, and
 * `CombatEventMap.onTakeDamage` is fire-and-forget: no remaining-HP field,
 * and nothing a handler does can veto or rewrite the damage that already
 * happened.
 *
 * Closest expressible stand-in: this perk exposes a "charge available"
 * signal on a placeholder `secondWindCharges` stat. It registers that stat
 * as `2` while unused — deliberately *not* `1`, so it's unambiguous
 * against `ModifierRegistryImpl`'s baseline fold-with-no-modifiers value of
 * `1` (see ModifierRegistry.ts's `fold()` doc) once the charge is spent and
 * the modifier is unregistered. A future HP-aware combat runtime is
 * expected to check this immediately before applying damage that would
 * bring HP to <= 0: if `>= 2`, clamp HP to 1 instead of 0 and let this
 * perk's bookkeeping consume the charge.
 *
 * Consumption is modeled here by listening for the actor's first
 * `onTakeDamage` this expedition — the best available proxy for "the actor
 * was hit" today — and unregistering the charge modifier at that point.
 * This is an approximation (it burns the charge on the first hit taken at
 * all, not specifically a *lethal* one) until a real lethal-damage-aware
 * event exists.
 *
 * "Once per expedition" is implemented as a closure-scoped flag rather
 * than interface-level state, since `Perk.apply`/`remove` take no
 * run-scoped reset parameter. Per this pass's brief: callers MUST
 * construct a *fresh* instance via the exported `createPerkSecondWind()`
 * factory for every new expedition/run. `PERK_SECOND_WIND` below is a
 * convenience singleton for callers that only ever run one expedition (e.g.
 * tests, or roster-listing code that never calls `apply`); reusing it (or
 * any single instance) across multiple runs will NOT reset the flag.
 */
export function createPerkSecondWind(): Perk {
  let usedThisExpedition = false;
  const handlerByActor = new Map<string, (event: CombatEventMap["onTakeDamage"]) => void>();
  const chargeModifierId = (actorId: string) => `universal_second_wind.charge:${actorId}`;

  return {
    id: "universal_second_wind",
    tier: "universal",
    displayName: "Second Wind",
    description: "Survive one killing blow at 1 HP (once per expedition).",
    apply(registry, bus, actorId) {
      // Only grant the charge if this instance hasn't already spent it —
      // otherwise re-applying a spent instance (which callers are told not
      // to do, but which should still behave consistently if it happens)
      // would show a charge as "available" that the handler below can then
      // never actually consume, since `usedThisExpedition` already gates it.
      if (!usedThisExpedition) {
        registry.register({
          id: chargeModifierId(actorId),
          stat: "secondWindCharges",
          op: "override",
          value: 2,
        });
      }

      const handler = (event: CombatEventMap["onTakeDamage"]) => {
        if (event.actorId !== actorId || usedThisExpedition) {
          return;
        }
        usedThisExpedition = true;
        registry.unregister(chargeModifierId(actorId));
      };
      handlerByActor.set(actorId, handler);
      bus.on("onTakeDamage", handler);
    },
    remove(registry, bus, actorId) {
      const handler = handlerByActor.get(actorId);
      if (handler) {
        bus.off("onTakeDamage", handler);
        handlerByActor.delete(actorId);
      }
      registry.unregister(chargeModifierId(actorId));
    },
  };
}

export const PERK_SECOND_WIND: Perk = createPerkSecondWind();

/**
 * Momentum — "Move speed grants stacking attack speed."
 *
 * PLACEHOLDER GAP: `MovementController` computes speed internally from its
 * own `MovementConfig`/`MovementInput` and never reads `ModifierRegistry`,
 * and `CombatEventMap` has no event that samples current speed over time
 * (only the discrete `onDash`). There is therefore no way today to make
 * the attack-speed bonus scale with — let alone *stack from* — current
 * move speed as the GDD describes. As the closest expressible stand-in,
 * this registers a flat, always-on attack-speed bonus via
 * `cooldownMultiplier` (the closest existing proxy for "attack speed":
 * lower cooldown means faster attacks) approximating the rough average
 * payoff of the intended stacking effect. A future movement-perk
 * integration pass should replace this with a modifier whose value tracks
 * `MovementState.speed` live.
 */
export const PERK_MOMENTUM: Perk = {
  id: "universal_momentum",
  tier: "universal",
  displayName: "Momentum",
  description: "Move speed grants stacking attack speed.",
  apply(registry, bus, actorId) {
    registry.register({
      id: `universal_momentum:${actorId}`,
      stat: "cooldownMultiplier",
      op: "mult",
      value: 0.92,
    });
  },
  remove(registry, bus, actorId) {
    registry.unregister(`universal_momentum:${actorId}`);
  },
};

/**
 * Vigilant Eye — "Increases base vision range; softens the crouch vision
 * penalty."
 *
 * PLACEHOLDER GAP: vision range (`MovementState.visionRadius`) is derived
 * entirely from `MovementConfig.baseVisionRadius` /
 * `crouchVisionMultiplier` inside `MovementController`, which has no
 * perk/`ModifierRegistry` awareness at all. Registers two placeholder
 * stats for a future movement-perk integration pass to read:
 *   - `visionRangeMultiplier`, meant to multiply `baseVisionRadius`;
 *   - `crouchVisionPenaltyMultiplier` (> 1), meant to multiply
 *     `crouchVisionMultiplier` itself (pushing it closer to `1`, i.e.
 *     softening — not removing — the crouch penalty).
 */
export const PERK_VIGILANT_EYE: Perk = {
  id: "universal_vigilant_eye",
  tier: "universal",
  displayName: "Vigilant Eye",
  description: "Increases base vision range and softens the crouch vision penalty.",
  apply(registry, bus, actorId) {
    registry.register({
      id: `universal_vigilant_eye.range:${actorId}`,
      stat: "visionRangeMultiplier",
      op: "mult",
      value: 1.2,
    });
    registry.register({
      id: `universal_vigilant_eye.crouch:${actorId}`,
      stat: "crouchVisionPenaltyMultiplier",
      op: "mult",
      value: 1.2,
    });
  },
  remove(registry, bus, actorId) {
    registry.unregister(`universal_vigilant_eye.range:${actorId}`);
    registry.unregister(`universal_vigilant_eye.crouch:${actorId}`);
  },
};

/**
 * Quick Fingers — "Reduces Flux cost on Form-swap."
 *
 * PLACEHOLDER GAP: Form-swap Flux cost (`FormDefinition.fluxCostToSwapIn`)
 * is consumed by the Flux/Form-shift machine (`state/FormFluxMachine.ts`)
 * as a fixed number today, not read through `ModifierRegistry`. Registers
 * a `fluxSwapCostMultiplier` stat (< 1) for a future `FormFluxMachine`
 * integration to multiply `fluxCostToSwapIn` by before deducting Flux on
 * swap-in.
 */
export const PERK_QUICK_FINGERS: Perk = {
  id: "universal_quick_fingers",
  tier: "universal",
  displayName: "Quick Fingers",
  description: "Reduces Flux cost on Form-swap.",
  apply(registry, bus, actorId) {
    registry.register({
      id: `universal_quick_fingers:${actorId}`,
      stat: "fluxSwapCostMultiplier",
      op: "mult",
      value: 0.75,
    });
  },
  remove(registry, bus, actorId) {
    registry.unregister(`universal_quick_fingers:${actorId}`);
  },
};

/**
 * Overcharge — "Charge builds 25% faster." Maps directly onto the
 * already-known `chargeRateMultiplier` StatKey (perks/types.ts) — fully
 * expressible today, no placeholder needed.
 */
export const PERK_OVERCHARGE: Perk = {
  id: "universal_overcharge",
  tier: "universal",
  displayName: "Overcharge",
  description: "Charge builds 25% faster.",
  apply(registry, bus, actorId) {
    registry.register({
      id: `universal_overcharge:${actorId}`,
      stat: "chargeRateMultiplier",
      op: "mult",
      value: 1.25,
    });
  },
  remove(registry, bus, actorId) {
    registry.unregister(`universal_overcharge:${actorId}`);
  },
};

/**
 * Scavenger's Luck — "Increased Reagent and Mote drop rate."
 *
 * PLACEHOLDER GAP: Reagents/Motes aren't modeled as a resource/drop-table
 * type anywhere in packages/sim yet (no drop-table shape, no
 * `onLoot`/`onDrop` bus event). Registers a `lootMultiplier` stat — the
 * exact placeholder this content pass's brief calls out by name — for a
 * future loot system to read.
 */
export const PERK_SCAVENGERS_LUCK: Perk = {
  id: "universal_scavengers_luck",
  tier: "universal",
  displayName: "Scavenger's Luck",
  description: "Increased Reagent and Mote drop rate.",
  apply(registry, bus, actorId) {
    registry.register({
      id: `universal_scavengers_luck:${actorId}`,
      stat: "lootMultiplier",
      op: "mult",
      value: 1.3,
    });
  },
  remove(registry, bus, actorId) {
    registry.unregister(`universal_scavengers_luck:${actorId}`);
  },
};

/**
 * Iron Will — "Reduces incoming crowd-control duration."
 *
 * PLACEHOLDER GAP: status-effect application/resolution
 * (`StatusEffectApplication` in combat/types.ts) is, per that file's own
 * doc comment, "resolved by the perk/status system, opaque here" — no such
 * resolver exists in packages/sim yet, so there's nowhere to read a
 * duration multiplier from today. Registers `crowdControlDurationMultiplier`
 * (< 1) for that future resolver to multiply a CC
 * `StatusEffectApplication.durationSeconds` by before applying it to this
 * actor.
 */
export const PERK_IRON_WILL: Perk = {
  id: "universal_iron_will",
  tier: "universal",
  displayName: "Iron Will",
  description: "Reduces incoming crowd-control duration.",
  apply(registry, bus, actorId) {
    registry.register({
      id: `universal_iron_will:${actorId}`,
      stat: "crowdControlDurationMultiplier",
      op: "mult",
      value: 0.7,
    });
  },
  remove(registry, bus, actorId) {
    registry.unregister(`universal_iron_will:${actorId}`);
  },
};

/**
 * Adrenaline — "Kills refund a portion of dash cooldown."
 *
 * PLACEHOLDER GAP: dash cooldown is a live countdown
 * (`MovementState.dashCooldownRemaining`, ticked down every frame by
 * `MovementController` from its own `MovementConfig` —
 * packages/sim/src/movement/*), not a value `ModifierRegistry` can write
 * into; there's no API here to directly decrement a running timer. As the
 * closest expressible stand-in (and per this pass's brief, which calls out
 * a `dashCooldownMultiplier`-style stat as a reasonable invention), each
 * kill by this actor stacks a `dashCooldownMultiplier` reduction via a
 * `CombatEventMap.onKill` subscription — compounding multiplicatively
 * (0.85 per stack) so it asymptotically approaches, but never reaches,
 * zero. A future dash/movement integration should replace this
 * permanent-stacking approximation with an actual one-shot subtraction
 * from `dashCooldownRemaining` on each kill.
 */
export function createPerkAdrenaline(): Perk {
  const stacksByActor = new Map<string, number>();
  const killHandlerByActor = new Map<string, (event: CombatEventMap["onKill"]) => void>();
  const modifierId = (actorId: string) => `universal_adrenaline:${actorId}`;

  return {
    id: "universal_adrenaline",
    tier: "universal",
    displayName: "Adrenaline",
    description: "Kills refund a portion of dash cooldown.",
    apply(registry, bus, actorId) {
      stacksByActor.set(actorId, 0);

      const handler = (event: CombatEventMap["onKill"]) => {
        if (event.killerId !== actorId) {
          return;
        }
        const stacks = (stacksByActor.get(actorId) ?? 0) + 1;
        stacksByActor.set(actorId, stacks);
        registry.register({
          id: modifierId(actorId),
          stat: "dashCooldownMultiplier",
          op: "mult",
          value: 0.85 ** stacks,
        });
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
      stacksByActor.delete(actorId);
      registry.unregister(modifierId(actorId));
    },
  };
}

export const PERK_ADRENALINE: Perk = createPerkAdrenaline();

export const UNIVERSAL_PERKS: Perk[] = [
  PERK_SECOND_WIND,
  PERK_MOMENTUM,
  PERK_VIGILANT_EYE,
  PERK_QUICK_FINGERS,
  PERK_OVERCHARGE,
  PERK_SCAVENGERS_LUCK,
  PERK_IRON_WILL,
  PERK_ADRENALINE,
];
