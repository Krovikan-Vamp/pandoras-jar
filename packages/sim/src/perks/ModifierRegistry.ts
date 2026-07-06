/**
 * Concrete `ModifierRegistry` implementation (TECHNICAL_SPEC.md §3,
 * "Perk/modifier hook system"): "a `StatBlock`... is computed by folding
 * registered `Modifier { statKey, op, value, condition? }` objects."
 *
 * `ModifierRegistryImpl` satisfies (and widens) the minimal `ModifierRegistry`
 * contract from `./types.ts` that `combat/resolveAttack.ts` compiles
 * against — it adds `register`/`unregister`/`has`, which combat code never
 * needs and therefore never imports.
 */
import type { ModifierRegistry as ModifierRegistryContract, StatBlock, StatKey } from "./types.js";

export type ModifierOp = "add" | "mult" | "override";

export interface Modifier {
  id: string;
  stat: StatKey;
  op: ModifierOp;
  value: number;
  /** Optional gate re-evaluated on every fold — e.g. "only while actor is in Liquid Form", or a wall-clock expiry check for a temporary buff. Absent = always active. */
  condition?: () => boolean;
}

/**
 * Folding order (documented, not left to reader inference):
 *
 * 1. Gather every registered modifier for the requested `stat` whose
 *    `condition` (if any) currently returns `true`.
 * 2. If any of those are `"override"`, the registry short-circuits: the
 *    *last-registered* active override wins (insertion order, via `Map`
 *    iteration) and its `value` is returned directly. `add`/`mult`
 *    modifiers for that stat are ignored when an override is active.
 * 3. Otherwise, fold `"add"` modifiers into an additive sum (identity `0`)
 *    and `"mult"` modifiers into a product (identity `1`), then combine as
 *    `(additiveSum + 1) * multProduct`.
 *
 * This means `add` modifiers stack additively with each other (e.g. two
 * `+0.1` add modifiers combine to `+0.2` before multipliers apply), while
 * `mult` modifiers stack multiplicatively with each other and with the
 * additive total. A `mult` modifier's `value` is the literal factor to
 * multiply by (e.g. `1.5` for "+50%"), not a delta.
 *
 * Recompute is lazy and cached per-stat (dirty-flag basis per the spec:
 * "Recompute resolved stats on a dirty-flag basis... not every frame").
 * `register`/`unregister` invalidate the *entire* cache rather than
 * tracking which stats a given modifier touches — deliberately simple,
 * since perk (un)registration is rare (on pick / room clear / Form swap),
 * not a hot path.
 */
export class ModifierRegistryImpl implements ModifierRegistryContract, StatBlock {
  private readonly modifiers = new Map<string, Modifier>();
  private readonly cache = new Map<StatKey, number>();

  register(modifier: Modifier): void {
    this.modifiers.set(modifier.id, modifier);
    this.cache.clear();
  }

  unregister(id: string): void {
    if (this.modifiers.delete(id)) {
      this.cache.clear();
    }
  }

  has(id: string): boolean {
    return this.modifiers.has(id);
  }

  get(stat: StatKey): number {
    const cached = this.cache.get(stat);
    if (cached !== undefined) {
      return cached;
    }

    const value = this.fold(stat);
    this.cache.set(stat, value);
    return value;
  }

  private fold(stat: StatKey): number {
    const active: Modifier[] = [];
    for (const modifier of this.modifiers.values()) {
      if (modifier.stat === stat && (modifier.condition === undefined || modifier.condition())) {
        active.push(modifier);
      }
    }

    const overrides = active.filter((modifier) => modifier.op === "override");
    if (overrides.length > 0) {
      // Last-registered override wins — `active` preserves Map insertion order.
      return overrides[overrides.length - 1]!.value;
    }

    let additiveSum = 0;
    let multProduct = 1;
    for (const modifier of active) {
      if (modifier.op === "add") {
        additiveSum += modifier.value;
      } else if (modifier.op === "mult") {
        multProduct *= modifier.value;
      }
    }

    return (additiveSum + 1) * multProduct;
  }
}
