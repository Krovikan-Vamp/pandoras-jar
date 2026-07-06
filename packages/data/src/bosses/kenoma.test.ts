import type { AttackPattern, BossDefinition } from "@pithos/sim";
import { describe, expect, it } from "vitest";
import { BOSS_ALGEA } from "./algea.js";
import { BOSS_GERAS } from "./geras.js";
import { BOSS_KENOMA } from "./kenoma.js";
import { BOSS_LOIMOS } from "./loimos.js";
import { BOSS_PHTHONOS } from "./phthonos.js";
import { BOSS_PONOS } from "./ponos.js";

/**
 * Kenoma is authored as the capstone fight of the whole game (GDD.md §2,
 * §11) — these tests are the live enforcement of that claim against the
 * five wing bosses' actual data, not a snapshot of numbers picked once and
 * forgotten. If a sibling wing boss gets rebalanced upward later, this
 * suite fails until Kenoma is bumped to stay on top, rather than silently
 * drifting out of sync.
 */

const WING_BOSSES: readonly BossDefinition[] = [BOSS_PONOS, BOSS_LOIMOS, BOSS_ALGEA, BOSS_GERAS, BOSS_PHTHONOS];

function highestBaseDamage(boss: BossDefinition): number {
  const damages = boss.phases.flatMap((phase) => phase.attackPatterns.map((pattern) => pattern.timeline.baseDamage));
  return Math.max(...damages);
}

/** The phase active at the lowest HP — i.e. the fight's final/enrage phase. */
function finalPhase(boss: BossDefinition) {
  return boss.phases.reduce((lowest, phase) => (phase.hpThreshold < lowest.hpThreshold ? phase : lowest));
}

describe("BOSS_KENOMA", () => {
  it("defines exactly one starting phase at hpThreshold: 1", () => {
    const startingPhases = BOSS_KENOMA.phases.filter((phase) => phase.hpThreshold === 1);
    expect(startingPhases).toHaveLength(1);
  });

  it("has exactly 4 phases — one more than any wing boss — reflecting the capstone fight's complexity", () => {
    expect(BOSS_KENOMA.phases).toHaveLength(4);
    for (const wingBoss of WING_BOSSES) {
      expect(wingBoss.phases.length).toBeLessThan(BOSS_KENOMA.phases.length);
    }
  });

  it("has strictly more maxHealth than every wing boss", () => {
    const highestWingBossHealth = Math.max(...WING_BOSSES.map((boss) => boss.maxHealth));
    expect(BOSS_KENOMA.maxHealth).toBeGreaterThan(highestWingBossHealth);
  });

  it("its final phase's hardest attack exceeds every wing boss's hardest attack across all their phases", () => {
    const highestWingBossDamage = Math.max(...WING_BOSSES.map(highestBaseDamage));
    const kenomaFinalPhaseDamage = highestBaseDamage({ ...BOSS_KENOMA, phases: [finalPhase(BOSS_KENOMA)] });
    expect(kenomaFinalPhaseDamage).toBeGreaterThan(highestWingBossDamage);
  });

  it("every phase has between 3 and 5 attack patterns, all with positive weight/cooldown/damage", () => {
    for (const phase of BOSS_KENOMA.phases) {
      expect(phase.attackPatterns.length).toBeGreaterThanOrEqual(3);
      expect(phase.attackPatterns.length).toBeLessThanOrEqual(5);

      for (const pattern of phase.attackPatterns) {
        expect(pattern.weight).toBeGreaterThan(0);
        expect(pattern.cooldownSeconds).toBeGreaterThan(0);
        expect(pattern.timeline.baseDamage).toBeGreaterThan(0);
        expect(pattern.timeline.activeSeconds).toBeGreaterThan(0);
        expect(pattern.timeline.windupSeconds).toBeGreaterThanOrEqual(0);
        expect(pattern.timeline.recoverySeconds).toBeGreaterThan(0);
      }
    }
  });

  it("uses all four HitboxArchetype kinds across its full pattern set", () => {
    const allPatterns: AttackPattern[] = BOSS_KENOMA.phases.flatMap((phase) => phase.attackPatterns);
    const kinds = new Set(allPatterns.map((pattern) => pattern.timeline.hitbox.kind));
    expect(kinds).toEqual(new Set(["melee", "wave", "projectile", "beam"]));
  });

  it("gates more attack patterns on conditions than any single wing boss does, spanning range/HP/elapsed-time gates", () => {
    const allPatterns = BOSS_KENOMA.phases.flatMap((phase) => phase.attackPatterns);
    const gatedPatterns = allPatterns.filter((pattern) => pattern.condition !== undefined);

    const highestWingBossGatedCount = Math.max(
      ...WING_BOSSES.map(
        (boss) => boss.phases.flatMap((phase) => phase.attackPatterns).filter((pattern) => pattern.condition !== undefined).length,
      ),
    );
    expect(gatedPatterns.length).toBeGreaterThan(highestWingBossGatedCount);

    // Spot-check at least one of each gating flavor exists, using the same
    // BossDecisionContext shape BossController hands to `condition`.
    const rangeGated = gatedPatterns.some((pattern) => pattern.condition!({ currentHealthFraction: 1, distanceToPlayer: 1, elapsedSeconds: 0 }) !==
      pattern.condition!({ currentHealthFraction: 1, distanceToPlayer: 999, elapsedSeconds: 0 }));
    const hpGated = gatedPatterns.some((pattern) => pattern.condition!({ currentHealthFraction: 0.01, distanceToPlayer: 5, elapsedSeconds: 0 }) !==
      pattern.condition!({ currentHealthFraction: 1, distanceToPlayer: 5, elapsedSeconds: 0 }));
    const elapsedGated = gatedPatterns.some((pattern) => pattern.condition!({ currentHealthFraction: 1, distanceToPlayer: 5, elapsedSeconds: 0 }) !==
      pattern.condition!({ currentHealthFraction: 1, distanceToPlayer: 5, elapsedSeconds: 9999 }));

    expect(rangeGated).toBe(true);
    expect(hpGated).toBe(true);
    expect(elapsedGated).toBe(true);
  });
});
