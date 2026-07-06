import type { AttackPattern, BossDefinition, BossPhase } from "@pithos/sim";

/**
 * Kenoma, the Emptiness — the true final boss (GDD.md §2 "Midpoint
 * Revelation"/"Act 3 — The Confluence"; §11's Bosses table). Fought in the
 * Confluence, the sixth wing that opens once all five Hope Fragments are
 * recovered, and later repurposed as the permanent New Game+ "Second
 * Kindling" endgame loop (GDD.md §2).
 *
 * Kenoma is deliberately *not* written like the five Spites. GDD.md §2 is
 * explicit that Kenoma predates Hesiod's evils entirely — "something older,
 * something the jar was also built to contain" — and that it isn't cunning
 * or malicious so much as an ancient hunger that found the Spites'
 * isolation useful: it fed on the Grey Hush above by keeping hope
 * permanently divided, using the Spites and each other's loneliness rather
 * than tormenting anyone directly. Where Ponos/Loimos/Algea/Geras/Phthonos
 * are tragic and sympathetic, Kenoma is written as indifferent and cold —
 * there is no grief or compulsion driving it, just absence given a shape
 * roughly your size.
 *
 * ### Structure: five elements, one emptiness
 *
 * The Confluence is the one place in the jar "where all five elements bleed
 * together" (GDD.md §2), so Kenoma's four phases escalate through that
 * mixing rather than through a single element's story beat the way each
 * wing boss does:
 *
 *   - Phase 1 ("The First Hunger", 100% HP) — five single-element attacks,
 *     one per School (Earth/Fire/Water/Air/Aether), each still legible on
 *     its own. This is Kenoma testing the player with the same tools every
 *     Spite already showed them individually.
 *   - Phase 2 ("The Confluence Bleeds", 70% HP) — attacks now pair two
 *     elements' flavor per pattern (earth+fire, water+air, aether+earth,
 *     fire+water, air+aether), covering every element at least twice.
 *   - Phase 3 ("The Widening Absence", 40% HP) — three-plus elements per
 *     pattern, faster and harder-hitting, and the first "desperate" pattern
 *     gated on Kenoma's own dropping HP rather than range.
 *   - Phase 4 ("The Unbound Emptiness", 15% HP, enrage) — all five
 *     elements' worth of patterns are simultaneously live with the
 *     fight's tightest cooldowns, capped by `kenoma_the_last_silence`: a
 *     fight-defining, `elapsedSeconds`-gated ultimate that is the single
 *     hardest-hitting attack pattern in the game (see numbers note below).
 *
 * ### Honest deviation note on "mixing elements"
 *
 * `AttackPattern`/`AttackTimeline` (`packages/sim/src/bosses/types.ts`,
 * `packages/sim/src/combat/types.ts`) have no `damageType` field of their
 * own — `DamageType` only exists on `FormFlavor`, which is a School/Form
 * concept, not a boss-attack concept (the same gap `bosses/loimos.ts` and
 * `bosses/geras.ts` already noted for their own single-element theming).
 * Rather than bolting an untyped/invented property onto `AttackPattern`,
 * Kenoma's "five elements mixing" identity is expressed the way the spec
 * allows: hitbox variety (melee/wave/projectile/beam used roughly evenly
 * across the full pattern set, so Kenoma threatens every range unlike the
 * wing bosses which mostly leaned into one or two archetypes), pattern
 * naming that names the elements explicitly, and a damage/timing curve
 * that escalates with how many elements a given pattern claims to mix. If
 * `AttackPattern` gains real status/damage-type support later, these
 * pattern ids are the natural place to wire actual per-element status
 * effects through.
 *
 * ### Numbers this exceeds
 *
 * All five wing bosses currently sit at `maxHealth: 850` (Ponos, Loimos,
 * Algea, Geras) or `980` (Phthonos, the hardest of the five per its own
 * file doc). Kenoma's `maxHealth` (1700) is roughly 1.7x the hardest wing
 * boss — a clear step up for the capstone fight of the whole game, without
 * multiplying it so far that repeat Second Kindling runs turn into a
 * damage-sponge slog. The highest `baseDamage` any wing boss ever reaches
 * is Loimos's `loimos_last_ember` at 68 (`bosses/loimos.ts`); the highest
 * School ultimate in the game is Fire's at 95 (`schools/fire.ts`).
 * `kenoma_the_last_silence` (140 baseDamage) clears both.
 */

const PHASE_1_FIRST_HUNGER: AttackPattern[] = [
  // Earth — a crushing bite from the floor itself. The fight's baseline
  // melee opener, comparable in shape to Ponos's gauntlet slam but themed
  // as the ground simply ceasing to hold the player up rather than a blow.
  {
    id: "kenoma_hollow_ground_bite",
    timeline: {
      windupSeconds: 0.6,
      activeSeconds: 0.3,
      recoverySeconds: 0.6,
      hitbox: { kind: "melee", range: 3.5, arcDegrees: 150 },
      baseDamage: 44,
    },
    weight: 3,
    cooldownSeconds: 4,
  },
  // Fire — a seed of collapsing light lobbed at range. Only worth using
  // once the player has actually put distance between them and Kenoma.
  {
    id: "kenoma_cinder_null",
    timeline: {
      windupSeconds: 0.5,
      activeSeconds: 0.15,
      recoverySeconds: 0.45,
      hitbox: { kind: "projectile", speed: 14, radius: 0.5, maxRange: 12 },
      baseDamage: 34,
    },
    weight: 3,
    cooldownSeconds: 4,
    condition: (ctx) => ctx.distanceToPlayer > 3,
  },
  // Water — a tide of nothing rushing outward, dissolving rather than
  // drowning.
  {
    id: "kenoma_null_tide",
    timeline: {
      windupSeconds: 0.6,
      activeSeconds: 0.3,
      recoverySeconds: 0.55,
      hitbox: { kind: "wave", range: 6, width: 4 },
      baseDamage: 36,
    },
    weight: 3,
    cooldownSeconds: 5,
  },
  // Air — a howling vacuum path down a lane the player is standing in;
  // only telegraphed when it would actually reach them.
  {
    id: "kenoma_vacuum_howl",
    timeline: {
      windupSeconds: 0.7,
      activeSeconds: 0.2,
      recoverySeconds: 0.6,
      hitbox: { kind: "beam", length: 9, width: 1.2 },
      baseDamage: 42,
    },
    weight: 2,
    cooldownSeconds: 7,
    condition: (ctx) => ctx.distanceToPlayer <= 9,
  },
  // Aether — a starlight-erasing claw, only threatening at close range.
  {
    id: "kenoma_starlit_claw",
    timeline: {
      windupSeconds: 0.5,
      activeSeconds: 0.25,
      recoverySeconds: 0.5,
      hitbox: { kind: "melee", range: 4, arcDegrees: 200 },
      baseDamage: 38,
    },
    weight: 2,
    cooldownSeconds: 6,
    condition: (ctx) => ctx.distanceToPlayer <= 4,
  },
];

const PHASE_2_CONFLUENCE_BLEEDS: AttackPattern[] = [
  // Earth + Fire — the ground itself catches, a fault line of magma.
  {
    id: "kenoma_magma_fault",
    timeline: {
      windupSeconds: 0.55,
      activeSeconds: 0.3,
      recoverySeconds: 0.5,
      hitbox: { kind: "melee", range: 4, arcDegrees: 180 },
      baseDamage: 52,
    },
    weight: 3,
    cooldownSeconds: 4,
  },
  // Water + Air — a riptide dragged sideways by a gale, wider and
  // harder-hitting than phase 1's single-element tide.
  {
    id: "kenoma_riptide_gale",
    timeline: {
      windupSeconds: 0.65,
      activeSeconds: 0.35,
      recoverySeconds: 0.55,
      hitbox: { kind: "wave", range: 7, width: 5 },
      baseDamage: 46,
    },
    weight: 3,
    cooldownSeconds: 5,
  },
  // Aether + Earth — a shard of collapsed starlight, thrown like a stone.
  // Ranged answer to a kiting player, mirroring the wing bosses' own
  // range-gated ranged pokes.
  {
    id: "kenoma_starfall_shard",
    timeline: {
      windupSeconds: 0.4,
      activeSeconds: 0.15,
      recoverySeconds: 0.35,
      hitbox: { kind: "projectile", speed: 16, radius: 0.5, maxRange: 13 },
      baseDamage: 40,
    },
    weight: 3,
    cooldownSeconds: 4,
    condition: (ctx) => ctx.distanceToPlayer > 4,
  },
  // Fire + Water — a lancing jet of scalding steam; only fired when it
  // would actually reach.
  {
    id: "kenoma_steam_collapse",
    timeline: {
      windupSeconds: 0.6,
      activeSeconds: 0.15,
      recoverySeconds: 0.5,
      hitbox: { kind: "beam", length: 10, width: 1.5 },
      baseDamage: 50,
    },
    weight: 2,
    cooldownSeconds: 8,
    condition: (ctx) => ctx.distanceToPlayer <= 10,
  },
  // Air + Aether — a slow-drifting void cyclone that pulls the player in
  // from range, echoing Geras's own dust-cyclone shape but colder.
  {
    id: "kenoma_null_cyclone",
    timeline: {
      windupSeconds: 0.7,
      activeSeconds: 0.35,
      recoverySeconds: 0.55,
      hitbox: { kind: "projectile", speed: 8, radius: 1.5, maxRange: 11 },
      baseDamage: 30,
    },
    weight: 2,
    cooldownSeconds: 9,
    condition: (ctx) => ctx.distanceToPlayer > 5,
  },
];

const PHASE_3_WIDENING_ABSENCE: AttackPattern[] = [
  // Earth + Fire + Water — a point-blank collapse of three elements at
  // once, wide enough to threaten every direction.
  {
    id: "kenoma_triune_collapse",
    timeline: {
      windupSeconds: 0.7,
      activeSeconds: 0.35,
      recoverySeconds: 0.6,
      hitbox: { kind: "melee", range: 5, arcDegrees: 360 },
      baseDamage: 58,
    },
    weight: 3,
    cooldownSeconds: 6,
  },
  // All five, thinned into a single precise lance — the fight's sharpest
  // beam so far.
  {
    id: "kenoma_fivefold_lance",
    timeline: {
      windupSeconds: 0.5,
      activeSeconds: 0.15,
      recoverySeconds: 0.4,
      hitbox: { kind: "beam", length: 11, width: 0.8 },
      baseDamage: 55,
    },
    weight: 3,
    cooldownSeconds: 7,
    condition: (ctx) => ctx.distanceToPlayer <= 11,
  },
  // Water + Air + Aether — the widest wave in the fight so far, a
  // maelstrom of absence rather than water.
  {
    id: "kenoma_maelstrom_of_absence",
    timeline: {
      windupSeconds: 0.8,
      activeSeconds: 0.5,
      recoverySeconds: 0.7,
      hitbox: { kind: "wave", range: 8, width: 7 },
      baseDamage: 60,
    },
    weight: 3,
    cooldownSeconds: 8,
  },
  // Fire + Aether — a rapid volley rather than a single throw, ranged
  // pressure so kiting stops being a safe answer.
  {
    id: "kenoma_starving_barrage",
    timeline: {
      windupSeconds: 0.3,
      activeSeconds: 0.15,
      recoverySeconds: 0.3,
      hitbox: { kind: "projectile", speed: 20, radius: 0.5, maxRange: 13 },
      baseDamage: 34,
    },
    weight: 4,
    cooldownSeconds: 3,
    condition: (ctx) => ctx.distanceToPlayer > 3,
  },
  // A desperate close-range grasp that only appears once Kenoma is
  // already sliding toward the enrage threshold — the fight's first
  // HP-gated ("desperate late-fight") pattern.
  {
    id: "kenoma_famine_grasp",
    timeline: {
      windupSeconds: 0.45,
      activeSeconds: 0.25,
      recoverySeconds: 0.4,
      hitbox: { kind: "melee", range: 4.5, arcDegrees: 220 },
      baseDamage: 62,
    },
    weight: 2,
    cooldownSeconds: 6,
    condition: (ctx) => ctx.currentHealthFraction <= 0.3,
  },
];

const PHASE_4_UNBOUND_EMPTINESS: AttackPattern[] = [
  // Every element at once, point-blank — the enrage phase's baseline melee,
  // faster and harder than anything in phase 3.
  {
    id: "kenoma_omnipresent_maw",
    timeline: {
      windupSeconds: 0.35,
      activeSeconds: 0.3,
      recoverySeconds: 0.35,
      hitbox: { kind: "melee", range: 5, arcDegrees: 360 },
      baseDamage: 66,
    },
    weight: 4,
    cooldownSeconds: 3,
  },
  // A tide that no longer resembles water at all — the widest wave in the
  // game.
  {
    id: "kenoma_undoing_tide",
    timeline: {
      windupSeconds: 0.5,
      activeSeconds: 0.45,
      recoverySeconds: 0.45,
      hitbox: { kind: "wave", range: 9, width: 9 },
      baseDamage: 64,
    },
    weight: 3,
    cooldownSeconds: 5,
  },
  // Rapid-fire annihilation bolts — the fastest, most frequent ranged
  // pressure in the fight, so standing at range stops being safe either.
  {
    id: "kenoma_annihilation_volley",
    timeline: {
      windupSeconds: 0.2,
      activeSeconds: 0.12,
      recoverySeconds: 0.2,
      hitbox: { kind: "projectile", speed: 22, radius: 0.6, maxRange: 14 },
      baseDamage: 40,
    },
    weight: 4,
    cooldownSeconds: 2,
    condition: (ctx) => ctx.distanceToPlayer > 3,
  },
  // The fight's longest, hardest-hitting beam short of the ultimate.
  {
    id: "kenoma_void_lance",
    timeline: {
      windupSeconds: 0.4,
      activeSeconds: 0.15,
      recoverySeconds: 0.35,
      hitbox: { kind: "beam", length: 12, width: 1.5 },
      baseDamage: 62,
    },
    weight: 3,
    cooldownSeconds: 4,
    condition: (ctx) => ctx.distanceToPlayer <= 12,
  },
  // "The Last Silence" — Kenoma giving up any pretense of a shape and
  // simply becoming the absence it always was. This is the fight's
  // ultimate: gated on the fight having genuinely dragged on (an
  // `elapsedSeconds` condition, deliberately not also HP-gated the way
  // `kenoma_famine_grasp` is — the enrage phase's hpThreshold already
  // guarantees low HP, so this condition is the one that makes it a
  // fight-defining "so this is how it ends" beat rather than a HP-redundant
  // check), rare (`cooldownSeconds: 20`, `weight: 1`), and the single
  // hardest-hitting attack pattern in the entire game — see the numbers
  // note in this file's module doc.
  {
    id: "kenoma_the_last_silence",
    timeline: {
      windupSeconds: 1.8,
      activeSeconds: 0.6,
      recoverySeconds: 1.2,
      hitbox: { kind: "wave", range: 12, width: 12 },
      baseDamage: 140,
    },
    weight: 1,
    cooldownSeconds: 20,
    condition: (ctx) => ctx.elapsedSeconds > 60,
  },
];

const PHASE_1: BossPhase = {
  id: "phase_first_hunger",
  hpThreshold: 1,
  attackPatterns: PHASE_1_FIRST_HUNGER,
};

const PHASE_2: BossPhase = {
  id: "phase_confluence_bleeds",
  hpThreshold: 0.7,
  attackPatterns: PHASE_2_CONFLUENCE_BLEEDS,
};

const PHASE_3: BossPhase = {
  id: "phase_widening_absence",
  hpThreshold: 0.4,
  attackPatterns: PHASE_3_WIDENING_ABSENCE,
};

const PHASE_4_ENRAGE: BossPhase = {
  id: "phase_unbound_emptiness",
  hpThreshold: 0.15,
  attackPatterns: PHASE_4_UNBOUND_EMPTINESS,
};

export const BOSS_KENOMA: BossDefinition = {
  id: "kenoma",
  displayName: "Kenoma",
  epithet: "Kenoma, the Emptiness",
  loreDescription:
    "Kenoma is not one of Hesiod's five evils, and it isn't cruel the way the Spites who fled the jar " +
    "were made to be — it is older than the jar itself, an ancient hunger the jar was also built to " +
    "contain, and it has spent centuries feeding on the world's Grey Hush by keeping the Spites and their " +
    "Fragments isolated from each other and from Elpis. It doesn't hate hope; it simply has no use for it, " +
    "and that indifference is colder and harder to fight than any grudge.",
  maxHealth: 1700,
  // Listed in descending hpThreshold order, exactly one at 1 (the starting
  // phase) — see BossController's phase-resolution doc.
  phases: [PHASE_1, PHASE_2, PHASE_3, PHASE_4_ENRAGE],
};
