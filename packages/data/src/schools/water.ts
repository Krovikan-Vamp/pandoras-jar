import type { FormFlavor, FormId, SchoolDefinition } from "@pithos/sim";

/**
 * Water — Algea's Deep (Pain). GDD.md §4: tool is the ritual flask, passive
 * is Undertow ("hits apply 'Soaked,' amplifying your next elemental proc"),
 * ultimate is Maelstrom ("a whirlpool that pulls enemies in and grinds them
 * down"). Per TECHNICAL_SPEC.md §3, this file owns *flavor* only — the four
 * Forms' shared behavior lives in `forms.ts` (owned by another agent); every
 * entry below reskins those exact same base timelines via `FormFlavor`.
 *
 * Per-Form identity (GDD.md §4's own worked example is "Water+Solid = ice"):
 * Solid is ice/frost armor plate, Liquid is literal flowing water (Water's
 * "home" Form — Liquid's wave-based kit already mirrors Water thematically
 * more than any other School/Form pairing, so it leans in hardest), Gas is a
 * drifting mist/fog cloud, Plasma is a pressurized water-jet beam.
 */

const WATER_FLAVOR: Record<FormId, FormFlavor> = {
  // Ice/frost armor plate. Heavy Solid cleave reads as a frozen limb
  // crashing down; the chill it leaves behind is a mechanical hook for the
  // "Undertow Current" perk (GDD.md §6: "slows also reduce enemy attack
  // speed") without this data file needing to know that perk exists.
  solid: {
    schoolId: "water",
    formId: "solid",
    damageType: "water",
    damageMultiplier: 1.05,
    onHitStatus: { statusId: "water_chilled", durationSeconds: 2.5, magnitude: 0.15 },
    vfxProfileId: "water_solid",
    materialThemeId: "water",
  },
  // Literal flowing water — Water's home Form. The wave hitbox is already
  // Water-native, so this is the flavor entry that leans in hardest: the
  // primary "Soaked" applicator that the Undertow passive and the Tidecaller
  // perk (GDD.md §6) both key off of.
  liquid: {
    schoolId: "water",
    formId: "liquid",
    damageType: "water",
    damageMultiplier: 1.1,
    onHitStatus: { statusId: "water_soaked", durationSeconds: 4, magnitude: 1 },
    vfxProfileId: "water_liquid",
    materialThemeId: "water",
  },
  // Drifting mist/fog cloud. Evasive and obscuring rather than another
  // status-stacking vector — Gas's identity (speed/evasion/DoT) reads best
  // here as "you can't quite see through the fog," not another debuff.
  gas: {
    schoolId: "water",
    formId: "gas",
    damageType: "water",
    damageMultiplier: 0.95,
    vfxProfileId: "water_gas",
    materialThemeId: "water",
  },
  // Pressurized water-jet beam — a thin, high-pressure stream standing in
  // for Plasma's precise bolt. Still drenches whatever it hits, so it also
  // feeds the Soaked/Undertow loop, just via a single-target beam instead of
  // Liquid's wider wave.
  plasma: {
    schoolId: "water",
    formId: "plasma",
    damageType: "water",
    damageMultiplier: 1.0,
    onHitStatus: { statusId: "water_soaked", durationSeconds: 3, magnitude: 1 },
    vfxProfileId: "water_plasma",
    materialThemeId: "water",
  },
};

export const SCHOOL_WATER: SchoolDefinition = {
  id: "water",
  displayName: "Water",
  passive: {
    id: "water_undertow",
    description:
      "Undertow: your hits apply Soaked to enemies, amplifying the next elemental proc that lands on them.",
  },
  // Maelstrom: a whirlpool that pulls enemies in and grinds them down.
  // `AttackTimeline` has no separate DoT-tick field, so the "grinds them
  // down" framing is modeled by a long `activeSeconds` window (a sustained
  // vortex, not an instant burst) rather than the fast, near-instant active
  // windows every Form's burstOnSwapOut uses (0.15-0.2s) — 3 seconds of the
  // whirlpool actually being "on" and dragging enemies through it. baseDamage
  // (65) represents the accumulated total over that window and is kept
  // higher than FORM_SOLID.burstOnSwapOut's 45 (the single biggest one-shot
  // burst in forms.ts) so the ultimate still reads as the strongest hit
  // available, just delivered as a grind instead of a spike.
  ultimate: {
    id: "water_maelstrom",
    cooldownSeconds: 75,
    timeline: {
      windupSeconds: 0.6,
      activeSeconds: 3,
      recoverySeconds: 0.9,
      hitbox: { kind: "wave", range: 7, width: 7 },
      baseDamage: 65,
    },
    radius: 7,
  },
  flavor: WATER_FLAVOR,
};
