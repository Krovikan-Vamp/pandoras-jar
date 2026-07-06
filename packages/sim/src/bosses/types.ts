import type { AttackTimeline } from "../combat/types.js";

/**
 * Boss AI contracts (TECHNICAL_SPEC.md §3 "Boss AI"). This file defines the
 * data shape a boss is *authored* against — it is the engine the six Spites
 * (GDD.md §11) will later be built on top of, not a boss itself.
 *
 * The load-bearing constraint from the spec: "Boss attacks share the exact
 * same `AttackTimeline` data structure and executor as player attacks — a
 * boss 'move' is authored just like a player attack (telegraph → windup →
 * active hitbox → recovery), so the hitbox/timing system only needs to
 * exist once." Hence `AttackPattern.timeline` is a plain `AttackTimeline`
 * imported from `combat/types.ts`, not a boss-specific reinvention.
 */

/** Bosses define their own phase ids (e.g. "phase1" | "phase2" | "enrage") — kept as a plain string rather than a shared union so each boss's data file stays self-contained. */
export type BossPhaseId = string;

/**
 * Abstract decision context a `BossController` reasons over. Deliberately
 * ignorant of Rapier/Three.js/rendering — `packages/sim` has zero DOM/engine
 * deps (TECHNICAL_SPEC.md §2), so anything physics- or render-derived (e.g.
 * `distanceToPlayer`) must already be resolved into a plain number by the
 * caller (the future `apps/game`/`packages/render` integration layer)
 * before being handed in here.
 */
export interface BossDecisionContext {
  /** 0..1, current HP / max HP. */
  currentHealthFraction: number;
  distanceToPlayer: number;
  /** Seconds since the fight started — available to any pattern/condition that wants it (e.g. a one-time opener). */
  elapsedSeconds: number;
}

/**
 * One selectable boss "move." `timeline` is authored exactly like a player
 * attack (see module doc). `weight`/`cooldownSeconds`/`condition` are the
 * knobs `BossController.selectNextAttack` uses to turn a phase's pattern
 * list into a single choice each time the boss needs a new move.
 */
export interface AttackPattern {
  id: string;
  /** Same shape player attacks use — see "../combat/types.js". */
  timeline: AttackTimeline;
  /** Selection weight within the current phase; higher = more likely. Must be > 0 to ever be selected. */
  weight: number;
  /** Minimum seconds since this pattern last fired before it can be selected again. */
  cooldownSeconds: number;
  /**
   * Optional gating predicate, e.g. "only usable within melee range of the
   * player." Kept as a plain predicate over `BossDecisionContext` (rather
   * than, say, a query against a physics world) since this package doesn't
   * know about Rapier/physics — the caller resolves whatever real-world
   * fact the condition needs down into the context fields first.
   */
  condition?: (ctx: BossDecisionContext) => boolean;
}

/**
 * A boss's behavior while its HP sits at/below `hpThreshold`. Phases should
 * be defined in descending order of `hpThreshold` within `BossDefinition.phases`
 * — see `BossController`'s phase-resolution doc for exactly how ties/order matter.
 */
export interface BossPhase {
  id: BossPhaseId;
  /** Fraction of max HP (0..1) at/below which this phase becomes active. */
  hpThreshold: number;
  attackPatterns: AttackPattern[];
}

/**
 * The static, content-authored definition of one boss. `BossController`
 * wraps an instance of this with the mutable runtime state (current HP,
 * current phase, cooldown timers).
 */
export interface BossDefinition {
  id: string;
  displayName: string;
  /** e.g. "Ponos, Spite of Toil" — GDD.md §11. The Spites are written as tragic/sympathetic, not villainous; a future UI boss-intro screen renders this. */
  epithet: string;
  /** 1-2 sentence tragic characterization (GDD.md §2: "sympathetic personification just doing what they were freed to do"). */
  loreDescription: string;
  maxHealth: number;
  /** Must include exactly one phase with `hpThreshold: 1` — the starting phase, active at full HP. */
  phases: BossPhase[];
}
