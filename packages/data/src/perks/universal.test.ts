import { createEventBus, ModifierRegistryImpl } from "@pithos/sim";
import { describe, expect, it } from "vitest";

import {
  createPerkAdrenaline,
  createPerkSecondWind,
  PERK_OVERCHARGE,
  PERK_QUICK_FINGERS,
  UNIVERSAL_PERKS,
} from "./universal.js";

describe("UNIVERSAL_PERKS roster", () => {
  it("has exactly 8 perks, all tagged tier 'universal', with unique ids", () => {
    expect(UNIVERSAL_PERKS).toHaveLength(8);
    for (const perk of UNIVERSAL_PERKS) {
      expect(perk.tier).toBe("universal");
    }
    expect(new Set(UNIVERSAL_PERKS.map((perk) => perk.id)).size).toBe(UNIVERSAL_PERKS.length);
  });
});

describe("Overcharge (fully expressible today via chargeRateMultiplier)", () => {
  it("boosts chargeRateMultiplier by 25% and cleanly reverses on remove", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const actorId = "player-1";

    expect(registry.get("chargeRateMultiplier")).toBe(1);

    PERK_OVERCHARGE.apply(registry, bus, actorId);
    expect(registry.get("chargeRateMultiplier")).toBeCloseTo(1.25);

    PERK_OVERCHARGE.remove(registry, bus, actorId);
    expect(registry.get("chargeRateMultiplier")).toBe(1);
  });
});

describe("Quick Fingers (placeholder fluxSwapCostMultiplier)", () => {
  it("reduces fluxSwapCostMultiplier by 25% and cleanly reverses on remove", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const actorId = "player-1";

    PERK_QUICK_FINGERS.apply(registry, bus, actorId);
    expect(registry.get("fluxSwapCostMultiplier")).toBeCloseTo(0.75);

    PERK_QUICK_FINGERS.remove(registry, bus, actorId);
    expect(registry.get("fluxSwapCostMultiplier")).toBe(1);
  });
});

describe("Adrenaline (onKill-driven, stacking dashCooldownMultiplier)", () => {
  it("stacks a multiplicative dash-cooldown reduction per kill by the owning actor only", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const perk = createPerkAdrenaline();
    const actorId = "player-1";

    perk.apply(registry, bus, actorId);
    expect(registry.get("dashCooldownMultiplier")).toBe(1);

    bus.emit("onKill", { killerId: "someone-else", victimId: "enemy-0" });
    expect(registry.get("dashCooldownMultiplier")).toBe(1); // other actors' kills don't count

    bus.emit("onKill", { killerId: actorId, victimId: "enemy-1" });
    expect(registry.get("dashCooldownMultiplier")).toBeCloseTo(0.85);

    bus.emit("onKill", { killerId: actorId, victimId: "enemy-2" });
    expect(registry.get("dashCooldownMultiplier")).toBeCloseTo(0.85 * 0.85);

    perk.remove(registry, bus, actorId);
    expect(registry.get("dashCooldownMultiplier")).toBe(1);

    // Handler must be unsubscribed — further kills must not re-trigger the buff.
    bus.emit("onKill", { killerId: actorId, victimId: "enemy-3" });
    expect(registry.get("dashCooldownMultiplier")).toBe(1);
  });
});

describe("Second Wind (once-per-expedition closure state)", () => {
  it("exposes a distinct secondWindCharges value while unused, and consumes it on the first hit taken", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const perk = createPerkSecondWind();
    const actorId = "player-1";

    expect(registry.get("secondWindCharges")).toBe(1); // baseline: no modifier registered yet

    perk.apply(registry, bus, actorId);
    expect(registry.get("secondWindCharges")).toBe(2); // charge available, distinct from the 1-baseline

    bus.emit("onTakeDamage", { actorId: "someone-else", amount: 5, damageType: "physical" });
    expect(registry.get("secondWindCharges")).toBe(2); // other actors taking damage doesn't consume it

    bus.emit("onTakeDamage", { actorId, amount: 5, damageType: "physical" });
    expect(registry.get("secondWindCharges")).toBe(1); // consumed, reverted to baseline

    // Further hits this expedition must not do anything further (already consumed, once-per-expedition).
    bus.emit("onTakeDamage", { actorId, amount: 5, damageType: "physical" });
    expect(registry.get("secondWindCharges")).toBe(1);

    perk.remove(registry, bus, actorId);
    expect(registry.get("secondWindCharges")).toBe(1);
  });

  it("resets the once-per-expedition flag only by constructing a fresh instance, never by reusing one", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const actorId = "player-1";

    const runOnePerk = createPerkSecondWind();
    runOnePerk.apply(registry, bus, actorId);
    bus.emit("onTakeDamage", { actorId, amount: 5, damageType: "physical" });
    expect(registry.get("secondWindCharges")).toBe(1); // spent
    runOnePerk.remove(registry, bus, actorId);

    // Reusing the SAME instance for a new "run" stays permanently spent —
    // this is exactly why callers must build a fresh instance per
    // expedition. Re-applying a spent instance must NOT hand back a charge
    // it can no longer honor.
    runOnePerk.apply(registry, bus, actorId);
    expect(registry.get("secondWindCharges")).toBe(1);
    bus.emit("onTakeDamage", { actorId, amount: 5, damageType: "physical" });
    expect(registry.get("secondWindCharges")).toBe(1);
    runOnePerk.remove(registry, bus, actorId);

    // A genuinely fresh instance (a new "expedition") starts unused again.
    const runTwoPerk = createPerkSecondWind();
    runTwoPerk.apply(registry, bus, actorId);
    expect(registry.get("secondWindCharges")).toBe(2);
    runTwoPerk.remove(registry, bus, actorId);
  });
});
