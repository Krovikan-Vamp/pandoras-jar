import type { AttackPattern, BossDefinition, BossPhase } from "@pithos/sim";

/**
 * Ponos, Spite of Toil — the Earth wing's Spite boss (GDD.md §2, §4, §11).
 * Fought in `earth_ponos_hollow` (`rooms/earth.ts`).
 *
 * GDD.md §2 is explicit that the Spites "aren't cartoonish villains" and
 * that Ponos specifically "is exhausted by his own endless labor" — the
 * `loreDescription` and the phase progression below (telegraphed/heavy in
 * phase 1, faster and more desperate by phase 3) are both written to sell
 * a figure worn down by compulsive toil, not a monster relishing a fight.
 *
 * Attack patterns lean on melee/wave/projectile hitboxes (stone-gauntlet
 * slams, ground-slam AOEs, thrown boulders) rather than beams — a
 * labor/quarry theme reads as heavy, close, and physical, not precise.
 * `weight`/`cooldownSeconds` shift across phases so the fight accelerates:
 * phase 1's patterns are slow and heavily telegraphed (long windups, long
 * cooldowns), phase 3's are faster and more frequent, with one huge,
 * rarely-available "last stand" attack standing in for Ponos throwing
 * everything he has left into the fight.
 */

const PHASE_1_PATTERNS: AttackPattern[] = [
  // Heavy stone-gauntlet slam — the bread-and-butter opener, long windup
  // so it reads clearly as a telegraph.
  {
    id: "ponos_gauntlet_slam",
    timeline: {
      windupSeconds: 0.9,
      activeSeconds: 0.3,
      recoverySeconds: 0.8,
      hitbox: { kind: "melee", range: 3, arcDegrees: 140 },
      baseDamage: 40,
    },
    weight: 3,
    cooldownSeconds: 4,
  },
  // Ground-slam AOE — only worth using once the player has closed to melee
  // range; exercises `condition` as a melee-range gate.
  {
    id: "ponos_ground_slam_aoe",
    timeline: {
      windupSeconds: 1.1,
      activeSeconds: 0.3,
      recoverySeconds: 1.0,
      hitbox: { kind: "melee", range: 5, arcDegrees: 360 },
      baseDamage: 35,
    },
    weight: 2,
    cooldownSeconds: 8,
    condition: (ctx) => ctx.distanceToPlayer <= 4,
  },
  // Thrown boulder — Ponos's ranged answer when the player kites out of
  // melee range; exercises `condition` as a beyond-range gate (the
  // mirror-image of the ground slam's).
  {
    id: "ponos_boulder_throw",
    timeline: {
      windupSeconds: 0.8,
      activeSeconds: 0.2,
      recoverySeconds: 0.7,
      hitbox: { kind: "projectile", speed: 10, radius: 0.6, maxRange: 12 },
      baseDamage: 25,
    },
    weight: 2,
    cooldownSeconds: 6,
    condition: (ctx) => ctx.distanceToPlayer > 4,
  },
];

const PHASE_2_PATTERNS: AttackPattern[] = [
  // Faster follow-up slam — shorter windup/recovery than phase 1's.
  {
    id: "ponos_double_slam",
    timeline: {
      windupSeconds: 0.6,
      activeSeconds: 0.3,
      recoverySeconds: 0.5,
      hitbox: { kind: "melee", range: 3.5, arcDegrees: 160 },
      baseDamage: 38,
    },
    weight: 3,
    cooldownSeconds: 3,
  },
  // A cracking fissure wave rippling out from Ponos across the ground.
  {
    id: "ponos_fissure_wave",
    timeline: {
      windupSeconds: 0.7,
      activeSeconds: 0.25,
      recoverySeconds: 0.5,
      hitbox: { kind: "wave", range: 7, width: 3 },
      baseDamage: 30,
    },
    weight: 3,
    cooldownSeconds: 5,
  },
  // Boulder barrage — quicker, lighter-hitting than phase 1's single
  // throw, still gated to when the player isn't right on top of him.
  {
    id: "ponos_boulder_barrage",
    timeline: {
      windupSeconds: 0.5,
      activeSeconds: 0.15,
      recoverySeconds: 0.4,
      hitbox: { kind: "projectile", speed: 14, radius: 0.5, maxRange: 14 },
      baseDamage: 22,
    },
    weight: 2,
    cooldownSeconds: 4,
    condition: (ctx) => ctx.distanceToPlayer > 3,
  },
  // Rare, big tremor — a longer-cooldown "spike" attack layered under the
  // faster baseline kit.
  {
    id: "ponos_tremor_stagger",
    timeline: {
      windupSeconds: 1.0,
      activeSeconds: 0.3,
      recoverySeconds: 0.9,
      hitbox: { kind: "melee", range: 6, arcDegrees: 360 },
      baseDamage: 32,
    },
    weight: 1,
    cooldownSeconds: 10,
  },
];

const PHASE_3_ENRAGE_PATTERNS: AttackPattern[] = [
  // Frantic, short-windup slam spam — Ponos throwing his remaining
  // strength into every swing.
  {
    id: "ponos_frenzied_slam",
    timeline: {
      windupSeconds: 0.4,
      activeSeconds: 0.25,
      recoverySeconds: 0.35,
      hitbox: { kind: "melee", range: 3.5, arcDegrees: 180 },
      baseDamage: 42,
    },
    weight: 4,
    cooldownSeconds: 2,
  },
  // The ground itself gives way beneath him — a wide, harder-hitting
  // successor to phase 1/2's ground-slam AOEs.
  {
    id: "ponos_collapsing_ground",
    timeline: {
      windupSeconds: 0.6,
      activeSeconds: 0.3,
      recoverySeconds: 0.6,
      hitbox: { kind: "melee", range: 6, arcDegrees: 360 },
      baseDamage: 45,
    },
    weight: 3,
    cooldownSeconds: 5,
  },
  // A hail of boulders rather than a barrage — fast, frequent, ranged
  // pressure so kiting stops being a safe answer.
  {
    id: "ponos_boulder_storm",
    timeline: {
      windupSeconds: 0.35,
      activeSeconds: 0.15,
      recoverySeconds: 0.3,
      hitbox: { kind: "projectile", speed: 16, radius: 0.6, maxRange: 14 },
      baseDamage: 26,
    },
    weight: 3,
    cooldownSeconds: 2,
    condition: (ctx) => ctx.distanceToPlayer > 3,
  },
  // "Last Stand" — Ponos's biggest, slowest, rarest attack: a desperate,
  // exhausted, all-or-nothing eruption rather than a triumphant finisher,
  // in keeping with his tragic framing.
  {
    id: "ponos_last_stand_quake",
    timeline: {
      windupSeconds: 1.3,
      activeSeconds: 0.35,
      recoverySeconds: 1.0,
      hitbox: { kind: "melee", range: 8, arcDegrees: 360 },
      baseDamage: 60,
    },
    weight: 1,
    cooldownSeconds: 14,
  },
];

const PHASE_1: BossPhase = {
  id: "phase1",
  hpThreshold: 1,
  attackPatterns: PHASE_1_PATTERNS,
};

const PHASE_2: BossPhase = {
  id: "phase2",
  hpThreshold: 0.6,
  attackPatterns: PHASE_2_PATTERNS,
};

const PHASE_3_ENRAGE: BossPhase = {
  id: "enrage",
  hpThreshold: 0.25,
  attackPatterns: PHASE_3_ENRAGE_PATTERNS,
};

export const BOSS_PONOS: BossDefinition = {
  id: "ponos",
  displayName: "Ponos",
  epithet: "Ponos, Spite of Toil",
  loreDescription:
    "Ponos never asked to rule anything — freed from the jar with only the compulsion to labor, he carved this hollow himself, stone by stone, and has never once let himself stop to notice it's finished. He doesn't fight to win; he fights because stopping was never one of the options he was given.",
  maxHealth: 850,
  // Listed in descending hpThreshold order, exactly one at 1 (the starting
  // phase) — see BossController's phase-resolution doc.
  phases: [PHASE_1, PHASE_2, PHASE_3_ENRAGE],
};
