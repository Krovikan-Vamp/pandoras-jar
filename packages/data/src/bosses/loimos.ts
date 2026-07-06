import type { BossDefinition } from "@pithos/sim";

/**
 * Loimos, Spite of Plague — the Fire wing boss (GDD.md §4 "Loimos's Forge
 * (Plague/Fever)"; §11 "Loimos (Plague) | Fire | Hope Fragment II").
 *
 * Per GDD.md §2, the Spites are written as tragic and sympathetic rather
 * than villainous ("Ponos, Toil, is exhausted by his own endless labor").
 * Loimos is written the same way: he isn't malicious, he's a fever that
 * never breaks, sickening everyone and everything around him — including
 * himself — as a condition he never chose and can't shed. Defeating him
 * frees him from that compulsion rather than destroying him.
 *
 * Three phases (100% / 60% / 25% HP): each phase adds patterns and tightens
 * cooldowns/raises weights on the more aggressive moves so the fight reads
 * as increasingly frantic and fever-pitched as Loimos loses ground — the
 * "enrage" phase's `loimos_last_ember` is a rare, desperate flare gated by
 * a `condition` on very low HP, framed as his last burst before the fever
 * finally breaks.
 *
 * Deviation note: the GDD's Plague/Fever theme calls for DoT/"sickness"
 * application on hit, and `FormFlavor`/`AbilityScript` both support an
 * `onHitStatus` field for exactly that — but `AttackPattern` (this file's
 * contract, `packages/sim/src/bosses/types.ts`) currently has no
 * `onHitStatus` field of its own (only `id`/`timeline`/`weight`/
 * `cooldownSeconds`/`condition`), and `AttackTimeline` doesn't carry one
 * either. Rather than inventing a field the shared contract doesn't
 * define, the Plague theme is carried here through naming
 * (`loimos_fevered_cough`, `loimos_plague_volley`, `loimos_plague_storm`,
 * ...), pattern selection (frequent, medium-damage ranged casts rather
 * than one big hit), and `loreDescription`/`epithet`. If/when
 * `AttackPattern` gains status-application support, these patterns are the
 * natural place to wire an actual `burning`/sickness status through.
 */
export const BOSS_LOIMOS: BossDefinition = {
  id: "loimos",
  displayName: "Loimos",
  epithet: "Loimos, Spite of Plague",
  loreDescription:
    "Loimos never asked to be Plague — he was hollowed out and refilled with a fever that never breaks, and now everything he touches sickens whether he wills it or not. He forges alone in the dark not out of cruelty but because it's the only way he's found to keep the contagion from spreading further than it already has.",
  maxHealth: 850,
  phases: [
    {
      id: "phase1",
      hpThreshold: 1,
      attackPatterns: [
        {
          id: "loimos_fevered_cough",
          timeline: {
            windupSeconds: 0.4,
            activeSeconds: 0.15,
            recoverySeconds: 0.4,
            hitbox: { kind: "projectile", speed: 12, radius: 0.4, maxRange: 10 },
            baseDamage: 16,
          },
          weight: 5,
          cooldownSeconds: 4,
        },
        {
          id: "loimos_censer_sweep",
          timeline: {
            windupSeconds: 0.5,
            activeSeconds: 0.25,
            recoverySeconds: 0.5,
            hitbox: { kind: "melee", range: 2.5, arcDegrees: 180 },
            baseDamage: 30,
          },
          weight: 4,
          cooldownSeconds: 6,
        },
        {
          id: "loimos_ash_bloom",
          timeline: {
            windupSeconds: 0.6,
            activeSeconds: 0.3,
            recoverySeconds: 0.5,
            hitbox: { kind: "wave", range: 5, width: 4 },
            baseDamage: 24,
          },
          weight: 3,
          cooldownSeconds: 8,
          // Only bothers with the ranged ash bloom when the player isn't
          // already in his face — up close, the censer sweep is the better pick.
          condition: (ctx) => ctx.distanceToPlayer > 3,
        },
      ],
    },
    {
      id: "phase2",
      hpThreshold: 0.6,
      attackPatterns: [
        {
          id: "loimos_plague_volley",
          timeline: {
            windupSeconds: 0.3,
            activeSeconds: 0.1,
            recoverySeconds: 0.3,
            hitbox: { kind: "projectile", speed: 16, radius: 0.4, maxRange: 12 },
            baseDamage: 20,
          },
          weight: 5,
          cooldownSeconds: 3,
        },
        {
          id: "loimos_censer_frenzy",
          timeline: {
            windupSeconds: 0.4,
            activeSeconds: 0.3,
            recoverySeconds: 0.4,
            hitbox: { kind: "melee", range: 2.5, arcDegrees: 220 },
            baseDamage: 38,
          },
          weight: 4,
          cooldownSeconds: 5,
        },
        {
          id: "loimos_fever_eruption",
          timeline: {
            windupSeconds: 1,
            activeSeconds: 0.3,
            recoverySeconds: 0.6,
            hitbox: { kind: "beam", length: 9, width: 1.5 },
            baseDamage: 48,
          },
          weight: 3,
          cooldownSeconds: 10,
          // The dramatic jet of flame only fires when the player is actually
          // within its reach — no point telegraphing a beam that whiffs.
          condition: (ctx) => ctx.distanceToPlayer <= 9,
        },
        {
          id: "loimos_wretched_lunge",
          timeline: {
            windupSeconds: 0.25,
            activeSeconds: 0.15,
            recoverySeconds: 0.3,
            hitbox: { kind: "melee", range: 2, arcDegrees: 90 },
            baseDamage: 26,
          },
          weight: 3,
          cooldownSeconds: 5,
          // Closes distance when the player is kiting him at range.
          condition: (ctx) => ctx.distanceToPlayer > 4,
        },
      ],
    },
    {
      id: "phase3",
      hpThreshold: 0.25,
      attackPatterns: [
        {
          id: "loimos_plague_storm",
          timeline: {
            windupSeconds: 1.2,
            activeSeconds: 0.4,
            recoverySeconds: 0.8,
            hitbox: { kind: "wave", range: 7, width: 7 },
            baseDamage: 58,
          },
          weight: 4,
          cooldownSeconds: 9,
        },
        {
          id: "loimos_censer_maelstrom",
          timeline: {
            windupSeconds: 0.35,
            activeSeconds: 0.25,
            recoverySeconds: 0.4,
            hitbox: { kind: "melee", range: 3, arcDegrees: 360 },
            baseDamage: 42,
          },
          weight: 5,
          cooldownSeconds: 4,
        },
        {
          id: "loimos_fever_barrage",
          timeline: {
            windupSeconds: 0.2,
            activeSeconds: 0.1,
            recoverySeconds: 0.2,
            hitbox: { kind: "projectile", speed: 18, radius: 0.35, maxRange: 11 },
            baseDamage: 22,
          },
          weight: 6,
          cooldownSeconds: 2,
        },
        {
          id: "loimos_last_ember",
          timeline: {
            windupSeconds: 1.5,
            activeSeconds: 0.3,
            recoverySeconds: 1,
            hitbox: { kind: "beam", length: 10, width: 2 },
            baseDamage: 68,
          },
          weight: 2,
          cooldownSeconds: 15,
          // A rare, desperate flare he only throws out once he's nearly spent.
          condition: (ctx) => ctx.currentHealthFraction < 0.15,
        },
      ],
    },
  ],
};
