import type { FormFlavor, FormId, SchoolDefinition } from "@pithos/sim";
import { FORM_IDS } from "@pithos/sim";

/**
 * The Air School (GDD.md §4 "Air" row — Geras's Spire, Old Age; tool: twin
 * wind-fans). Per TECHNICAL_SPEC.md §3, this is pure *flavor* layered on top
 * of the four School-agnostic `FormDefinition`s in `../forms.ts` — Air never
 * redefines timings/hitboxes, only damage type, minor multipliers, VFX/
 * material keys, and (for some Forms) a light on-hit status tying back into
 * Air's mobility/disruption identity.
 *
 * Per the GDD's own example ("Air+Gas is a true windstorm"), Gas is Air's
 * "home" Form and leans in hardest — highest damageMultiplier of the four,
 * and the clearest on-theme on-hit status (a gale knockback).
 */

const AIR_SOLID_FLAVOR: FormFlavor = {
  schoolId: "air",
  formId: "solid",
  damageType: "air",
  // Compressed-air / hardened-wind slab: Solid is the least "at home" Form
  // for a School built around speed and evasion, so it sits just under 1.0.
  damageMultiplier: 0.95,
  // The concussive slam of a hardened-wind slab briefly staggers on impact —
  // flavor-scale knockback, not a perk-tier effect.
  onHitStatus: { statusId: "air_compressed_stagger", durationSeconds: 0.35, magnitude: 3 },
  vfxProfileId: "air_solid",
  materialThemeId: "air",
};

const AIR_LIQUID_FLAVOR: FormFlavor = {
  schoolId: "air",
  formId: "liquid",
  damageType: "air",
  // Arcing wind-blade wave: a clean, precise cut rather than a disruptive
  // hit, so no on-hit status — the "flowing" identity reads as accuracy,
  // not crowd control.
  damageMultiplier: 1.0,
  vfxProfileId: "air_liquid",
  materialThemeId: "air",
};

const AIR_GAS_FLAVOR: FormFlavor = {
  schoolId: "air",
  formId: "gas",
  damageType: "air",
  // Air's home Form — a literal windstorm (GDD.md §4's own example pairing).
  // Highest multiplier of the four Air flavors.
  damageMultiplier: 1.1,
  // Every gust of the spread cloud shoves its target — a light, stacking-
  // feeling gale knockback that sells "windstorm" without being a perk.
  onHitStatus: { statusId: "air_gale_knockback", durationSeconds: 0.3, magnitude: 4 },
  vfxProfileId: "air_gas",
  materialThemeId: "air",
};

const AIR_PLASMA_FLAVOR: FormFlavor = {
  schoolId: "air",
  formId: "plasma",
  damageType: "air",
  // Wind + friction = static: a lightning/static-charged bolt, a natural
  // Air/Plasma pairing per the brief.
  damageMultiplier: 1.0,
  // A brief static jolt on the bolt's target — modest, flavor-scale, echoing
  // the same disruption theme as Tailwind/Solid's stagger.
  onHitStatus: { statusId: "air_static_jolt", durationSeconds: 0.4, magnitude: 2 },
  vfxProfileId: "air_plasma",
  materialThemeId: "air",
};

const AIR_FLAVOR: Record<FormId, FormFlavor> = {
  solid: AIR_SOLID_FLAVOR,
  liquid: AIR_LIQUID_FLAVOR,
  gas: AIR_GAS_FLAVOR,
  plasma: AIR_PLASMA_FLAVOR,
};

// Belt-and-suspenders against a typo'd/missing key slipping past the
// `Record<FormId, FormFlavor>` literal check — mirrors the intent of
// `assertCompleteFlavorMap` (packages/sim/src/combat/resolveAttack.ts)
// at module-definition time.
for (const formId of FORM_IDS) {
  if (AIR_FLAVOR[formId].formId !== formId) {
    throw new Error(`SCHOOL_AIR: flavor entry for "${formId}" has mismatched formId`);
  }
}

export const SCHOOL_AIR: SchoolDefinition = {
  id: "air",
  displayName: "Air",
  passive: {
    id: "air_tailwind",
    // GDD.md §4: "landing a hit grants brief, stacking move/attack speed."
    // The actual stacking speed mechanic is future combat-runtime work —
    // this is descriptive data only.
    description:
      "Tailwind: landing a hit grants a brief, stacking boost to move speed and attack speed.",
  },
  ultimate: {
    id: "air_aeolus_wrath",
    // Mid-range of the 45-90s band — a strong panic button/reset, not a
    // spammable cooldown.
    cooldownSeconds: 65,
    // A cyclone that forms, lingers, then disperses: telegraphed windup,
    // a sustained active window (it's a standing vortex, not a single
    // swing), wide wave hitbox to sell "cyclone." "Launches and disorients"
    // (GDD.md §4) is modeled purely through flavor/damage here — there is
    // no onHitStatus field on UltimateBehavior to hang a real status off of.
    timeline: {
      windupSeconds: 0.6,
      activeSeconds: 1.0,
      recoverySeconds: 0.7,
      hitbox: { kind: "wave", range: 8, width: 8 },
      // Higher than FORM_SOLID.burstOnSwapOut.timeline.baseDamage (45) —
      // this is the School Ultimate, meant to hit harder than any single
      // Form's charge-release burst.
      baseDamage: 70,
    },
    radius: 8,
  },
  flavor: AIR_FLAVOR,
};
