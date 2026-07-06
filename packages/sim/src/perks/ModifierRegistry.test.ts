import { describe, expect, it } from "vitest";

import { ModifierRegistryImpl } from "./ModifierRegistry.js";

describe("ModifierRegistryImpl folding math", () => {
  it("defaults to the identity value (1) for a stat with no registered modifiers", () => {
    const registry = new ModifierRegistryImpl();
    expect(registry.get("damageMultiplier")).toBe(1);
  });

  it("folds add + mult modifiers as (additiveSum + 1) * multProduct", () => {
    const registry = new ModifierRegistryImpl();
    registry.register({ id: "a1", stat: "damageMultiplier", op: "add", value: 0.2 });
    registry.register({ id: "a2", stat: "damageMultiplier", op: "add", value: 0.1 });
    registry.register({ id: "m1", stat: "damageMultiplier", op: "mult", value: 1.5 });
    registry.register({ id: "m2", stat: "damageMultiplier", op: "mult", value: 2 });

    // (0.2 + 0.1 + 1) * (1.5 * 2) = 1.3 * 3 = 3.9
    expect(registry.get("damageMultiplier")).toBeCloseTo(3.9);
  });

  it("ignores add/mult modifiers for other stats", () => {
    const registry = new ModifierRegistryImpl();
    registry.register({ id: "a1", stat: "damageMultiplier", op: "add", value: 5 });
    expect(registry.get("cooldownMultiplier")).toBe(1);
  });

  it("only folds modifiers whose condition currently returns true", () => {
    const registry = new ModifierRegistryImpl();
    let active = false;
    registry.register({ id: "conditional", stat: "damageMultiplier", op: "add", value: 1, condition: () => active });

    expect(registry.get("damageMultiplier")).toBe(1);

    active = true;
    registry.register({ id: "noop", stat: "unrelatedStat", op: "add", value: 0 }); // force cache invalidation
    expect(registry.get("damageMultiplier")).toBe(2);
  });

  it("short-circuits to an override's value, ignoring add/mult modifiers on the same stat", () => {
    const registry = new ModifierRegistryImpl();
    registry.register({ id: "a1", stat: "damageMultiplier", op: "add", value: 10 });
    registry.register({ id: "m1", stat: "damageMultiplier", op: "mult", value: 10 });
    registry.register({ id: "o1", stat: "damageMultiplier", op: "override", value: 7 });

    expect(registry.get("damageMultiplier")).toBe(7);
  });

  it("resolves multiple active overrides to the last-registered one, falling back on unregister", () => {
    const registry = new ModifierRegistryImpl();
    registry.register({ id: "o1", stat: "damageMultiplier", op: "override", value: 5 });
    registry.register({ id: "o2", stat: "damageMultiplier", op: "override", value: 9 });
    expect(registry.get("damageMultiplier")).toBe(9);

    registry.unregister("o2");
    expect(registry.get("damageMultiplier")).toBe(5);

    registry.unregister("o1");
    expect(registry.get("damageMultiplier")).toBe(1);
  });
});

describe("ModifierRegistryImpl dirty-flag caching", () => {
  it("does not re-invoke a modifier's condition() across repeated get() calls until the registry is mutated", () => {
    const registry = new ModifierRegistryImpl();
    let conditionCalls = 0;
    registry.register({
      id: "tracked",
      stat: "damageMultiplier",
      op: "add",
      value: 0.5,
      condition: () => {
        conditionCalls += 1;
        return true;
      },
    });

    // First get() must compute (and therefore evaluate condition()) once.
    expect(registry.get("damageMultiplier")).toBe(1.5);
    expect(conditionCalls).toBe(1);

    // Repeated get()s for the same stat should hit the cache — no further
    // condition() evaluations — until something invalidates it.
    registry.get("damageMultiplier");
    registry.get("damageMultiplier");
    expect(conditionCalls).toBe(1);

    // Registering a new modifier invalidates the whole cache.
    registry.register({ id: "other", stat: "damageMultiplier", op: "add", value: 0 });
    expect(conditionCalls).toBe(1); // register() itself must not force a recompute
    registry.get("damageMultiplier");
    expect(conditionCalls).toBe(2);

    // Repeated reads again hit the cache.
    registry.get("damageMultiplier");
    registry.get("damageMultiplier");
    expect(conditionCalls).toBe(2);

    // unregister() also invalidates the cache.
    registry.unregister("other");
    registry.get("damageMultiplier");
    expect(conditionCalls).toBe(3);
  });

  it("does not treat unregistering a nonexistent id as a mutation (no cache invalidation)", () => {
    const registry = new ModifierRegistryImpl();
    let conditionCalls = 0;
    registry.register({
      id: "tracked",
      stat: "damageMultiplier",
      op: "add",
      value: 0,
      condition: () => {
        conditionCalls += 1;
        return true;
      },
    });

    registry.get("damageMultiplier");
    expect(conditionCalls).toBe(1);

    registry.unregister("does-not-exist");
    registry.get("damageMultiplier");
    expect(conditionCalls).toBe(1);
  });

  it("caches independently per stat", () => {
    const registry = new ModifierRegistryImpl();
    let damageCalls = 0;
    let cooldownCalls = 0;
    registry.register({
      id: "d",
      stat: "damageMultiplier",
      op: "add",
      value: 0,
      condition: () => {
        damageCalls += 1;
        return true;
      },
    });
    registry.register({
      id: "c",
      stat: "cooldownMultiplier",
      op: "add",
      value: 0,
      condition: () => {
        cooldownCalls += 1;
        return true;
      },
    });

    registry.get("damageMultiplier");
    registry.get("damageMultiplier");
    expect(damageCalls).toBe(1);
    expect(cooldownCalls).toBe(0);

    registry.get("cooldownMultiplier");
    registry.get("cooldownMultiplier");
    expect(cooldownCalls).toBe(1);
  });
});

describe("ModifierRegistryImpl.has", () => {
  it("reports whether an id is currently registered", () => {
    const registry = new ModifierRegistryImpl();
    expect(registry.has("x")).toBe(false);
    registry.register({ id: "x", stat: "damageMultiplier", op: "add", value: 1 });
    expect(registry.has("x")).toBe(true);
    registry.unregister("x");
    expect(registry.has("x")).toBe(false);
  });
});
