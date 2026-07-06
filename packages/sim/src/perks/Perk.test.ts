import { describe, expect, it } from "vitest";

import type { CombatEventMap } from "./EventBus.js";
import { createEventBus } from "./EventBus.js";
import { ModifierRegistryImpl } from "./ModifierRegistry.js";
import type { Perk } from "./Perk.js";

/**
 * Test fixture ONLY — not real perk content. Real perk data (~50+ perks per
 * GDD.md §6) is authored in a separate future pass against the `Perk`
 * interface this pipeline exercises here.
 *
 * Grants +50% damage after every 3rd *consecutive* kill by the perk's
 * owning actor. Demonstrates the intended pattern: `apply()` subscribes to
 * `onKill` filtered to this actor, and lazily registers a modifier when the
 * trigger condition is met; `remove()` unsubscribes and unregisters,
 * fully reversing `apply()`.
 */
function createTestFixtureTripleKillFrenzyPerk(): Perk {
  const streakByActor = new Map<string, number>();
  const killHandlerByActor = new Map<string, (event: CombatEventMap["onKill"]) => void>();
  const modifierId = (actorId: string) => `test-fixture.triple-kill-frenzy:${actorId}`;

  return {
    id: "test-fixture.triple-kill-frenzy",
    tier: "universal",
    displayName: "(test fixture) Triple Kill Frenzy",
    description: "Test fixture only, not real perk content — +50% damage after every 3rd consecutive kill.",
    apply(registry, bus, actorId) {
      streakByActor.set(actorId, 0);

      const handler = (event: CombatEventMap["onKill"]) => {
        if (event.killerId !== actorId) {
          return;
        }
        const streak = (streakByActor.get(actorId) ?? 0) + 1;
        if (streak >= 3) {
          registry.register({ id: modifierId(actorId), stat: "damageMultiplier", op: "mult", value: 1.5 });
          streakByActor.set(actorId, 0);
        } else {
          streakByActor.set(actorId, streak);
        }
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
      streakByActor.delete(actorId);
      registry.unregister(modifierId(actorId));
    },
  };
}

describe("Perk pipeline (test-fixture perk over EventBus + ModifierRegistryImpl)", () => {
  it("grants the buff only on the 3rd consecutive kill by the owning actor, ignoring other actors' kills", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const perk = createTestFixtureTripleKillFrenzyPerk();
    const actorId = "player-1";

    perk.apply(registry, bus, actorId);
    expect(registry.get("damageMultiplier")).toBe(1);

    bus.emit("onKill", { killerId: "someone-else", victimId: "enemy-0" });
    bus.emit("onKill", { killerId: actorId, victimId: "enemy-1" });
    bus.emit("onKill", { killerId: actorId, victimId: "enemy-2" });
    expect(registry.get("damageMultiplier")).toBe(1); // only 2 consecutive kills so far

    bus.emit("onKill", { killerId: actorId, victimId: "enemy-3" });
    expect(registry.get("damageMultiplier")).toBe(1.5); // 3rd consecutive kill trips the buff
  });

  it("fully reverses apply() on remove(): unregisters the modifier and unsubscribes the handler", () => {
    const registry = new ModifierRegistryImpl();
    const bus = createEventBus();
    const perk = createTestFixtureTripleKillFrenzyPerk();
    const actorId = "player-1";

    perk.apply(registry, bus, actorId);
    bus.emit("onKill", { killerId: actorId, victimId: "enemy-1" });
    bus.emit("onKill", { killerId: actorId, victimId: "enemy-2" });
    bus.emit("onKill", { killerId: actorId, victimId: "enemy-3" });
    expect(registry.get("damageMultiplier")).toBe(1.5);

    perk.remove(registry, bus, actorId);
    expect(registry.get("damageMultiplier")).toBe(1);

    // Handler must be unsubscribed — further kills must not re-trigger the buff.
    bus.emit("onKill", { killerId: actorId, victimId: "enemy-4" });
    bus.emit("onKill", { killerId: actorId, victimId: "enemy-5" });
    bus.emit("onKill", { killerId: actorId, victimId: "enemy-6" });
    expect(registry.get("damageMultiplier")).toBe(1);
  });

  it("tracks per-actor streaks independently when the same perk is applied to two actors sharing one event bus", () => {
    // Realistic topology: one shared combat event bus for the whole
    // encounter, but each actor owns its own stat registry — `actorId` is
    // what lets a single shared bus fan out to per-actor state correctly.
    const bus = createEventBus();
    const registry1 = new ModifierRegistryImpl();
    const registry2 = new ModifierRegistryImpl();
    const perk = createTestFixtureTripleKillFrenzyPerk();

    perk.apply(registry1, bus, "player-1");
    perk.apply(registry2, bus, "player-2");

    bus.emit("onKill", { killerId: "player-1", victimId: "enemy-1" });
    bus.emit("onKill", { killerId: "player-1", victimId: "enemy-2" });
    bus.emit("onKill", { killerId: "player-1", victimId: "enemy-3" });

    expect(registry1.get("damageMultiplier")).toBe(1.5);
    expect(registry2.get("damageMultiplier")).toBe(1); // player-2 never got a 3rd consecutive kill

    perk.remove(registry1, bus, "player-1");
    perk.remove(registry2, bus, "player-2");
  });
});
