import type { BossDefinition } from "@pithos/sim";

/**
 * Algea, Spite of Pain — Water's Spite (GDD.md §4 "Algea's Deep (Pain)",
 * §11). Per GDD.md §2, the Spites are written as tragic and sympathetic, not
 * villainous: they didn't choose what they were freed to do. Algea didn't
 * choose to hurt anyone; she simply *is* pain, and the world above has
 * spent every generation since flinching from her, which is the loneliest
 * thing a being can be freed into. All attack patterns reuse the same
 * `AttackTimeline` shape player attacks use (TECHNICAL_SPEC.md §3), flavored
 * as surging tides, drowning grabs, and pressurized jets.
 */

export const BOSS_ALGEA: BossDefinition = {
  id: "algea",
  displayName: "Algea",
  epithet: "Algea, Spite of Pain",
  loreDescription:
    "Algea never wanted to hurt anyone — she simply is pain, given shape the moment she was let loose, " +
    "and every hand that ever touched her recoiled. Alone at the bottom of a flooded hall for centuries, " +
    "she has learned to read every visitor as another flinch waiting to happen, and drowns them before " +
    "they can flinch first.",
  maxHealth: 850,
  phases: [
    {
      id: "phase_tidal_grief",
      hpThreshold: 1,
      attackPatterns: [
        {
          id: "algea_surging_tide",
          weight: 5,
          cooldownSeconds: 4,
          timeline: {
            windupSeconds: 0.5,
            activeSeconds: 0.3,
            recoverySeconds: 0.5,
            hitbox: { kind: "wave", range: 6, width: 4 },
            baseDamage: 24,
          },
        },
        {
          id: "algea_drowning_grasp",
          weight: 3,
          cooldownSeconds: 6,
          // Only lunges into a close-range grab once the player is actually
          // in reach — otherwise she leans on the ranged tide/lash options.
          condition: (ctx) => ctx.distanceToPlayer <= 3,
          timeline: {
            windupSeconds: 0.6,
            activeSeconds: 0.2,
            recoverySeconds: 0.6,
            hitbox: { kind: "melee", range: 2.5, arcDegrees: 90 },
            baseDamage: 30,
          },
        },
        {
          id: "algea_brine_lash",
          weight: 2,
          cooldownSeconds: 5,
          timeline: {
            windupSeconds: 0.35,
            activeSeconds: 0.15,
            recoverySeconds: 0.4,
            hitbox: { kind: "projectile", speed: 16, radius: 0.4, maxRange: 10 },
            baseDamage: 18,
          },
        },
      ],
    },
    {
      id: "phase_riptide_fury",
      hpThreshold: 0.6,
      attackPatterns: [
        {
          id: "algea_riptide_pull",
          weight: 4,
          cooldownSeconds: 7,
          timeline: {
            windupSeconds: 0.5,
            activeSeconds: 0.4,
            recoverySeconds: 0.5,
            hitbox: { kind: "wave", range: 7, width: 5 },
            baseDamage: 22,
          },
        },
        {
          id: "algea_pressurized_jet",
          weight: 4,
          cooldownSeconds: 5,
          // The high-pressure jet is a poke for when the player kept their
          // distance — up close she'd rather grasp than line up a beam.
          condition: (ctx) => ctx.distanceToPlayer > 4,
          timeline: {
            windupSeconds: 0.4,
            activeSeconds: 0.1,
            recoverySeconds: 0.3,
            hitbox: { kind: "beam", length: 9, width: 0.6 },
            baseDamage: 34,
          },
        },
        {
          id: "algea_surging_tide_ii",
          weight: 3,
          cooldownSeconds: 3.5,
          timeline: {
            windupSeconds: 0.45,
            activeSeconds: 0.3,
            recoverySeconds: 0.45,
            hitbox: { kind: "wave", range: 6, width: 4 },
            baseDamage: 28,
          },
        },
        {
          id: "algea_drowning_grasp_ii",
          weight: 2,
          cooldownSeconds: 5,
          condition: (ctx) => ctx.distanceToPlayer <= 3,
          timeline: {
            windupSeconds: 0.5,
            activeSeconds: 0.2,
            recoverySeconds: 0.5,
            hitbox: { kind: "melee", range: 2.5, arcDegrees: 90 },
            baseDamage: 36,
          },
        },
      ],
    },
    {
      id: "phase_drowning_despair",
      hpThreshold: 0.25,
      attackPatterns: [
        {
          id: "algea_maelstrom_collapse",
          weight: 6,
          cooldownSeconds: 6,
          timeline: {
            windupSeconds: 0.7,
            activeSeconds: 1.2,
            recoverySeconds: 0.8,
            hitbox: { kind: "wave", range: 8, width: 8 },
            baseDamage: 55,
          },
        },
        {
          id: "algea_tsunami_wail",
          weight: 5,
          cooldownSeconds: 8,
          // A last, desperate wail she only lets out once the fight has
          // dragged on and she's cornered, grief boiling over into rage.
          condition: (ctx) => ctx.elapsedSeconds > 15,
          timeline: {
            windupSeconds: 0.9,
            activeSeconds: 0.4,
            recoverySeconds: 0.7,
            hitbox: { kind: "wave", range: 9, width: 9 },
            baseDamage: 48,
          },
        },
        {
          id: "algea_pressurized_jet_ii",
          weight: 3,
          cooldownSeconds: 3,
          timeline: {
            windupSeconds: 0.3,
            activeSeconds: 0.1,
            recoverySeconds: 0.25,
            hitbox: { kind: "beam", length: 9, width: 0.6 },
            baseDamage: 40,
          },
        },
        {
          id: "algea_drowning_grasp_iii",
          weight: 3,
          cooldownSeconds: 3.5,
          condition: (ctx) => ctx.distanceToPlayer <= 3,
          timeline: {
            windupSeconds: 0.4,
            activeSeconds: 0.2,
            recoverySeconds: 0.4,
            hitbox: { kind: "melee", range: 2.5, arcDegrees: 100 },
            baseDamage: 42,
          },
        },
      ],
    },
  ],
};
