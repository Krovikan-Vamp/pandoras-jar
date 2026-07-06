import type { BossDefinition } from "@pithos/sim";

/**
 * Geras, Spite of Old Age — Air's boss (GDD.md §4 "Air" row: "Geras's
 * Spire"; §11: guards Hope Fragment IV). Per GDD.md §2, the Spites are
 * written as tragic and sympathetic rather than villainous: Geras isn't
 * cruel, he's inevitable — a weary, patient figure who has watched
 * everything he touches wither, and takes no joy in it.
 *
 * Narrative beat for the phase design: rather than visibly slowing down as
 * he weakens, Geras gets *faster and more frantic* in later phases — an
 * inversion of his "old age" theme. He isn't gaining strength; he's fighting
 * his own decay, growing more desperate as his power wanes, so his attacks'
 * windups/recoveries shrink and cooldowns tighten from phase to phase while
 * his own patience visibly runs out.
 *
 * All attack patterns reuse the shared `AttackTimeline` shape (see
 * `packages/sim/src/bosses/types.ts` module doc) with air-flavored hitboxes:
 * wind gusts (`wave`), cyclone pulls (`projectile`), and brittle/decaying
 * strikes (`melee`). `AttackPattern` has no `onHitStatus` field — the
 * "brittle, decaying" read on his melee strikes is carried by flavor/id
 * naming only; an actual slow/weaken status is future combat-runtime work,
 * same caveat as the Air Ultimate in `../schools/air.ts`.
 */
export const BOSS_GERAS: BossDefinition = {
  id: "geras",
  displayName: "Geras",
  epithet: "Geras, Spite of Old Age",
  loreDescription:
    "Geras does not hate you, or anyone; he simply cannot stop. Every hour he lingers near a " +
    "thing — a flower, a friendship, a kingdom — is an hour stolen from it, and he has wandered " +
    "the Spire so long he no longer remembers a world he hasn't already begun to wear away. He " +
    "fights now not out of malice but exhaustion: one more thing time will take, whether he wills " +
    "it or not.",
  maxHealth: 850,
  phases: [
    {
      // "The Weary Ages" — patient, heavy, deliberate. Long windups, modest
      // cooldown pressure; Geras still moves like the ages themselves.
      id: "phase_weary_ages",
      hpThreshold: 1,
      attackPatterns: [
        {
          id: "withering_backhand",
          timeline: {
            windupSeconds: 0.55,
            activeSeconds: 0.25,
            recoverySeconds: 0.65,
            hitbox: { kind: "melee", range: 2.5, arcDegrees: 100 },
            baseDamage: 22,
          },
          weight: 3,
          cooldownSeconds: 4,
        },
        {
          id: "grinding_gust",
          timeline: {
            windupSeconds: 0.6,
            activeSeconds: 0.35,
            recoverySeconds: 0.5,
            hitbox: { kind: "wave", range: 6, width: 4 },
            baseDamage: 18,
          },
          weight: 3,
          cooldownSeconds: 5,
        },
        {
          id: "spire_dust_cyclone",
          // A slow-drifting dust devil that pulls the player in from range —
          // only worth casting when they aren't already close.
          timeline: {
            windupSeconds: 0.7,
            activeSeconds: 0.4,
            recoverySeconds: 0.6,
            hitbox: { kind: "projectile", speed: 6, radius: 1.2, maxRange: 10 },
            baseDamage: 16,
          },
          weight: 2,
          cooldownSeconds: 8,
          condition: (ctx) => ctx.distanceToPlayer > 4,
        },
      ],
    },
    {
      // "The Fraying Hourglass" — Geras starts to feel his own time running
      // out. Windups/recoveries tighten, cooldowns shorten, a new radial
      // "brittle" strike appears for when the player presses close.
      id: "phase_fraying_hourglass",
      hpThreshold: 0.6,
      attackPatterns: [
        {
          id: "withering_backhand_flurry",
          timeline: {
            windupSeconds: 0.4,
            activeSeconds: 0.2,
            recoverySeconds: 0.45,
            hitbox: { kind: "melee", range: 2.5, arcDegrees: 110 },
            baseDamage: 24,
          },
          weight: 3,
          cooldownSeconds: 3,
        },
        {
          id: "twin_gale_slash",
          timeline: {
            windupSeconds: 0.45,
            activeSeconds: 0.3,
            recoverySeconds: 0.35,
            hitbox: { kind: "wave", range: 6, width: 5 },
            baseDamage: 20,
          },
          weight: 3,
          cooldownSeconds: 3.5,
        },
        {
          id: "collapsing_cyclone",
          timeline: {
            windupSeconds: 0.5,
            activeSeconds: 0.3,
            recoverySeconds: 0.4,
            hitbox: { kind: "projectile", speed: 9, radius: 1.4, maxRange: 11 },
            baseDamage: 20,
          },
          weight: 2,
          cooldownSeconds: 6,
          condition: (ctx) => ctx.distanceToPlayer > 3,
        },
        {
          id: "brittle_cascade",
          // A radial burst of cracking, decaying force — only threatens
          // point-blank range.
          timeline: {
            windupSeconds: 0.5,
            activeSeconds: 0.2,
            recoverySeconds: 0.5,
            hitbox: { kind: "melee", range: 3.5, arcDegrees: 360 },
            baseDamage: 16,
          },
          weight: 2,
          cooldownSeconds: 7,
          condition: (ctx) => ctx.distanceToPlayer < 3,
        },
      ],
    },
    {
      // "The Last Grains" — frantic and desperate: his fastest, most
      // erratic patterns, and a final all-or-nothing burst that only
      // surfaces once he's nearly out of time himself.
      id: "phase_last_grains",
      hpThreshold: 0.25,
      attackPatterns: [
        {
          id: "frantic_backhand",
          timeline: {
            windupSeconds: 0.3,
            activeSeconds: 0.15,
            recoverySeconds: 0.3,
            hitbox: { kind: "melee", range: 2.5, arcDegrees: 120 },
            baseDamage: 26,
          },
          weight: 3,
          cooldownSeconds: 2,
        },
        {
          id: "howling_maelstrom",
          timeline: {
            windupSeconds: 0.35,
            activeSeconds: 0.35,
            recoverySeconds: 0.3,
            hitbox: { kind: "wave", range: 8, width: 6 },
            baseDamage: 24,
          },
          weight: 4,
          cooldownSeconds: 3,
        },
        {
          id: "desperate_cyclone_pull",
          timeline: {
            windupSeconds: 0.3,
            activeSeconds: 0.25,
            recoverySeconds: 0.3,
            hitbox: { kind: "projectile", speed: 12, radius: 1.6, maxRange: 12 },
            baseDamage: 22,
          },
          weight: 3,
          cooldownSeconds: 4,
          condition: (ctx) => ctx.distanceToPlayer > 2.5,
        },
        {
          id: "final_hourglass_burst",
          // A desperate, all-or-nothing radial burst — only usable once
          // Geras is himself nearly out of time.
          timeline: {
            windupSeconds: 0.25,
            activeSeconds: 0.2,
            recoverySeconds: 0.4,
            hitbox: { kind: "melee", range: 5, arcDegrees: 360 },
            baseDamage: 30,
          },
          weight: 2,
          cooldownSeconds: 9,
          condition: (ctx) => ctx.currentHealthFraction <= 0.15,
        },
      ],
    },
  ],
};
