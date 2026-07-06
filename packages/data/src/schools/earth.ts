import type { FormFlavor, FormId, PassiveEffect, SchoolDefinition, UltimateBehavior } from "@pithos/sim";

/**
 * The Earth School (GDD.md §4 "The Five Schools" — Ponos's Hollow / Toil;
 * TECHNICAL_SPEC.md §3 "School × Form data model"). Tool: living stone
 * gauntlets. This file owns only *flavor* — the four `FormFlavor` reskins
 * of the School-agnostic `FormDefinition`s in `forms.ts` — plus the
 * School's own `passive`/`ultimate`, which are School-owned (not
 * per-Form) per `SchoolDefinition`.
 *
 * Flavor identity per Form (GDD.md §4: "Earth+Gas is a choking dust
 * cloud" is the explicit worked example this file is built around):
 *  - Solid  — jagged living-stone plate, the gauntlets' armor made manifest.
 *  - Liquid — wet clay/mud, a viscous flow rather than water.
 *  - Gas    — a choking dust cloud (the GDD's own example combo).
 *  - Plasma — crystalline/geode shard beam, light refracted through rock.
 *
 * `damageMultiplier`s are kept close to 1.0 on purpose — per
 * `FormFlavor`'s doc, "big changes belong to perks, not flavor." The two
 * heavier/denser Forms (Solid, Plasma) lean fractionally above 1.0, the two
 * looser/diffuse Forms (Liquid, Gas) fractionally below — flavor-only
 * variance, not a build-defining spread.
 */

const EARTH_STONESKIN_PASSIVE: PassiveEffect = {
  id: "earth_stoneskin",
  description:
    "Stoneskin: damage reduction that stacks the longer you hold your ground, or the more hits you take.",
};

// "Delayed eruption of stone spikes in a wide radius" (GDD.md §4). Long,
// readable windup to sell the "delayed" framing, a very wide 360-degree
// melee hitbox to sell "wide radius," and a cooldown toward the rare/
// impactful end of the ultimate band. baseDamage (75) clears both
// FORM_SOLID.burstOnSwapOut (45) and FORM_PLASMA.burstOnSwapOut (55) —
// the floor set for "hit noticeably harder than a Form's burst."
const EARTH_TECTONIC_SHIFT_ULTIMATE: UltimateBehavior = {
  id: "earth_tectonic_shift",
  cooldownSeconds: 70,
  timeline: {
    windupSeconds: 1.4,
    activeSeconds: 0.5,
    recoverySeconds: 0.8,
    hitbox: { kind: "melee", range: 8, arcDegrees: 360 },
    baseDamage: 75,
  },
  radius: 8,
};

const EARTH_FLAVOR: Record<FormId, FormFlavor> = {
  // Jagged living-stone plate — the gauntlets' own armor extending over the
  // whole body. Slightly harder-hitting than baseline (dense stone), and
  // its cleave has a chance to catch enemies in the stagger a lump of
  // living rock leaves behind.
  solid: {
    schoolId: "earth",
    formId: "solid",
    damageType: "earth",
    damageMultiplier: 1.08,
    onHitStatus: { statusId: "earth_petrify_stagger", durationSeconds: 0.35, magnitude: 1 },
    vfxProfileId: "earth_solid",
    materialThemeId: "earth",
  },
  // Wet clay/mud rather than water — a heavy, viscous flow that clings to
  // whatever it touches and slows it down.
  liquid: {
    schoolId: "earth",
    formId: "liquid",
    damageType: "earth",
    damageMultiplier: 0.97,
    onHitStatus: { statusId: "earth_mired", durationSeconds: 1.2, magnitude: 0.25 },
    vfxProfileId: "earth_liquid",
    materialThemeId: "earth",
  },
  // The GDD's own worked example: "Earth+Gas is a choking dust cloud."
  // Thinner/lighter-hitting than the solid Forms (it's dust, not rock),
  // but the cloud leaves anything caught in it coughing and half-blind.
  gas: {
    schoolId: "earth",
    formId: "gas",
    damageType: "earth",
    damageMultiplier: 0.95,
    onHitStatus: { statusId: "earth_dust_choke", durationSeconds: 1.5, magnitude: 0.15 },
    vfxProfileId: "earth_gas",
    materialThemeId: "earth",
  },
  // Crystalline geode shard beam — light refracted and focused through
  // quartz/gem-studded rock instead of raw energy. A clean, precise hit
  // with no lingering status, matching Plasma's single-target-precision
  // identity.
  plasma: {
    schoolId: "earth",
    formId: "plasma",
    damageType: "earth",
    damageMultiplier: 1.05,
    vfxProfileId: "earth_plasma",
    materialThemeId: "earth",
  },
};

// Typed as `Record<FormId, FormFlavor>` above, so a missing/typo'd key is
// already a compile-time error (TS requires every mapped-type key to be
// present) — no separate runtime completeness check is needed on top of
// that, matching how `forms.ts`/`ALL_FORMS` relies on the same guarantee.
export const SCHOOL_EARTH: SchoolDefinition = {
  id: "earth",
  displayName: "Earth",
  passive: EARTH_STONESKIN_PASSIVE,
  ultimate: EARTH_TECTONIC_SHIFT_ULTIMATE,
  flavor: EARTH_FLAVOR,
};
