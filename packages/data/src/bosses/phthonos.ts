import type { AttackPattern, BossDefinition, BossPhase } from "@pithos/sim";

/**
 * Phthonos, Spite of Envy — the Aether wing's Spite boss (GDD.md §2, §4,
 * §11). Fought in `aether_phthonos_reach` (`rooms/aether.ts`).
 *
 * GDD.md §2 is explicit the Spites "aren't cartoonish villains" and calls
 * Phthonos out by name as "achingly lonely" — the `loreDescription` below
 * is written around envy-as-loneliness (he envies connection he's never
 * had, not treasure or power) rather than the usual jealous-rival framing.
 *
 * Mechanical hook for that theme: every attack pattern below is Phthonos
 * "envying" one of the player's own four Form archetypes, expressed
 * through the matching `HitboxArchetype` — melee (Solid), wave (Liquid),
 * projectile (Gas), beam (Plasma) — one of each per phase. He isn't
 * copying their damage types (everything here is thematically Aether:
 * starlight, gravity, prismatic light), just the shapes of the fight he's
 * never gotten to have from the other side. Phase 3's `phthonos_collapsing_envy`
 * goes one step further and echoes the player's own Empyrean Collapse
 * ultimate shape (`{ kind: "wave", range: 7-8, width: 7-8 }`) — the one
 * thing he's watched every alchemist wield and never gets to keep.
 *
 * `maxHealth` (980) sits above Ponos's and Algea's (850 each, see
 * `bosses/ponos.ts`/`bosses/algea.ts`) — Aether is the last wing before
 * the midpoint revelation, so this should read as the hardest of the five
 * "normal" wing fights. `weight`/`cooldownSeconds` shift across phases so
 * the fight accelerates, mirroring the escalation pattern both sibling
 * bosses already establish.
 */

const PHASE_1_PATTERNS: AttackPattern[] = [
  // Covetous reach — a grasping melee lunge, Phthonos's envy of Solid's
  // committed, up-close power. Only worth using once the player is
  // actually close enough to grasp at.
  {
    id: "phthonos_covetous_reach",
    timeline: {
      windupSeconds: 0.5,
      activeSeconds: 0.25,
      recoverySeconds: 0.55,
      hitbox: { kind: "melee", range: 2.5, arcDegrees: 110 },
      baseDamage: 24,
    },
    weight: 3,
    cooldownSeconds: 5,
    condition: (ctx) => ctx.distanceToPlayer <= 3,
  },
  // Grasping tide — a rippling wave of starlit current, envying Liquid's
  // flowing reach.
  {
    id: "phthonos_grasping_tide",
    timeline: {
      windupSeconds: 0.55,
      activeSeconds: 0.3,
      recoverySeconds: 0.45,
      hitbox: { kind: "wave", range: 5, width: 3 },
      baseDamage: 20,
    },
    weight: 3,
    cooldownSeconds: 6,
  },
  // Shard of want — a single hurled prism-shard, envying Gas's ranged,
  // disposable pokes.
  {
    id: "phthonos_shard_of_want",
    timeline: {
      windupSeconds: 0.3,
      activeSeconds: 0.1,
      recoverySeconds: 0.3,
      hitbox: { kind: "projectile", speed: 15, radius: 0.35, maxRange: 10 },
      baseDamage: 16,
    },
    weight: 3,
    cooldownSeconds: 4,
  },
  // Envious glare — a thin, sustained starlight beam, envying Plasma's
  // precise single-target focus.
  {
    id: "phthonos_envious_glare",
    timeline: {
      windupSeconds: 0.6,
      activeSeconds: 0.1,
      recoverySeconds: 0.5,
      hitbox: { kind: "beam", length: 9, width: 0.5 },
      baseDamage: 30,
    },
    weight: 2,
    cooldownSeconds: 9,
  },
];

const PHASE_2_PATTERNS: AttackPattern[] = [
  // Faster, harder-hitting reach than phase 1's.
  {
    id: "phthonos_covetous_reach_ii",
    timeline: {
      windupSeconds: 0.4,
      activeSeconds: 0.25,
      recoverySeconds: 0.45,
      hitbox: { kind: "melee", range: 3, arcDegrees: 140 },
      baseDamage: 30,
    },
    weight: 3,
    cooldownSeconds: 4,
    condition: (ctx) => ctx.distanceToPlayer <= 3.5,
  },
  // Hollow undertow — a wider gravity-tinged pull-wave, a first taste of
  // the ultimate's "pull, then detonate" shape. Only worth casting when
  // the player has put real distance between them and Phthonos.
  {
    id: "phthonos_hollow_undertow",
    timeline: {
      windupSeconds: 0.7,
      activeSeconds: 0.35,
      recoverySeconds: 0.6,
      hitbox: { kind: "wave", range: 6, width: 5 },
      baseDamage: 26,
    },
    weight: 3,
    cooldownSeconds: 8,
    condition: (ctx) => ctx.distanceToPlayer > 4,
  },
  // Shard barrage — several prism-shards in quick succession rather than
  // phase 1's single throw.
  {
    id: "phthonos_shard_barrage",
    timeline: {
      windupSeconds: 0.3,
      activeSeconds: 0.15,
      recoverySeconds: 0.3,
      hitbox: { kind: "projectile", speed: 18, radius: 0.45, maxRange: 11 },
      baseDamage: 20,
    },
    weight: 4,
    cooldownSeconds: 5,
  },
  // Yearning beam — a longer, harder-hitting successor to the envious
  // glare.
  {
    id: "phthonos_yearning_beam",
    timeline: {
      windupSeconds: 0.5,
      activeSeconds: 0.12,
      recoverySeconds: 0.4,
      hitbox: { kind: "beam", length: 10, width: 0.6 },
      baseDamage: 36,
    },
    weight: 2,
    cooldownSeconds: 10,
  },
];

const PHASE_3_STARVING_ENVY_PATTERNS: AttackPattern[] = [
  // Frantic, short-windup grasping — Phthonos lunging for any contact he
  // can get before the fight ends.
  {
    id: "phthonos_covetous_reach_iii",
    timeline: {
      windupSeconds: 0.3,
      activeSeconds: 0.25,
      recoverySeconds: 0.35,
      hitbox: { kind: "melee", range: 3.2, arcDegrees: 170 },
      baseDamage: 36,
    },
    weight: 3,
    cooldownSeconds: 3,
    condition: (ctx) => ctx.distanceToPlayer <= 3.5,
  },
  // A hail of prism-shards rather than a barrage — fast, frequent, ranged
  // pressure so kiting stops being a safe answer.
  {
    id: "phthonos_shard_storm",
    timeline: {
      windupSeconds: 0.25,
      activeSeconds: 0.15,
      recoverySeconds: 0.25,
      hitbox: { kind: "projectile", speed: 20, radius: 0.5, maxRange: 12 },
      baseDamage: 24,
    },
    weight: 3,
    cooldownSeconds: 3.5,
  },
  // The last, sharpest version of the envious glare.
  {
    id: "phthonos_last_yearning_beam",
    timeline: {
      windupSeconds: 0.45,
      activeSeconds: 0.12,
      recoverySeconds: 0.35,
      hitbox: { kind: "beam", length: 11, width: 0.7 },
      baseDamage: 42,
    },
    weight: 3,
    cooldownSeconds: 6,
  },
  // Collapsing envy — Phthonos's biggest, rarest attack: a wide gravity
  // well that echoes the player's own Empyrean Collapse shape, the one
  // thing he's watched every alchemist wield and never gets to keep. Kept
  // below the player's actual ultimate baseDamage (92, see
  // `schools/aether.ts`) so the player's own Empyrean Collapse still reads
  // as the single hardest hit in the game; gated to only appear once the
  // fight has dragged on, in keeping with his tragic framing (a last,
  // desperate reach rather than a triumphant finisher).
  {
    id: "phthonos_collapsing_envy",
    timeline: {
      windupSeconds: 1.4,
      activeSeconds: 0.5,
      recoverySeconds: 0.9,
      hitbox: { kind: "wave", range: 8, width: 8 },
      baseDamage: 58,
    },
    weight: 1,
    cooldownSeconds: 16,
    condition: (ctx) => ctx.elapsedSeconds > 45,
  },
];

const PHASE_1: BossPhase = {
  id: "phase_quiet_longing",
  hpThreshold: 1,
  attackPatterns: PHASE_1_PATTERNS,
};

const PHASE_2: BossPhase = {
  id: "phase_bitter_reflection",
  hpThreshold: 0.6,
  attackPatterns: PHASE_2_PATTERNS,
};

const PHASE_3_STARVING_ENVY: BossPhase = {
  id: "phase_starving_envy",
  hpThreshold: 0.25,
  attackPatterns: PHASE_3_STARVING_ENVY_PATTERNS,
};

export const BOSS_PHTHONOS: BossDefinition = {
  id: "phthonos",
  displayName: "Phthonos",
  epithet: "Phthonos, Spite of Envy",
  loreDescription:
    "Phthonos was never freed to want anything so simple as gold or a rival's throne — he was freed " +
    "already alone, and envy is what fills the space where connection should have been. He doesn't covet " +
    "what alchemists carry into his reach; he covets the fact that someone, for once, is looking back at " +
    "him, and he has never once learned how to let that end without a fight.",
  maxHealth: 980,
  // Listed in descending hpThreshold order, exactly one at 1 (the starting
  // phase) — see BossController's phase-resolution doc.
  phases: [PHASE_1, PHASE_2, PHASE_3_STARVING_ENVY],
};
