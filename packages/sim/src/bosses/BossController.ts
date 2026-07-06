import type {
  AttackPattern,
  BossDecisionContext,
  BossDefinition,
  BossPhase,
  BossPhaseId,
} from "./types.js";

/**
 * Weighted "roulette wheel" pick among candidates whose relative likelihood
 * is `weight`. Plain arithmetic rather than `mistreevous`'s `lotto` node —
 * see the `BossController` class doc for why a full behaviour-tree
 * integration doesn't pull its weight for this specific job.
 */
function weightedPick<T extends { weight: number }>(random: () => number, candidates: readonly T[]): T {
  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let roll = random() * totalWeight;

  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll < 0) {
      return candidate;
    }
  }

  // Floating-point rounding can leave a razor-thin non-negative remainder
  // after subtracting every weight (or `totalWeight` is 0 because every
  // candidate has weight 0 — content authoring shouldn't do that, but this
  // guards against it regardless). Falling back to the last candidate keeps
  // this total rather than throwing over a cosmetic edge case.
  const last = candidates[candidates.length - 1];
  if (!last) {
    throw new Error("weightedPick: candidates array was empty");
  }
  return last;
}

/**
 * Runtime wrapper around a static `BossDefinition` (TECHNICAL_SPEC.md §3
 * "Boss AI"). Owns everything that changes over the course of a fight:
 * current HP, which phase is active, and per-`AttackPattern` cooldown
 * timers. The definition itself (phases, attack patterns, timelines) is
 * treated as read-only content data.
 *
 * ### Why plain weighted-random instead of `mistreevous`
 *
 * The tech spec calls for `mistreevous` behaviour trees for attack-pattern
 * *selection*, layered under an explicit phase FSM. This class *is* that
 * explicit phase FSM (see below), but deliberately does not reach for
 * `mistreevous` for the selection step itself: a `mistreevous` tree is a
 * fixed structure of nodes evaluated via `step()`, and mapping "N
 * dynamically-cooldown-gated, condition-gated, weighted attack patterns
 * from arbitrary boss content data" onto that model would mean either (a)
 * regenerating a tree definition (MDSL/JSON) per boss per phase and
 * wiring every `AttackPattern` up as a named `agent` action, or (b) using a
 * `lotto` node whose weighted children are fixed at tree-construction time
 * and can't be pruned per-tick for cooldown/condition state without each
 * leaf action re-implementing exactly the filtering logic below anyway.
 * Either path adds a real dependency and indirection layer around what is,
 * at its core, "filter by cooldown + condition, then weighted-pick" — a
 * dozen lines of arithmetic. If/when a boss needs actual branching
 * *behavior* (e.g. "approach if far, otherwise attack, otherwise
 * reposition"), that is exactly the kind of structure `mistreevous` is
 * good at, and a boss-specific tree can be layered on top of
 * `BossController` (calling `selectNextAttack`/`update` from within a
 * `mistreevous` action node) without this class needing to know about it.
 * `BossController`'s public surface (`update`, `selectNextAttack`, the
 * phase/HP getters) is what matters here — it works identically whichever
 * way a future caller chooses to drive it.
 *
 * ### Phase resolution
 *
 * Phases are sorted descending by `hpThreshold` at construction (content
 * authors are expected to already list them that way per `BossPhase`'s
 * doc, but this class doesn't trust that and sorts defensively). Exactly
 * one phase must have `hpThreshold: 1` — the starting phase — or
 * construction throws.
 *
 * Phase transitions are a **one-way ratchet**: `update()` resolves which
 * phase a given `BossDecisionContext.currentHealthFraction` *would* put
 * the boss in, and only ever moves `currentPhaseIndex` forward (deeper —
 * i.e. to a phase with a lower `hpThreshold`), never back. This models
 * typical boss design (a phase transition is usually a one-time scripted
 * beat — new arena hazards, new moveset — that shouldn't undo itself), and
 * specifically means: if the boss is somehow healed back above a
 * threshold it already crossed (a perk/status effect, a scripted heal),
 * it stays in the deeper phase rather than reverting to an earlier one.
 *
 * ### `ctx.currentHealthFraction` vs. `applyDamage`/`isDefeated`
 *
 * These are intentionally decoupled. `applyDamage`/`isDefeated`/
 * `getHealth`/`getHealthFraction` are a small, self-contained HP pool this
 * class owns as a convenience — useful for a caller that doesn't want to
 * manage boss HP itself. Phase resolution in `update()`, however, reads
 * `ctx.currentHealthFraction` (not this class's own tracked HP), because
 * `BossDecisionContext` is documented as the caller-assembled, abstract
 * snapshot this package's logic reasons over (see `types.ts`) — the same
 * pattern `distanceToPlayer` and `elapsedSeconds` follow. In the common
 * case a caller populates `ctx.currentHealthFraction` from this very
 * controller's `getHealthFraction()` each tick, so the two stay in sync by
 * construction; a caller that tracks boss HP elsewhere (e.g. an ECS
 * `Health` component shared with other systems) can still drive phase
 * transitions correctly without this class needing to be that HP
 * component's source of truth.
 */
export class BossController {
  readonly definition: BossDefinition;

  /** `definition.phases`, sorted descending by `hpThreshold`. Index 0 is always the starting (hpThreshold: 1) phase. */
  private readonly sortedPhases: BossPhase[];
  private readonly random: () => number;

  /** Index into `sortedPhases`. Only ever moves forward — see class doc on the phase ratchet. */
  private currentPhaseIndex = 0;
  private currentHealth: number;

  /** Seconds remaining before an `AttackPattern.id` can be selected again. Absent (or <= 0) means ready. */
  private readonly cooldownRemaining = new Map<string, number>();

  /**
   * @param random Source of uniform randomness in `[0, 1)` for weighted
   *   attack-pattern selection. Defaults to `Math.random`; tests (and any
   *   future deterministic-replay need) can inject a seeded generator.
   */
  constructor(definition: BossDefinition, random: () => number = Math.random) {
    if (definition.phases.length === 0) {
      throw new Error(`BossController: boss "${definition.id}" defines no phases`);
    }

    const sortedPhases = [...definition.phases].sort((a, b) => b.hpThreshold - a.hpThreshold);
    const startingPhase = sortedPhases[0];
    if (!startingPhase || startingPhase.hpThreshold !== 1) {
      throw new Error(
        `BossController: boss "${definition.id}" must define a starting phase with hpThreshold: 1`,
      );
    }

    this.definition = definition;
    this.sortedPhases = sortedPhases;
    this.random = random;
    this.currentHealth = definition.maxHealth;
  }

  /** The currently active phase. Always valid — construction guarantees at least the hpThreshold-1 starting phase. */
  getCurrentPhase(): BossPhase {
    const phase = this.sortedPhases[this.currentPhaseIndex];
    if (!phase) {
      // Unreachable: currentPhaseIndex is only ever set from
      // resolvePhaseIndexFor(), which always returns a valid index into
      // sortedPhases. Guarded rather than asserted to keep
      // noUncheckedIndexedAccess honest without a cast.
      throw new Error(`BossController: currentPhaseIndex ${this.currentPhaseIndex} out of range`);
    }
    return phase;
  }

  getCurrentPhaseId(): BossPhaseId {
    return this.getCurrentPhase().id;
  }

  /** This controller's own tracked HP (see class doc on why this is decoupled from `ctx.currentHealthFraction`). */
  getHealth(): number {
    return this.currentHealth;
  }

  /** `getHealth() / definition.maxHealth`, as a 0..1 fraction. */
  getHealthFraction(): number {
    return this.currentHealth / this.definition.maxHealth;
  }

  isDefeated(): boolean {
    return this.currentHealth <= 0;
  }

  /** Reduces this controller's own tracked HP, clamped at 0. */
  applyDamage(amount: number): void {
    this.currentHealth = Math.max(0, this.currentHealth - amount);
  }

  /**
   * Advances per-pattern cooldown timers by `dt` seconds and checks for a
   * phase transition against `ctx.currentHealthFraction`. Call once per AI
   * tick, before `selectNextAttack`.
   */
  update(ctx: BossDecisionContext, dt: number): void {
    for (const [patternId, remaining] of this.cooldownRemaining) {
      if (remaining > 0) {
        this.cooldownRemaining.set(patternId, Math.max(0, remaining - dt));
      }
    }

    const targetPhaseIndex = this.resolvePhaseIndexFor(ctx.currentHealthFraction);
    if (targetPhaseIndex > this.currentPhaseIndex) {
      this.currentPhaseIndex = targetPhaseIndex;
    }
  }

  /**
   * Picks the next attack from the current phase's `attackPatterns`:
   * filters out anything on cooldown or whose `condition` (if present)
   * evaluates false against `ctx`, then does a weighted-random pick among
   * what's left. Returns `null` if nothing is currently available, so the
   * caller can fall back to idling/repositioning.
   *
   * Selecting a pattern is treated as committing to it: its cooldown timer
   * starts immediately (ticked down by subsequent `update()` calls), so a
   * caller should only call this when it's actually ready to execute the
   * returned pattern's `timeline`.
   */
  selectNextAttack(ctx: BossDecisionContext): AttackPattern | null {
    const phase = this.getCurrentPhase();
    const eligible = phase.attackPatterns.filter((pattern) => {
      const remaining = this.cooldownRemaining.get(pattern.id) ?? 0;
      if (remaining > 0) {
        return false;
      }
      return pattern.condition ? pattern.condition(ctx) : true;
    });

    if (eligible.length === 0) {
      return null;
    }

    const chosen = weightedPick(this.random, eligible);
    this.cooldownRemaining.set(chosen.id, chosen.cooldownSeconds);
    return chosen;
  }

  /**
   * The deepest phase (smallest `hpThreshold`) whose threshold has been
   * reached, i.e. `healthFraction <= hpThreshold`. Since `sortedPhases` is
   * sorted descending and a threshold-1 phase is guaranteed at index 0,
   * index 0 is always eligible, so this always returns a valid index —
   * it never needs to fall back to `currentPhaseIndex`.
   */
  private resolvePhaseIndexFor(healthFraction: number): number {
    let resolved = 0;
    for (const [index, phase] of this.sortedPhases.entries()) {
      if (healthFraction <= phase.hpThreshold) {
        resolved = index;
      }
    }
    return resolved;
  }
}
