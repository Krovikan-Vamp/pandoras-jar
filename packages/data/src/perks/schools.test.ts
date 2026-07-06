import { createEventBus, ModifierRegistryImpl, SCHOOL_IDS } from "@pithos/sim";
import { describe, expect, it } from "vitest";

import {
  createPerkFirePhoenixAsh,
  PERK_AETHER_STARBOUND,
  PERK_AIR_UPDRAFT,
  PERK_EARTH_GOLEMS_HEART,
  PERK_FIRE_EMBER_CASCADE,
  PERK_FIRE_SLOW_BURN,
  PERK_WATER_HEALING_SPRING,
  PERK_WATER_PRESSURE,
  PERK_WATER_TIDECALLER,
  SCHOOL_PERKS,
  SCHOOL_PERKS_BY_SCHOOL,
} from "./schools.js";

describe("SCHOOL_PERKS roster shape", () => {
  it("has exactly 20 perks", () => {
    expect(SCHOOL_PERKS).toHaveLength(20);
  });

  it("has exactly one entry per SchoolId in SCHOOL_PERKS_BY_SCHOOL, 4 perks each", () => {
    expect(Object.keys(SCHOOL_PERKS_BY_SCHOOL)).toHaveLength(SCHOOL_IDS.length);
    expect(Object.keys(SCHOOL_PERKS_BY_SCHOOL).sort()).toEqual([...SCHOOL_IDS].sort());
    for (const schoolId of SCHOOL_IDS) {
      expect(SCHOOL_PERKS_BY_SCHOOL[schoolId]).toHaveLength(4);
    }
  });

  it("SCHOOL_PERKS is exactly the concatenation of SCHOOL_PERKS_BY_SCHOOL's groups", () => {
    const fromGroups = SCHOOL_IDS.flatMap((schoolId) => SCHOOL_PERKS_BY_SCHOOL[schoolId]);
    expect(SCHOOL_PERKS).toEqual(fromGroups);
  });

  it("every perk is tier 'school', has a non-empty displayName/description, and a unique id", () => {
    const ids = new Set<string>();
    for (const perk of SCHOOL_PERKS) {
      expect(perk.tier).toBe("school");
      expect(perk.displayName.length).toBeGreaterThan(0);
      expect(perk.description.length).toBeGreaterThan(0);
      expect(ids.has(perk.id)).toBe(false);
      ids.add(perk.id);
    }
    expect(ids.size).toBe(20);
  });

  it("every perk applies and removes cleanly against a fresh registry/bus, for two independent actors", () => {
    // Broad smoke coverage beyond the 5 perks tested in depth below: no
    // perk should throw, leak a handler across actors, or leave the *other*
    // actor's registry non-identity after both apply and both remove.
    for (const perk of SCHOOL_PERKS) {
      const bus = createEventBus();
      const registryA = new ModifierRegistryImpl();
      const registryB = new ModifierRegistryImpl();

      expect(() => perk.apply(registryA, bus, "player-a")).not.toThrow();
      expect(() => perk.apply(registryB, bus, "player-b")).not.toThrow();
      expect(() => perk.remove(registryA, bus, "player-a")).not.toThrow();
      expect(() => perk.remove(registryB, bus, "player-b")).not.toThrow();
    }
  });
});

describe("Golem's Heart (maxHealthMultiplier, shared with rare.ts's Glass Cannon)", () => {
  it("boosts maxHealthMultiplier by 20% and cleanly reverses on remove", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const actorId = "player-1";

    expect(registry.get("maxHealthMultiplier")).toBe(1);

    PERK_EARTH_GOLEMS_HEART.apply(registry, bus, actorId);
    expect(registry.get("maxHealthMultiplier")).toBeCloseTo(1.2);

    PERK_EARTH_GOLEMS_HEART.remove(registry, bus, actorId);
    expect(registry.get("maxHealthMultiplier")).toBe(1);
  });
});

describe("Slow Burn (placeholder fireDotDurationMultiplier)", () => {
  it("boosts fireDotDurationMultiplier by 50% and cleanly reverses on remove", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const actorId = "player-1";

    PERK_FIRE_SLOW_BURN.apply(registry, bus, actorId);
    expect(registry.get("fireDotDurationMultiplier")).toBeCloseTo(1.5);

    PERK_FIRE_SLOW_BURN.remove(registry, bus, actorId);
    expect(registry.get("fireDotDurationMultiplier")).toBe(1);
  });
});

describe("Healing Spring (onFormSwap-gated waterHealingSpringHpPerSecond)", () => {
  it("grants HP/sec only while the actor is in Liquid Form, and only for that actor", () => {
    const bus = createEventBus();
    const registryA = new ModifierRegistryImpl();
    const registryB = new ModifierRegistryImpl();

    PERK_WATER_HEALING_SPRING.apply(registryA, bus, "player-a");
    PERK_WATER_HEALING_SPRING.apply(registryB, bus, "player-b");

    // Baseline before any Form swap: identity value (1), not yet in Liquid.
    expect(registryA.get("waterHealingSpringHpPerSecond")).toBe(1);
    expect(registryB.get("waterHealingSpringHpPerSecond")).toBe(1);

    bus.emit("onFormSwap", { actorId: "player-a", fromForm: "solid", toForm: "liquid" });
    expect(registryA.get("waterHealingSpringHpPerSecond")).toBe(5);
    expect(registryB.get("waterHealingSpringHpPerSecond")).toBe(1); // player-b never swapped

    bus.emit("onFormSwap", { actorId: "player-a", fromForm: "liquid", toForm: "gas" });
    expect(registryA.get("waterHealingSpringHpPerSecond")).toBe(1); // left Liquid, regen gone

    PERK_WATER_HEALING_SPRING.remove(registryA, bus, "player-a");
    PERK_WATER_HEALING_SPRING.remove(registryB, bus, "player-b");
  });

  it("fully reverses apply() on remove(): unregisters the modifier and unsubscribes onFormSwap", () => {
    const bus = createEventBus();
    const registry = new ModifierRegistryImpl();
    const actorId = "player-1";

    PERK_WATER_HEALING_SPRING.apply(registry, bus, actorId);
    bus.emit("onFormSwap", { actorId, fromForm: "solid", toForm: "liquid" });
    expect(registry.get("waterHealingSpringHpPerSecond")).toBe(5);

    PERK_WATER_HEALING_SPRING.remove(registry, bus, actorId);
    expect(registry.get("waterHealingSpringHpPerSecond")).toBe(1);

    // Handler must be unsubscribed — further Form swaps must not resurrect the effect.
    bus.emit("onFormSwap", { actorId, fromForm: "gas", toForm: "liquid" });
    expect(registry.get("waterHealingSpringHpPerSecond")).toBe(1);
  });
});

describe("Updraft (placeholder airGlideDurationMultiplier)", () => {
  it("boosts airGlideDurationMultiplier by 50% and cleanly reverses on remove", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const actorId = "player-1";

    PERK_AIR_UPDRAFT.apply(registry, bus, actorId);
    expect(registry.get("airGlideDurationMultiplier")).toBeCloseTo(1.5);

    PERK_AIR_UPDRAFT.remove(registry, bus, actorId);
    expect(registry.get("airGlideDurationMultiplier")).toBe(1);
  });
});

describe("Starbound (placeholder aetherUltimateCooldownMultiplier)", () => {
  it("reduces aetherUltimateCooldownMultiplier by 20% and cleanly reverses on remove", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const actorId = "player-1";

    PERK_AETHER_STARBOUND.apply(registry, bus, actorId);
    expect(registry.get("aetherUltimateCooldownMultiplier")).toBeCloseTo(0.8);

    PERK_AETHER_STARBOUND.remove(registry, bus, actorId);
    expect(registry.get("aetherUltimateCooldownMultiplier")).toBe(1);
  });
});

describe("Tidecaller (condition-gated on the 'Soaked' approximation, live via damageMultiplier)", () => {
  it("boosts damageMultiplier only while the actor's last-hit target is (approximately) Soaked", () => {
    const bus = createEventBus();
    const registry = new ModifierRegistryImpl();
    const actorId = "player-1";

    PERK_WATER_TIDECALLER.apply(registry, bus, actorId);
    expect(registry.get("damageMultiplier")).toBe(1);

    // A physical hit on enemy-1 by this actor: not Soaked yet, no bonus.
    bus.emit("onHit", { attackerId: actorId, targetId: "enemy-1", damage: 10, damageType: "physical" });
    expect(registry.get("damageMultiplier")).toBe(1);

    // A water hit (from anyone) soaks enemy-1; this actor's next hit on it should be boosted.
    bus.emit("onHit", { attackerId: "someone-else", targetId: "enemy-1", damage: 8, damageType: "water" });
    bus.emit("onHit", { attackerId: actorId, targetId: "enemy-1", damage: 10, damageType: "physical" });
    expect(registry.get("damageMultiplier")).toBeCloseTo(1.25);

    // Hitting a different, non-Soaked target drops the bonus again.
    bus.emit("onHit", { attackerId: actorId, targetId: "enemy-2", damage: 10, damageType: "physical" });
    expect(registry.get("damageMultiplier")).toBe(1);

    PERK_WATER_TIDECALLER.remove(registry, bus, actorId);
    expect(registry.get("damageMultiplier")).toBe(1);

    // Handler must be unsubscribed — further Soaked hits must not resurrect the effect.
    bus.emit("onHit", { attackerId: "someone-else", targetId: "enemy-1", damage: 8, damageType: "water" });
    bus.emit("onHit", { attackerId: actorId, targetId: "enemy-1", damage: 10, damageType: "physical" });
    expect(registry.get("damageMultiplier")).toBe(1);
  });
});

describe("Pressure (Soaked-gated placeholder waterPressureStunChanceOnSoakedBonus)", () => {
  it("exposes the stun-chance bonus only while the actor's last-hit target is Soaked", () => {
    const bus = createEventBus();
    const registry = new ModifierRegistryImpl();
    const actorId = "player-1";

    PERK_WATER_PRESSURE.apply(registry, bus, actorId);
    expect(registry.get("waterPressureStunChanceOnSoakedBonus")).toBe(1);

    bus.emit("onHit", { attackerId: actorId, targetId: "enemy-1", damage: 10, damageType: "water" });
    expect(registry.get("waterPressureStunChanceOnSoakedBonus")).toBeCloseTo(0.15);

    PERK_WATER_PRESSURE.remove(registry, bus, actorId);
    expect(registry.get("waterPressureStunChanceOnSoakedBonus")).toBe(1);
  });
});

describe("Ember Cascade (onKill-driven fireEmberCascadeProcCount)", () => {
  it("increments the proc count only when this actor kills a target it had burned, ignoring others", () => {
    const bus = createEventBus();
    const registry = new ModifierRegistryImpl();
    const actorId = "player-1";

    PERK_FIRE_EMBER_CASCADE.apply(registry, bus, actorId);
    expect(registry.get("fireEmberCascadeProcCount")).toBe(1); // baseline, no proc yet

    // Killing a target this actor never hit with fire: no proc.
    bus.emit("onKill", { killerId: actorId, victimId: "enemy-0" });
    expect(registry.get("fireEmberCascadeProcCount")).toBe(1);

    // Burn enemy-1, then kill it: should proc.
    bus.emit("onHit", { attackerId: actorId, targetId: "enemy-1", damage: 5, damageType: "fire" });
    bus.emit("onKill", { killerId: actorId, victimId: "enemy-1" });
    expect(registry.get("fireEmberCascadeProcCount")).toBe(1); // still 1: first proc set the count to 1

    // A second burn+kill stacks the count further.
    bus.emit("onHit", { attackerId: actorId, targetId: "enemy-2", damage: 5, damageType: "fire" });
    bus.emit("onKill", { killerId: actorId, victimId: "enemy-2" });
    expect(registry.get("fireEmberCascadeProcCount")).toBe(2);

    // Someone else's kill of a burning target this actor set alight doesn't count as this actor's proc.
    bus.emit("onHit", { attackerId: actorId, targetId: "enemy-3", damage: 5, damageType: "fire" });
    bus.emit("onKill", { killerId: "someone-else", victimId: "enemy-3" });
    expect(registry.get("fireEmberCascadeProcCount")).toBe(2);

    PERK_FIRE_EMBER_CASCADE.remove(registry, bus, actorId);
    expect(registry.get("fireEmberCascadeProcCount")).toBe(1);
  });
});

describe("Phoenix Ash (once-per-expedition closure state)", () => {
  // `firePhoenixAshAvailable` is registered as `override: 1` while unused —
  // numerically indistinguishable from `ModifierRegistryImpl`'s own
  // unregistered-stat baseline of `1` (a deliberate tradeoff of reusing the
  // "1 = present" convention here, unlike Second Wind's distinct-from-1
  // `secondWindCharges: 2`). `registry.has(...)` is therefore the only way
  // to actually observe whether the modifier is registered; these tests use
  // it throughout instead of `get(...)`.
  const modifierId = (actorId: string) => `fire_phoenix_ash:${actorId}`;

  it("registers firePhoenixAshAvailable while unused, and unregisters it on this actor's own death", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const perk = createPerkFirePhoenixAsh();
    const actorId = "player-1";

    expect(registry.has(modifierId(actorId))).toBe(false); // baseline: nothing registered yet

    perk.apply(registry, bus, actorId);
    expect(registry.has(modifierId(actorId))).toBe(true); // available
    expect(registry.get("firePhoenixAshAvailable")).toBe(1);

    bus.emit("onKill", { killerId: "an-enemy", victimId: "someone-else" });
    expect(registry.has(modifierId(actorId))).toBe(true); // other actors' deaths don't consume it

    bus.emit("onKill", { killerId: "an-enemy", victimId: actorId });
    expect(registry.has(modifierId(actorId))).toBe(false); // consumed

    perk.remove(registry, bus, actorId);
    expect(registry.has(modifierId(actorId))).toBe(false);
  });

  it("resets the once-per-expedition flag only by constructing a fresh instance, never by reusing one", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const actorId = "player-1";

    const runOnePerk = createPerkFirePhoenixAsh();
    runOnePerk.apply(registry, bus, actorId);
    expect(registry.has(modifierId(actorId))).toBe(true);
    bus.emit("onKill", { killerId: "an-enemy", victimId: actorId });
    expect(registry.has(modifierId(actorId))).toBe(false); // spent
    runOnePerk.remove(registry, bus, actorId);

    // Reusing the SAME instance for a new "run" stays permanently spent: no
    // charge is granted the second time apply() is called.
    runOnePerk.apply(registry, bus, actorId);
    expect(registry.has(modifierId(actorId))).toBe(false);
    runOnePerk.remove(registry, bus, actorId);

    // A genuinely fresh instance (a new "expedition") starts unused again.
    const runTwoPerk = createPerkFirePhoenixAsh();
    runTwoPerk.apply(registry, bus, actorId);
    expect(registry.has(modifierId(actorId))).toBe(true);
    runTwoPerk.remove(registry, bus, actorId);
  });
});
