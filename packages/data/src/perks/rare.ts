import type { CombatEventMap, Perk } from "@pithos/sim";

/**
 * Rare / Legendary Perks (GDD.md §6, "Rare / Legendary Perks" table) — the
 * 6 highest-impact, least-frequently-offered perks. Same `Perk`
 * `apply`/`remove` contract as `./universal.ts` (see that file's header for
 * the general pattern/conventions this file follows); see that file also
 * for the general "what's a documented placeholder vs. fully wired today"
 * framing this content pass uses throughout.
 *
 * Every perk in this tier references at least one system that doesn't
 * exist in packages/sim yet: the Tertiary/Reaction slot, the late-game
 * second-School dual-wield reaction, enemy-tier metadata on kills (no
 * "lieutenant" concept anywhere), Health/max-HP as a perk-readable stat, or
 * co-op/allies. Each is authored as a correctly-typed `Perk` registering
 * the closest reasonable placeholder `StatKey` and/or hooking the closest
 * available `CombatEventMap` event, with a "PLACEHOLDER GAP" comment
 * documenting exactly what's missing and what a future pass should read.
 */

/**
 * Twin Casting — "Tertiary reactions trigger twice."
 *
 * PLACEHOLDER GAP: the Tertiary slot / Reaction system (GDD.md §5
 * "Tertiary Slot — The Reaction Power Curve") isn't implemented anywhere in
 * packages/sim yet — no reaction data type, no `onTertiaryReaction` (or
 * similar) bus event to hook. Registers a `tertiaryReactionTriggerCount`
 * stat at `2` — deliberately distinct from `ModifierRegistryImpl`'s
 * implicit baseline of `1` for an unregistered stat (see
 * ModifierRegistry.ts's `fold()` doc) — for a future reaction resolver to
 * read as "how many times does this actor's Tertiary reaction fire per
 * activation."
 */
export const PERK_TWIN_CASTING: Perk = {
  id: "rare_twin_casting",
  tier: "rare",
  displayName: "Twin Casting",
  description: "Tertiary reactions trigger twice.",
  apply(registry, bus, actorId) {
    registry.register({
      id: `rare_twin_casting:${actorId}`,
      stat: "tertiaryReactionTriggerCount",
      op: "override",
      value: 2,
    });
  },
  remove(registry, bus, actorId) {
    registry.unregister(`rare_twin_casting:${actorId}`);
  },
};

/**
 * Dual Nature — "Unlocks the second-School dual-wield reaction early."
 *
 * PLACEHOLDER GAP: the late-game second-School dual-wield reaction (GDD.md
 * §5) doesn't exist yet anywhere in packages/sim — no unlock-threshold or
 * progress-tracking concept to hook into. Registers a
 * `dualWieldUnlockThresholdMultiplier` stat (< 1) for a future Reaction
 * system to multiply whatever "progress required to unlock" threshold it
 * eventually defines (lower multiplier = unlocks earlier).
 */
export const PERK_DUAL_NATURE: Perk = {
  id: "rare_dual_nature",
  tier: "rare",
  displayName: "Dual Nature",
  description: "Unlocks the second-School dual-wield reaction early.",
  apply(registry, bus, actorId) {
    registry.register({
      id: `rare_dual_nature:${actorId}`,
      stat: "dualWieldUnlockThresholdMultiplier",
      op: "mult",
      value: 0.5,
    });
  },
  remove(registry, bus, actorId) {
    registry.unregister(`rare_dual_nature:${actorId}`);
  },
};

/**
 * Hopeful Ember — "Killing a Spite's lieutenant grants a small permanent
 * (this-run) stat boost."
 *
 * PLACEHOLDER GAP: `CombatEventMap.onKill` carries only `killerId`/
 * `victimId` — no enemy category/tier/"is this a Spite's lieutenant" flag
 * (`EnemyCategory` in enemies/types.ts has no lieutenant concept either,
 * and bosses/types.ts has no sub-boss/lieutenant shape). Until that
 * metadata exists on the event (or a dedicated `onLieutenantKill` event is
 * added), this perk matches on a `victimId` naming convention (containing
 * the substring `"lieutenant"`) as a stand-in signal. A future
 * enemy-authoring/boss-roster pass is expected to either satisfy that
 * convention for lieutenant-tagged enemy ids, or — more robustly — extend
 * `onKill`'s payload with real category metadata this perk should switch
 * to reading instead.
 *
 * Each qualifying kill stacks a small permanent (this-run) `damageMultiplier`
 * bonus, additively (`+5%` per lieutenant kill) — "permanent" for the run
 * because, per the GDD, it's meant to be a one-way ratchet, not a
 * temporary buff.
 */
export function createPerkHopefulEmber(): Perk {
  const stacksByActor = new Map<string, number>();
  const killHandlerByActor = new Map<string, (event: CombatEventMap["onKill"]) => void>();
  const modifierId = (actorId: string) => `rare_hopeful_ember:${actorId}`;

  return {
    id: "rare_hopeful_ember",
    tier: "rare",
    displayName: "Hopeful Ember",
    description: "Killing a Spite's lieutenant grants a small permanent (this-run) stat boost.",
    apply(registry, bus, actorId) {
      stacksByActor.set(actorId, 0);

      const handler = (event: CombatEventMap["onKill"]) => {
        if (event.killerId !== actorId || !event.victimId.includes("lieutenant")) {
          return;
        }
        const stacks = (stacksByActor.get(actorId) ?? 0) + 1;
        stacksByActor.set(actorId, stacks);
        registry.register({
          id: modifierId(actorId),
          stat: "damageMultiplier",
          op: "add",
          value: 0.05 * stacks,
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

export const PERK_HOPEFUL_EMBER: Perk = createPerkHopefulEmber();

/**
 * Glass Cannon — "+50% damage, -30% max HP." The damage half is fully
 * expressible today via the already-known `damageMultiplier` StatKey. Max
 * HP is not: `Health` (`ecs/world.ts`) is a plain component with no
 * `ModifierRegistry` integration yet, so `maxHealthMultiplier` is
 * registered as a documented placeholder — per this pass's brief's own
 * example of this exact pattern — for a future Health/ECS integration to
 * read when computing an actor's effective max HP.
 */
export const PERK_GLASS_CANNON: Perk = {
  id: "rare_glass_cannon",
  tier: "rare",
  displayName: "Glass Cannon",
  description: "+50% damage, -30% max HP.",
  apply(registry, bus, actorId) {
    registry.register({
      id: `rare_glass_cannon.damage:${actorId}`,
      stat: "damageMultiplier",
      op: "mult",
      value: 1.5,
    });
    registry.register({
      id: `rare_glass_cannon.health:${actorId}`,
      stat: "maxHealthMultiplier",
      op: "mult",
      value: 0.7,
    });
  },
  remove(registry, bus, actorId) {
    registry.unregister(`rare_glass_cannon.damage:${actorId}`);
    registry.unregister(`rare_glass_cannon.health:${actorId}`);
  },
};

/**
 * Momentum Engine — "Move speed also increases Charge build rate."
 *
 * PLACEHOLDER GAP: same movement-speed-isn't-bus-exposed gap as Momentum
 * (universal.ts) — `MovementController` never reports current speed
 * through `CombatEventBus`/`ModifierRegistry`, so there's no live signal
 * to scale Charge build rate from. As the closest expressible stand-in,
 * registers a flat `chargeRateMultiplier` bonus (stacks multiplicatively
 * with Overcharge's, since both are `mult` modifiers on the same stat)
 * rather than one that tracks live speed. A future movement-perk
 * integration pass should replace this with a modifier whose value derives
 * from `MovementState.speed`.
 */
export const PERK_MOMENTUM_ENGINE: Perk = {
  id: "rare_momentum_engine",
  tier: "rare",
  displayName: "Momentum Engine",
  description: "Move speed also increases Charge build rate.",
  apply(registry, bus, actorId) {
    registry.register({
      id: `rare_momentum_engine:${actorId}`,
      stat: "chargeRateMultiplier",
      op: "mult",
      value: 1.15,
    });
  },
  remove(registry, bus, actorId) {
    registry.unregister(`rare_momentum_engine:${actorId}`);
  },
};

/**
 * Undertow's Favor — "Your current Form's empowered burst (on swap) also
 * applies to allies, if co-op exists."
 *
 * PLACEHOLDER GAP: co-op doesn't exist anywhere in packages/sim — no ally
 * list, no multi-actor party concept. `Perk.apply` only ever receives a
 * single `actorId` and that actor's own `registry`, with no handle onto any
 * other actor's registry even if allies existed. The real trigger point
 * (`CombatEventMap.onFormSwap`, which conceptually coincides with
 * `FormDefinition.burstOnSwapOut` firing) already exists, but there is
 * nothing this perk could call today to make that burst also hit an ally.
 * Registers a `burstAppliesToAllies` marker stat (`override`, `1`) for a
 * future co-op-aware burst-resolution system to check when it processes a
 * Form's `burstOnSwapOut`: "if the swapping actor has this stat set, also
 * apply the burst to nearby allies."
 */
export const PERK_UNDERTOWS_FAVOR: Perk = {
  id: "rare_undertows_favor",
  tier: "rare",
  displayName: "Undertow's Favor",
  description: "Your current Form's empowered burst (on swap) also applies to allies, if co-op exists.",
  apply(registry, bus, actorId) {
    registry.register({
      id: `rare_undertows_favor:${actorId}`,
      stat: "burstAppliesToAllies",
      op: "override",
      value: 1,
    });
  },
  remove(registry, bus, actorId) {
    registry.unregister(`rare_undertows_favor:${actorId}`);
  },
};

export const RARE_PERKS: Perk[] = [
  PERK_TWIN_CASTING,
  PERK_DUAL_NATURE,
  PERK_HOPEFUL_EMBER,
  PERK_GLASS_CANNON,
  PERK_MOMENTUM_ENGINE,
  PERK_UNDERTOWS_FAVOR,
];
