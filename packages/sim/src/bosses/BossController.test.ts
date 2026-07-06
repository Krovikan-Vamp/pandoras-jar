import { describe, expect, it } from "vitest";
import type { AttackTimeline } from "../combat/types.js";
import { BossController } from "./BossController.js";
import type { AttackPattern, BossDecisionContext, BossDefinition } from "./types.js";

/**
 * Small, self-contained deterministic PRNG (mulberry32), used only to make
 * the statistical weighted-selection test below reproducible rather than
 * relying on the ambient `Math.random`. Not shared with other packages on
 * purpose — this test file should stand alone.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Arbitrary, untuned melee timeline — only its shape (AttackTimeline) matters for these tests. */
const FIXTURE_TIMELINE: AttackTimeline = {
  windupSeconds: 0.3,
  activeSeconds: 0.2,
  recoverySeconds: 0.4,
  hitbox: { kind: "melee", range: 2, arcDegrees: 90 },
  baseDamage: 10,
};

function makePattern(overrides: Partial<AttackPattern> = {}): AttackPattern {
  return {
    id: "pattern",
    timeline: FIXTURE_TIMELINE,
    weight: 1,
    cooldownSeconds: 0,
    ...overrides,
  };
}

function makeContext(overrides: Partial<BossDecisionContext> = {}): BossDecisionContext {
  return {
    currentHealthFraction: 1,
    distanceToPlayer: 5,
    elapsedSeconds: 0,
    ...overrides,
  };
}

/**
 * Test fixture only — NOT one of the six Spites (see GDD.md §11 for the
 * real roster, authored in a later pass). Three phases purely to exercise
 * BossController's phase-resolution and pattern-selection machinery.
 */
function makeFixtureBoss(overrides: Partial<BossDefinition> = {}): BossDefinition {
  return {
    id: "test-fixture-boss",
    displayName: "Test Fixture Boss (not a real Spite)",
    maxHealth: 100,
    phases: [
      {
        id: "phase1",
        hpThreshold: 1,
        attackPatterns: [makePattern({ id: "p1-a" }), makePattern({ id: "p1-b" })],
      },
      {
        id: "phase2",
        hpThreshold: 0.5,
        attackPatterns: [makePattern({ id: "p2-a" }), makePattern({ id: "p2-b" })],
      },
      {
        id: "enrage",
        hpThreshold: 0.2,
        attackPatterns: [makePattern({ id: "enrage-a" })],
      },
    ],
    ...overrides,
  };
}

describe("BossController", () => {
  describe("construction", () => {
    it("throws if no phase declares hpThreshold: 1", () => {
      const boss = makeFixtureBoss({
        phases: [{ id: "only-phase", hpThreshold: 0.8, attackPatterns: [makePattern()] }],
      });
      expect(() => new BossController(boss)).toThrow();
    });

    it("throws if the boss defines no phases at all", () => {
      const boss = makeFixtureBoss({ phases: [] });
      expect(() => new BossController(boss)).toThrow();
    });
  });

  describe("phase transitions", () => {
    it("starts in the hpThreshold: 1 phase at full health", () => {
      const controller = new BossController(makeFixtureBoss());
      expect(controller.getCurrentPhaseId()).toBe("phase1");
    });

    it("stays in the starting phase while HP is above the next threshold", () => {
      const controller = new BossController(makeFixtureBoss());
      controller.update(makeContext({ currentHealthFraction: 0.51 }), 0);
      expect(controller.getCurrentPhaseId()).toBe("phase1");
    });

    it("transitions to the next phase exactly at its hpThreshold (boundary, inclusive)", () => {
      const controller = new BossController(makeFixtureBoss());
      controller.update(makeContext({ currentHealthFraction: 0.5 }), 0);
      expect(controller.getCurrentPhaseId()).toBe("phase2");
    });

    it("advances through multiple phases as HP keeps dropping", () => {
      const controller = new BossController(makeFixtureBoss());
      controller.update(makeContext({ currentHealthFraction: 0.5 }), 0);
      expect(controller.getCurrentPhaseId()).toBe("phase2");

      controller.update(makeContext({ currentHealthFraction: 0.2 }), 0);
      expect(controller.getCurrentPhaseId()).toBe("enrage");
    });

    it("jumps straight to the deepest eligible phase when HP crosses multiple thresholds in one update", () => {
      const controller = new BossController(makeFixtureBoss());
      controller.update(makeContext({ currentHealthFraction: 0.1 }), 0);
      expect(controller.getCurrentPhaseId()).toBe("enrage");
    });

    it("never reverts to a shallower phase if HP is restored above an already-crossed threshold", () => {
      const controller = new BossController(makeFixtureBoss());

      controller.update(makeContext({ currentHealthFraction: 0.4 }), 0);
      expect(controller.getCurrentPhaseId()).toBe("phase2");

      // Simulate a heal (or a stale/inconsistent ctx) bringing the fraction
      // back above phase2's threshold — must not un-trigger the transition.
      controller.update(makeContext({ currentHealthFraction: 0.95 }), 0);
      expect(controller.getCurrentPhaseId()).toBe("phase2");
    });
  });

  describe("cooldown gating", () => {
    it("puts a selected pattern on cooldown and excludes it from re-selection until enough time passes", () => {
      const boss = makeFixtureBoss({
        phases: [
          {
            id: "phase1",
            hpThreshold: 1,
            attackPatterns: [makePattern({ id: "only", cooldownSeconds: 2 })],
          },
        ],
      });
      const controller = new BossController(boss);
      const ctx = makeContext();

      expect(controller.selectNextAttack(ctx)?.id).toBe("only");

      // Immediately on cooldown — no time has passed.
      expect(controller.selectNextAttack(ctx)).toBeNull();

      // Not quite enough elapsed time yet.
      controller.update(ctx, 1.9);
      expect(controller.selectNextAttack(ctx)).toBeNull();

      // Crosses the cooldown threshold.
      controller.update(ctx, 0.2);
      expect(controller.selectNextAttack(ctx)?.id).toBe("only");
    });

    it("a pattern that has never fired is available immediately", () => {
      const boss = makeFixtureBoss({
        phases: [
          {
            id: "phase1",
            hpThreshold: 1,
            attackPatterns: [makePattern({ id: "only", cooldownSeconds: 999 })],
          },
        ],
      });
      const controller = new BossController(boss);
      expect(controller.selectNextAttack(makeContext())?.id).toBe("only");
    });
  });

  describe("condition gating", () => {
    it("excludes a pattern whose condition evaluates false", () => {
      const boss = makeFixtureBoss({
        phases: [
          {
            id: "phase1",
            hpThreshold: 1,
            attackPatterns: [makePattern({ id: "close-range", condition: (ctx) => ctx.distanceToPlayer < 3 })],
          },
        ],
      });
      const controller = new BossController(boss);

      expect(controller.selectNextAttack(makeContext({ distanceToPlayer: 10 }))).toBeNull();
      expect(controller.selectNextAttack(makeContext({ distanceToPlayer: 1 }))?.id).toBe("close-range");
    });
  });

  describe("selectNextAttack fallback", () => {
    it("returns null when every pattern in the current phase is on cooldown", () => {
      const boss = makeFixtureBoss({
        phases: [
          {
            id: "phase1",
            hpThreshold: 1,
            attackPatterns: [
              makePattern({ id: "a", cooldownSeconds: 5 }),
              makePattern({ id: "b", cooldownSeconds: 5 }),
            ],
          },
        ],
      });
      const controller = new BossController(boss);
      const ctx = makeContext();

      const first = controller.selectNextAttack(ctx);
      const second = controller.selectNextAttack(ctx);
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      // With "a" now on cooldown, "b" is the only remaining candidate.
      expect(second?.id).not.toBe(first?.id);

      expect(controller.selectNextAttack(ctx)).toBeNull();
    });

    it("returns null when a condition excludes the only pattern in the phase", () => {
      const boss = makeFixtureBoss({
        phases: [
          {
            id: "phase1",
            hpThreshold: 1,
            attackPatterns: [makePattern({ id: "only", condition: () => false })],
          },
        ],
      });
      const controller = new BossController(boss);
      expect(controller.selectNextAttack(makeContext())).toBeNull();
    });
  });

  describe("weighted selection", () => {
    it("statistically favors higher-weight patterns over many trials", () => {
      const boss = makeFixtureBoss({
        phases: [
          {
            id: "phase1",
            hpThreshold: 1,
            attackPatterns: [
              makePattern({ id: "common", weight: 9, cooldownSeconds: 0 }),
              makePattern({ id: "rare", weight: 1, cooldownSeconds: 0 }),
            ],
          },
        ],
      });

      const controller = new BossController(boss, mulberry32(1234));
      const ctx = makeContext();

      const counts: Record<string, number> = { common: 0, rare: 0 };
      const trials = 2000;
      for (let i = 0; i < trials; i++) {
        const picked = controller.selectNextAttack(ctx);
        if (picked) {
          counts[picked.id] = (counts[picked.id] ?? 0) + 1;
        }
      }

      const commonCount = counts.common ?? 0;
      const rareCount = counts.rare ?? 0;
      expect(commonCount + rareCount).toBe(trials);
      // Expected ratio is 9:1. Generous tolerance (favor by more than 3x)
      // keeps this from ever being a flaky exact-count assertion.
      expect(commonCount).toBeGreaterThan(rareCount * 3);
    });

    it("never selects a condition-excluded pattern even when it has a much higher weight", () => {
      const boss = makeFixtureBoss({
        phases: [
          {
            id: "phase1",
            hpThreshold: 1,
            attackPatterns: [
              makePattern({ id: "excluded", weight: 100, condition: () => false }),
              makePattern({ id: "allowed", weight: 1, cooldownSeconds: 0 }),
            ],
          },
        ],
      });

      const controller = new BossController(boss, mulberry32(42));
      const ctx = makeContext();

      for (let i = 0; i < 50; i++) {
        expect(controller.selectNextAttack(ctx)?.id).toBe("allowed");
      }
    });
  });
});
