import { createEventBus, FORM_IDS, ModifierRegistryImpl } from "@pithos/sim";
import { describe, expect, it } from "vitest";

import {
  FORM_PERKS,
  FORM_PERKS_BY_FORM,
  PERK_GAS_FEATHERWEIGHT,
  PERK_LIQUID_RESERVOIR,
  PERK_PLASMA_ARC_REACTOR,
  PERK_PLASMA_UNSTABLE_FORM,
  PERK_SOLID_UNMOVABLE,
} from "./forms.js";

describe("FORM_PERKS roster shape", () => {
  it("has exactly 16 perks", () => {
    expect(FORM_PERKS).toHaveLength(16);
  });

  it("has exactly one entry per FormId in FORM_PERKS_BY_FORM, 4 perks each", () => {
    expect(Object.keys(FORM_PERKS_BY_FORM)).toHaveLength(FORM_IDS.length);
    for (const formId of FORM_IDS) {
      expect(FORM_PERKS_BY_FORM[formId]).toHaveLength(4);
    }
  });

  it("FORM_PERKS is exactly the concatenation of FORM_PERKS_BY_FORM's groups", () => {
    const fromGroups = FORM_IDS.flatMap((formId) => FORM_PERKS_BY_FORM[formId]);
    expect(FORM_PERKS).toEqual(fromGroups);
  });

  it("every perk is tier 'form', has a non-empty displayName/description, and a unique id", () => {
    const ids = new Set<string>();
    for (const perk of FORM_PERKS) {
      expect(perk.tier).toBe("form");
      expect(perk.displayName.length).toBeGreaterThan(0);
      expect(perk.description.length).toBeGreaterThan(0);
      expect(ids.has(perk.id)).toBe(false);
      ids.add(perk.id);
    }
    expect(ids.size).toBe(16);
  });
});

describe("PERK_SOLID_UNMOVABLE — condition-gated on Solid, via a full apply/fire/remove cycle", () => {
  it("grants full knockback immunity only while the actor is in Solid, and only for that actor", () => {
    const bus = createEventBus();
    const registryA = new ModifierRegistryImpl();
    const registryB = new ModifierRegistryImpl();

    PERK_SOLID_UNMOVABLE.apply(registryA, bus, "player-a");
    PERK_SOLID_UNMOVABLE.apply(registryB, bus, "player-b");

    // Baseline before any Form swap: identity value (1) for both actors.
    expect(registryA.get("knockbackMultiplier")).toBe(1);
    expect(registryB.get("knockbackMultiplier")).toBe(1);

    bus.emit("onFormSwap", { actorId: "player-a", fromForm: "gas", toForm: "solid" });
    expect(registryA.get("knockbackMultiplier")).toBe(0);
    expect(registryB.get("knockbackMultiplier")).toBe(1); // player-b never swapped

    bus.emit("onFormSwap", { actorId: "player-a", fromForm: "solid", toForm: "liquid" });
    expect(registryA.get("knockbackMultiplier")).toBe(1); // left Solid, immunity gone

    PERK_SOLID_UNMOVABLE.remove(registryA, bus, "player-a");
    PERK_SOLID_UNMOVABLE.remove(registryB, bus, "player-b");
  });

  it("fully reverses apply() on remove(): unregisters the modifier and unsubscribes onFormSwap", () => {
    const bus = createEventBus();
    const registry = new ModifierRegistryImpl();

    PERK_SOLID_UNMOVABLE.apply(registry, bus, "player-1");
    bus.emit("onFormSwap", { actorId: "player-1", fromForm: "gas", toForm: "solid" });
    expect(registry.get("knockbackMultiplier")).toBe(0);

    PERK_SOLID_UNMOVABLE.remove(registry, bus, "player-1");
    expect(registry.get("knockbackMultiplier")).toBe(1);

    // Handler must be unsubscribed — further Form swaps must not resurrect the effect.
    bus.emit("onFormSwap", { actorId: "player-1", fromForm: "liquid", toForm: "solid" });
    expect(registry.get("knockbackMultiplier")).toBe(1);
  });
});

describe("PERK_LIQUID_RESERVOIR — condition-gated bonus on the existing multiplier convention", () => {
  it("adds +25% max Flux only while in Liquid", () => {
    const bus = createEventBus();
    const registry = new ModifierRegistryImpl();

    PERK_LIQUID_RESERVOIR.apply(registry, bus, "player-1");
    expect(registry.get("maxFluxMultiplier")).toBe(1);

    bus.emit("onFormSwap", { actorId: "player-1", fromForm: "solid", toForm: "liquid" });
    expect(registry.get("maxFluxMultiplier")).toBeCloseTo(1.25);

    bus.emit("onFormSwap", { actorId: "player-1", fromForm: "liquid", toForm: "gas" });
    expect(registry.get("maxFluxMultiplier")).toBe(1);

    PERK_LIQUID_RESERVOIR.remove(registry, bus, "player-1");
    expect(registry.get("maxFluxMultiplier")).toBe(1);
  });
});

describe("PERK_GAS_FEATHERWEIGHT — condition-gated dash-distance bonus", () => {
  it("adds +25% dash distance only while in Gas, and cleans up on remove", () => {
    const bus = createEventBus();
    const registry = new ModifierRegistryImpl();

    PERK_GAS_FEATHERWEIGHT.apply(registry, bus, "player-1");
    expect(registry.get("dashDistanceMultiplier")).toBe(1);

    bus.emit("onFormSwap", { actorId: "player-1", fromForm: "solid", toForm: "gas" });
    expect(registry.get("dashDistanceMultiplier")).toBeCloseTo(1.25);

    PERK_GAS_FEATHERWEIGHT.remove(registry, bus, "player-1");
    expect(registry.get("dashDistanceMultiplier")).toBe(1);

    // Unsubscribed — a Form swap after remove() must not re-trigger the bonus.
    bus.emit("onFormSwap", { actorId: "player-1", fromForm: "liquid", toForm: "gas" });
    expect(registry.get("dashDistanceMultiplier")).toBe(1);
  });
});

describe("PERK_PLASMA_ARC_REACTOR — onKill-triggered accumulator, gated on being in Plasma", () => {
  it("accumulates a pending Flux refund only for the owning actor's kills while in Plasma", () => {
    const bus = createEventBus();
    const registry = new ModifierRegistryImpl();

    PERK_PLASMA_ARC_REACTOR.apply(registry, bus, "player-1");
    expect(registry.get("pendingPlasmaFluxRefund")).toBe(1); // baseline — nothing registered yet

    // Kill while NOT in Plasma: no refund accrues.
    bus.emit("onKill", { killerId: "player-1", victimId: "enemy-0" });
    expect(registry.get("pendingPlasmaFluxRefund")).toBe(1);

    bus.emit("onFormSwap", { actorId: "player-1", fromForm: "gas", toForm: "plasma" });

    // Someone else's kill: ignored.
    bus.emit("onKill", { killerId: "someone-else", victimId: "enemy-1" });
    expect(registry.get("pendingPlasmaFluxRefund")).toBe(1);

    bus.emit("onKill", { killerId: "player-1", victimId: "enemy-2" });
    expect(registry.get("pendingPlasmaFluxRefund")).toBe(15);

    bus.emit("onKill", { killerId: "player-1", victimId: "enemy-3" });
    expect(registry.get("pendingPlasmaFluxRefund")).toBe(30); // accumulates across kills

    PERK_PLASMA_ARC_REACTOR.remove(registry, bus, "player-1");
    expect(registry.get("pendingPlasmaFluxRefund")).toBe(1); // modifier unregistered, back to baseline

    // Unsubscribed — further kills must not resurrect the accumulator.
    bus.emit("onKill", { killerId: "player-1", victimId: "enemy-4" });
    expect(registry.get("pendingPlasmaFluxRefund")).toBe(1);
  });
});

describe("PERK_PLASMA_UNSTABLE_FORM — the one Form Perk that's fully live today via damageMultiplier", () => {
  it("boosts damageMultiplier and damageTakenMultiplier only while in Plasma", () => {
    const bus = createEventBus();
    const registry = new ModifierRegistryImpl();

    PERK_PLASMA_UNSTABLE_FORM.apply(registry, bus, "player-1");
    expect(registry.get("damageMultiplier")).toBe(1);
    expect(registry.get("damageTakenMultiplier")).toBe(1);

    bus.emit("onFormSwap", { actorId: "player-1", fromForm: "solid", toForm: "plasma" });
    expect(registry.get("damageMultiplier")).toBeCloseTo(1.25);
    expect(registry.get("damageTakenMultiplier")).toBeCloseTo(1.2);

    PERK_PLASMA_UNSTABLE_FORM.remove(registry, bus, "player-1");
    expect(registry.get("damageMultiplier")).toBe(1);
    expect(registry.get("damageTakenMultiplier")).toBe(1);
  });
});
