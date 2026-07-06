/**
 * The `Perk` shape (TECHNICAL_SPEC.md §3): `Perk = { id, tier,
 * apply(character) }` where `apply` just registers modifiers/hooks —
 * adding perk #51 later is purely a new `Perk` value; it never requires a
 * change to `ModifierRegistry`, `EventBus`, or combat code.
 *
 * This file defines the *shape* only. Real perk content (~50+ perks across
 * Universal/Form/School/Rare tiers, per GDD.md §6) is authored in a later
 * pass as data against this interface — nothing here should be mistaken
 * for that content.
 */
import type { CombatEventBus } from "./EventBus.js";
import type { ModifierRegistryImpl } from "./ModifierRegistry.js";

export type PerkTier = "universal" | "form" | "school" | "rare";

/**
 * A perk's `apply`/`remove` pair is the entire integration surface with the
 * rest of the sim. `apply` runs once when the perk is picked (or re-applied
 * to a new actor); it may:
 *   - call `registry.register(modifier)` for any always-on stat change, and/or
 *   - call `bus.on(event, handler)` to react to combat events — e.g. an
 *     on-kill perk subscribes to `onKill`, filters `killerId === actorId`,
 *     and pushes a modifier (optionally time-limited via `Modifier.condition`)
 *     when it fires.
 *
 * `remove` must undo exactly what `apply` did: `registry.unregister(id)` for
 * every modifier id it registered (including ones registered lazily from
 * inside an event handler), and `bus.off(event, handler)` for every
 * subscription — using the *same handler reference* `apply` passed to `on`,
 * since `mitt` unsubscribes by reference equality. A `Perk` implementation
 * that registers state per-actor (e.g. a kill-streak counter) is
 * responsible for keeping that bookkeeping (typically a closure-scoped
 * `Map<actorId, ...>`) so `remove` can tear it down correctly; the `Perk`
 * value itself stays a plain, stateless descriptor from the outside.
 */
export interface Perk {
  id: string;
  tier: PerkTier;
  displayName: string;
  description: string;
  apply(registry: ModifierRegistryImpl, bus: CombatEventBus, actorId: string): void;
  remove(registry: ModifierRegistryImpl, bus: CombatEventBus, actorId: string): void;
}
