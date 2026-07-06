import { createEventBus, ModifierRegistryImpl } from "@pithos/sim";
import { describe, expect, it } from "vitest";

import { createPerkHopefulEmber, PERK_GLASS_CANNON, PERK_TWIN_CASTING, RARE_PERKS } from "./rare.js";

describe("RARE_PERKS roster", () => {
  it("has exactly 6 perks, all tagged tier 'rare', with unique ids", () => {
    expect(RARE_PERKS).toHaveLength(6);
    for (const perk of RARE_PERKS) {
      expect(perk.tier).toBe("rare");
    }
    expect(new Set(RARE_PERKS.map((perk) => perk.id)).size).toBe(RARE_PERKS.length);
  });
});

describe("Glass Cannon (damageMultiplier fully expressible; maxHealthMultiplier a documented placeholder)", () => {
  it("applies both the damage buff and the max-HP penalty, and cleanly reverses both on remove", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const actorId = "player-1";

    expect(registry.get("damageMultiplier")).toBe(1);
    expect(registry.get("maxHealthMultiplier")).toBe(1);

    PERK_GLASS_CANNON.apply(registry, bus, actorId);
    expect(registry.get("damageMultiplier")).toBeCloseTo(1.5);
    expect(registry.get("maxHealthMultiplier")).toBeCloseTo(0.7);

    PERK_GLASS_CANNON.remove(registry, bus, actorId);
    expect(registry.get("damageMultiplier")).toBe(1);
    expect(registry.get("maxHealthMultiplier")).toBe(1);
  });
});

describe("Twin Casting (placeholder tertiaryReactionTriggerCount)", () => {
  it("overrides the trigger count to 2, distinct from the un-registered baseline of 1", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const actorId = "player-1";

    expect(registry.get("tertiaryReactionTriggerCount")).toBe(1);

    PERK_TWIN_CASTING.apply(registry, bus, actorId);
    expect(registry.get("tertiaryReactionTriggerCount")).toBe(2);

    PERK_TWIN_CASTING.remove(registry, bus, actorId);
    expect(registry.get("tertiaryReactionTriggerCount")).toBe(1);
  });
});

describe("Hopeful Ember (onKill-driven, victimId-naming-convention placeholder for 'lieutenant')", () => {
  it("stacks a permanent damage bonus only for kills whose victimId marks them as a lieutenant", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const perk = createPerkHopefulEmber();
    const actorId = "player-1";

    perk.apply(registry, bus, actorId);
    expect(registry.get("damageMultiplier")).toBe(1);

    bus.emit("onKill", { killerId: actorId, victimId: "trash-mob-3" });
    expect(registry.get("damageMultiplier")).toBe(1); // not a lieutenant kill

    bus.emit("onKill", { killerId: "someone-else", victimId: "spite-of-ash-lieutenant-1" });
    expect(registry.get("damageMultiplier")).toBe(1); // lieutenant, but not killed by this actor

    bus.emit("onKill", { killerId: actorId, victimId: "spite-of-ash-lieutenant-1" });
    expect(registry.get("damageMultiplier")).toBeCloseTo(1.05);

    bus.emit("onKill", { killerId: actorId, victimId: "spite-of-glass-lieutenant-2" });
    expect(registry.get("damageMultiplier")).toBeCloseTo(1.1);

    perk.remove(registry, bus, actorId);
    expect(registry.get("damageMultiplier")).toBe(1);

    // Handler must be unsubscribed — further qualifying kills must not re-trigger the buff.
    bus.emit("onKill", { killerId: actorId, victimId: "spite-of-embers-lieutenant-3" });
    expect(registry.get("damageMultiplier")).toBe(1);
  });
});
