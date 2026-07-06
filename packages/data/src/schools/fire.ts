import type { SchoolDefinition } from "@pithos/sim";

/**
 * Fire School (GDD.md §4 — Loimos's Forge, Plague/Fever; tool: flame
 * censer).
 *
 * Passive — **Kindling**: Fire hits stack a smolder on the target; at
 * maximum stacks the buildup detonates, clearing the stacks and scorching
 * everything nearby. The actual stacking/detonation runtime logic belongs
 * to the future combat/status system — this is descriptive data only.
 *
 * Ultimate — **Prometheus's Gift**: a slow, heavily telegraphed falling
 * comet that leaves a lingering firestorm on impact. It's the single
 * biggest hit in the Fire kit (compare `FORM_SOLID.burstOnSwapOut.timeline
 * .baseDamage` of 45, the highest per-Form burst), which is why it sits
 * behind a long cooldown rather than a Form-swap trigger.
 *
 * Per-Form flavor reskins the four shared Form timelines from
 * `packages/data/src/forms.ts` with fire's damage type/VFX/material, per
 * the GDD's own worked example ("Fire+Solid throws obsidian plate"):
 *  - **Solid**  — a slab of obsidian/molten rock, swung or slammed down as
 *    one heavy impact.
 *  - **Liquid** — a flow of magma that coats whatever it touches and keeps
 *    cooking it after the hit lands (carries the Kindling burn).
 *  - **Gas**    — a choking cloud of ash and smoke that lingers and keeps
 *    searing lungs and skin (also carries the Kindling burn).
 *  - **Plasma** — a precise, single-target, white-hot laser bolt — too
 *    fast and surgical to leave a lingering burn behind.
 */
export const SCHOOL_FIRE: SchoolDefinition = {
  id: "fire",
  displayName: "Fire",
  passive: {
    id: "fire_kindling",
    description:
      "Kindling: hits with Fire apply a stacking smolder to the target. At maximum stacks, the buildup detonates, clearing the stacks and scorching everything nearby.",
  },
  ultimate: {
    id: "fire_prometheus_gift",
    // Long cooldown even by ultimate standards — this hits harder than any
    // single Form burst precisely because it's rare.
    cooldownSeconds: 65,
    timeline: {
      // The comet is visible, rising and falling, well before it lands —
      // this is a read-and-react commitment, not a panic button.
      windupSeconds: 2,
      activeSeconds: 0.5,
      recoverySeconds: 1,
      // "a lingering firestorm" reads as a wide footprint the comet leaves
      // behind, not a pinpoint impact — a wave hitbox sells that better
      // than a projectile/beam would.
      hitbox: { kind: "wave", range: 6, width: 6 },
      baseDamage: 95,
    },
    radius: 6,
  },
  flavor: {
    solid: {
      schoolId: "fire",
      formId: "solid",
      damageType: "fire",
      damageMultiplier: 1.05,
      vfxProfileId: "fire_solid",
      materialThemeId: "fire",
    },
    liquid: {
      schoolId: "fire",
      formId: "liquid",
      damageType: "fire",
      damageMultiplier: 1,
      onHitStatus: { statusId: "burning", durationSeconds: 4, magnitude: 4 },
      vfxProfileId: "fire_liquid",
      materialThemeId: "fire",
    },
    gas: {
      schoolId: "fire",
      formId: "gas",
      damageType: "fire",
      damageMultiplier: 0.95,
      onHitStatus: { statusId: "burning", durationSeconds: 3, magnitude: 3 },
      vfxProfileId: "fire_gas",
      materialThemeId: "fire",
    },
    plasma: {
      schoolId: "fire",
      formId: "plasma",
      damageType: "fire",
      damageMultiplier: 1.05,
      vfxProfileId: "fire_plasma",
      materialThemeId: "fire",
    },
  },
};
