import type { FormFlavor, FormId, PassiveEffect, SchoolDefinition, UltimateBehavior } from "@pithos/sim";
import { FORM_IDS } from "@pithos/sim";

/**
 * The Aether School (GDD.md §4 "The Five Schools" — Phthonos's Reach /
 * Envy; TECHNICAL_SPEC.md §3 "School × Form data model"). Tool:
 * astrolabe/prism. Per GDD.md §4's own framing, Aether is "a nice
 * two-for-one: it's both the classical 5th alchemical element and an
 * actual Greek primordial god (bright upper sky)" — the flavor below leans
 * into a cosmic/starlight/prismatic aesthetic deliberately distinct from
 * the other four Schools' more grounded elements (stone, flame, tide,
 * wind). This file owns only *flavor* — the four `FormFlavor` reskins of
 * the School-agnostic `FormDefinition`s in `forms.ts` — plus the School's
 * own `passive`/`ultimate`, which are School-owned (not per-Form) per
 * `SchoolDefinition`.
 *
 * Flavor identity per Form:
 *  - Solid  — crystallized starlight, faceted prism-shard armor plate.
 *  - Liquid — a flowing nebula/stardust wave, light given currents.
 *  - Gas    — a shimmering cosmic dust cloud, glittering rather than choking.
 *  - Plasma — a pure light-beam — Aether's "home" Form: a School built
 *             around Starlight Attunement's echo (fire-twice) pairs
 *             naturally with Plasma's single precise bolt.
 *
 * Two of the four Forms (Solid, Plasma — the tankiest and the glassiest,
 * bookending the kit) carry a shared `aether_starmark` `onHitStatus`: a
 * brief vulnerability mark tying into both the Starlight and Envy framing
 * (Phthonos "marking" what he covets). Liquid and Gas stay clean hits, in
 * keeping with `FormFlavor`'s doc that big changes belong to perks, not
 * flavor, and mirroring how sibling Schools (see `earth.ts`, `water.ts`)
 * only put statuses on a subset of their four Forms.
 */

const AETHER_STARLIGHT_ATTUNEMENT_PASSIVE: PassiveEffect = {
  id: "aether_starlight_attunement",
  description:
    "Starlight Attunement: your abilities have a chance to echo, firing a second time.",
};

// "A gravity well that pulls, then detonates" (GDD.md §4). Aether sits at
// the top of the School hierarchy thematically (the wing fought right
// before the midpoint Kenoma revelation, per GDD.md §2), so this is
// authored as the single most dramatic ultimate in the game: the longest
// windup of any School's ultimate seen so far (sells the "pull" happening
// before the "detonate"), the widest/heaviest hit, and a cooldown toward
// the top of the 45-90s band to match that weight. baseDamage (92) clears
// every other benchmark in scope — FORM_PLASMA.burstOnSwapOut (55),
// SCHOOL_EARTH's Tectonic Shift (75), and SCHOOL_WATER's Maelstrom (65) —
// so Empyrean Collapse reads as unambiguously the hardest-hitting ultimate
// of the five. The `{ kind: "wave", range: 7, width: 7 }` hitbox mirrors
// Maelstrom's own footprint (both are "pull enemies into an AOE" effects)
// but Aether's radius (9) is wider still, selling "gravity well," not just
// "whirlpool."
const AETHER_EMPYREAN_COLLAPSE_ULTIMATE: UltimateBehavior = {
  id: "aether_empyrean_collapse",
  cooldownSeconds: 85,
  timeline: {
    windupSeconds: 1.6,
    activeSeconds: 0.5,
    recoverySeconds: 0.9,
    hitbox: { kind: "wave", range: 7, width: 7 },
    baseDamage: 92,
  },
  radius: 9,
};

const AETHER_FLAVOR: Record<FormId, FormFlavor> = {
  // Crystallized starlight — faceted prism-shard plate standing in for
  // Solid's armor. Slightly harder-hitting than baseline (dense, light-bent
  // crystal), and cracking it against an enemy leaves a lingering "marked"
  // vulnerability — Phthonos's envy made mechanical: what he touches, he
  // fixates on.
  solid: {
    schoolId: "aether",
    formId: "solid",
    damageType: "aether",
    damageMultiplier: 1.05,
    onHitStatus: { statusId: "aether_starmark", durationSeconds: 2.0, magnitude: 0.15 },
    vfxProfileId: "aether_solid",
    materialThemeId: "aether",
  },
  // Flowing nebula/stardust — a wave of drifting cosmic current rather than
  // water or mud. No onHitStatus; a clean, sustaining wave in keeping with
  // Liquid's repositioning identity, not another status-stacking vector.
  liquid: {
    schoolId: "aether",
    formId: "liquid",
    damageType: "aether",
    damageMultiplier: 0.98,
    vfxProfileId: "aether_liquid",
    materialThemeId: "aether",
  },
  // Shimmering cosmic dust cloud — glittering, drifting motes rather than
  // choking dust or fog. Thinner-hitting than the denser Forms, matching
  // Gas's speed/evasion identity across every School.
  gas: {
    schoolId: "aether",
    formId: "gas",
    damageType: "aether",
    damageMultiplier: 0.95,
    vfxProfileId: "aether_gas",
    materialThemeId: "aether",
  },
  // Pure light-beam — Aether's "home" Form. Starlight Attunement's
  // fire-twice echo pairs most naturally with Plasma's single precise
  // bolt, so this gets the School's highest multiplier and the same
  // starmark vulnerability as Solid (shorter duration, sharper magnitude —
  // a precise hit rather than a lingering crack).
  plasma: {
    schoolId: "aether",
    formId: "plasma",
    damageType: "aether",
    damageMultiplier: 1.08,
    onHitStatus: { statusId: "aether_starmark", durationSeconds: 1.5, magnitude: 0.2 },
    vfxProfileId: "aether_plasma",
    materialThemeId: "aether",
  },
};

export const SCHOOL_AETHER: SchoolDefinition = {
  id: "aether",
  displayName: "Aether",
  passive: AETHER_STARLIGHT_ATTUNEMENT_PASSIVE,
  ultimate: AETHER_EMPYREAN_COLLAPSE_ULTIMATE,
  flavor: AETHER_FLAVOR,
};

// Defensive, load-bearing check (mirrors `forms.test.ts`'s intent and
// `schools/earth.ts`'s precedent): if a future edit to `FORM_IDS` or a
// typo'd key here ever desyncs the flavor map from the full FormId set,
// fail loudly at module-load time rather than silently shipping an
// incomplete `SchoolDefinition`.
for (const formId of FORM_IDS) {
  if (SCHOOL_AETHER.flavor[formId] === undefined) {
    throw new Error(`SCHOOL_AETHER.flavor is missing an entry for FormId "${formId}"`);
  }
}
