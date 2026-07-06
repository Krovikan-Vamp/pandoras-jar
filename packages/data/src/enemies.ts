import type { EnemyDefinition } from "@pithos/sim";

/**
 * Trash-mob enemy roster (GDD.md §10 "Enemy Roster"). Consumed by
 * `RoomSpawnMarker.enemyPoolTags` (packages/sim/src/procgen/types.ts) across
 * the five wing room pools (`rooms/{earth,fire,water,air,aether}.ts`),
 * resolved at runtime as an AND-match against `EnemyDefinition.tags`.
 *
 * Tagging convention (`tags: string[]` = `[category, ...biomeIds]`), matched
 * exactly against what the five room files already request:
 *  - `elemental_wildlife` — one biome tag each (GDD's named examples: stone
 *    golems/Earth, magma worms/Fire, drowned wraiths/Water, wind wisps/Air,
 *    plus an Aether-appropriate original and forward-looking `"confluence"`
 *    -tagged "void-touched horrors" — see note near those entries).
 *  - `homunculus` — deliberately **no** biome tag; GDD.md §10 has them
 *    "appear as lab variants across every wing," and several already-landed
 *    room files request exactly `["homunculus"]` with no biome qualifier.
 *  - `undead` — **only** `["undead", "air"]` and `["undead", "fire"]`, per
 *    GDD.md §10 concentrating undead in Geras's Spire (Air) and Loimos's
 *    Forge (Fire) specifically. No earth/water/aether undead.
 *  - `rival_alchemist` — one per biome (5 total), "human enemies running
 *    their own School/Form kits; strong mid-tier variety" per GDD.md §10.
 *
 * Scope decision / deliberate simplification: `EnemyDefinition` (unlike
 * `SchoolDefinition`) only carries a single `attack: AttackTimeline` — there
 * is no per-Form kit, Flux/Charge, or `resolveAttack` wiring for trash mobs;
 * that richness is reserved for the player's School×Form system
 * (packages/sim/src/combat/resolveAttack.ts). Rival alchemists below are
 * therefore modeled as a *single* attack that reads thematically like their
 * biome's School/Form (e.g. the Fire rival alchemist's attack is shaped like
 * a small fireball projectile), rather than literally invoking a School's
 * flavor/Form kit.
 *
 * Damage tuning: `forms.ts` documents player primary hits landing in the
 * 8 (Gas) - 38 (Plasma) base damage range. Per this package's authoring
 * brief, trash mobs should generally hit for *less* than the player's
 * weakest primary (8) per hit, since players typically face several at
 * once — most entries below sit in the 2-7 range, with a couple of the
 * "strong mid-tier" rival alchemists allowed to nudge up to 8-9 as the
 * deliberate top of the trash-mob curve.
 */

// ---------------------------------------------------------------------------
// Elemental wildlife — one per real biome, GDD.md §10's named examples.
// ---------------------------------------------------------------------------

export const ENEMY_STONE_GOLEM: EnemyDefinition = {
  id: "stone_golem",
  displayName: "Stone Golem",
  category: "elemental_wildlife",
  tags: ["elemental_wildlife", "earth"],
  maxHealth: 90,
  moveSpeed: 3.0,
  attack: {
    windupSeconds: 0.6,
    activeSeconds: 0.25,
    recoverySeconds: 0.6,
    hitbox: { kind: "melee", range: 2, arcDegrees: 100 },
    baseDamage: 7,
  },
};

export const ENEMY_MAGMA_WORM: EnemyDefinition = {
  id: "magma_worm",
  displayName: "Magma Worm",
  category: "elemental_wildlife",
  tags: ["elemental_wildlife", "fire"],
  maxHealth: 45,
  moveSpeed: 4.5,
  attack: {
    windupSeconds: 0.5,
    activeSeconds: 0.15,
    recoverySeconds: 0.5,
    hitbox: { kind: "projectile", speed: 8, radius: 0.4, maxRange: 6 },
    baseDamage: 6,
  },
};

export const ENEMY_DROWNED_WRAITH: EnemyDefinition = {
  id: "drowned_wraith",
  displayName: "Drowned Wraith",
  category: "elemental_wildlife",
  tags: ["elemental_wildlife", "water"],
  maxHealth: 40,
  moveSpeed: 4.0,
  attack: {
    windupSeconds: 0.4,
    activeSeconds: 0.2,
    recoverySeconds: 0.4,
    hitbox: { kind: "wave", range: 3, width: 1.5 },
    baseDamage: 6,
  },
};

export const ENEMY_WIND_WISP: EnemyDefinition = {
  id: "wind_wisp",
  displayName: "Wind Wisp",
  category: "elemental_wildlife",
  tags: ["elemental_wildlife", "air"],
  // Fast, erratic flier — individually weak, dangerous in numbers.
  maxHealth: 22,
  moveSpeed: 8.0,
  attack: {
    windupSeconds: 0.2,
    activeSeconds: 0.1,
    recoverySeconds: 0.25,
    hitbox: { kind: "melee", range: 1.2, arcDegrees: 80 },
    baseDamage: 4,
  },
};

export const ENEMY_STARGLASS_WISP: EnemyDefinition = {
  id: "starglass_wisp",
  displayName: "Starglass Wisp",
  category: "elemental_wildlife",
  // Aether's biome-native equivalent — GDD.md §10 only names the other four
  // explicitly plus "void-touched horrors in the Confluence"; this is an
  // original Aether-appropriate entry (prismatic/starlit, per the brief).
  tags: ["elemental_wildlife", "aether"],
  maxHealth: 30,
  moveSpeed: 7.0,
  attack: {
    windupSeconds: 0.3,
    activeSeconds: 0.1,
    recoverySeconds: 0.3,
    hitbox: { kind: "projectile", speed: 12, radius: 0.25, maxRange: 8 },
    baseDamage: 5,
  },
};

// ---------------------------------------------------------------------------
// Confluence-tagged elemental wildlife — forward-looking only. GDD.md §10
// names "void-touched horrors in the Confluence" as a distinct entry, but no
// Confluence room pool exists yet (GDD.md §9: it unlocks after all five
// Fragments, future content). Nothing in the current room files spawns
// these — `["elemental_wildlife", "confluence"]` isn't requested by any of
// the five landed room pools. Authored now so Confluence room-authoring
// later has a roster to draw from without touching this file again.
// ---------------------------------------------------------------------------

export const ENEMY_VOIDLING: EnemyDefinition = {
  id: "confluence_voidling",
  displayName: "Voidling",
  category: "elemental_wildlife",
  tags: ["elemental_wildlife", "confluence"],
  maxHealth: 20,
  moveSpeed: 9.0,
  attack: {
    windupSeconds: 0.15,
    activeSeconds: 0.1,
    recoverySeconds: 0.2,
    hitbox: { kind: "melee", range: 1, arcDegrees: 90 },
    baseDamage: 4,
  },
};

export const ENEMY_HOLLOW_WRETCH: EnemyDefinition = {
  id: "confluence_hollow_wretch",
  displayName: "Hollow Wretch",
  category: "elemental_wildlife",
  tags: ["elemental_wildlife", "confluence"],
  maxHealth: 55,
  moveSpeed: 5.0,
  attack: {
    windupSeconds: 0.4,
    activeSeconds: 0.2,
    recoverySeconds: 0.4,
    hitbox: { kind: "wave", range: 3.5, width: 2 },
    baseDamage: 7,
  },
};

export const ENEMY_NULL_HORROR: EnemyDefinition = {
  id: "confluence_null_horror",
  displayName: "Null Horror",
  category: "elemental_wildlife",
  tags: ["elemental_wildlife", "confluence"],
  maxHealth: 75,
  moveSpeed: 3.5,
  attack: {
    windupSeconds: 0.5,
    activeSeconds: 0.1,
    recoverySeconds: 0.5,
    hitbox: { kind: "beam", length: 6, width: 0.4 },
    baseDamage: 8,
  },
};

// ---------------------------------------------------------------------------
// Homunculi — "failed alchemical creations," no biome tag (appear as lab
// variants across every wing, per GDD.md §10). Deliberately cheap/numerous:
// low HP, low damage — several already-landed rooms spawn 2-3 at once.
// ---------------------------------------------------------------------------

export const ENEMY_HOMUNCULUS_HUSK: EnemyDefinition = {
  id: "homunculus_husk",
  displayName: "Homunculus Husk",
  category: "homunculus",
  tags: ["homunculus"],
  maxHealth: 18,
  moveSpeed: 3.5,
  attack: {
    windupSeconds: 0.3,
    activeSeconds: 0.15,
    recoverySeconds: 0.35,
    hitbox: { kind: "melee", range: 1, arcDegrees: 90 },
    baseDamage: 3,
  },
};

export const ENEMY_HOMUNCULUS_SKITTERLING: EnemyDefinition = {
  id: "homunculus_skitterling",
  displayName: "Homunculus Skitterling",
  category: "homunculus",
  tags: ["homunculus"],
  // Cheapest, fastest, weakest of the lab variants — a swarming nuisance.
  maxHealth: 10,
  moveSpeed: 6.5,
  attack: {
    windupSeconds: 0.15,
    activeSeconds: 0.1,
    recoverySeconds: 0.2,
    hitbox: { kind: "melee", range: 0.8, arcDegrees: 70 },
    baseDamage: 2,
  },
};

export const ENEMY_HOMUNCULUS_LOBBER: EnemyDefinition = {
  id: "homunculus_lobber",
  displayName: "Homunculus Lobber",
  category: "homunculus",
  tags: ["homunculus"],
  // A failed alchemical flask-lobber — weak ranged pressure, still fodder.
  maxHealth: 15,
  moveSpeed: 3.0,
  attack: {
    windupSeconds: 0.5,
    activeSeconds: 0.15,
    recoverySeconds: 0.5,
    hitbox: { kind: "projectile", speed: 7, radius: 0.3, maxRange: 6 },
    baseDamage: 4,
  },
};

export const ENEMY_HOMUNCULUS_BLOATED: EnemyDefinition = {
  id: "homunculus_bloated",
  displayName: "Bloated Homunculus",
  category: "homunculus",
  tags: ["homunculus"],
  // Bigger HP pool as a slow "meat shield" variant, but still hits weakly.
  maxHealth: 35,
  moveSpeed: 2.0,
  attack: {
    windupSeconds: 0.45,
    activeSeconds: 0.2,
    recoverySeconds: 0.5,
    hitbox: { kind: "melee", range: 1.3, arcDegrees: 100 },
    baseDamage: 3,
  },
};

// ---------------------------------------------------------------------------
// Undead — only Air (Geras's Spire) and Fire (Loimos's Forge), per GDD.md
// §10. No earth/water/aether undead entries by design.
// ---------------------------------------------------------------------------

export const ENEMY_WAILING_REVENANT: EnemyDefinition = {
  id: "wailing_revenant",
  displayName: "Wailing Revenant",
  category: "undead",
  tags: ["undead", "air"],
  // Old-Age-cursed dead of Geras's Spire — drifts rather than strides.
  maxHealth: 45,
  moveSpeed: 3.0,
  attack: {
    windupSeconds: 0.5,
    activeSeconds: 0.25,
    recoverySeconds: 0.5,
    hitbox: { kind: "wave", range: 4, width: 2 },
    baseDamage: 6,
  },
};

export const ENEMY_CHARNEL_GHOUL: EnemyDefinition = {
  id: "charnel_ghoul",
  displayName: "Charnel Ghoul",
  category: "undead",
  tags: ["undead", "fire"],
  // Plague-rotten dead of Loimos's Forge — slow shambling melee.
  maxHealth: 50,
  moveSpeed: 2.5,
  attack: {
    windupSeconds: 0.5,
    activeSeconds: 0.2,
    recoverySeconds: 0.55,
    hitbox: { kind: "melee", range: 1.3, arcDegrees: 100 },
    baseDamage: 6,
  },
};

// ---------------------------------------------------------------------------
// Rival alchemists — one per biome, "human enemies running their own
// School/Form kits; strong mid-tier variety" (GDD.md §10). See the
// file-level doc for the single-`attack` simplification: each is modeled as
// one attack thematically flavored like their biome's School/Form, not a
// literal `resolveAttack` invocation.
// ---------------------------------------------------------------------------

export const ENEMY_EARTHEN_ADEPT: EnemyDefinition = {
  id: "earthen_adept",
  displayName: "Earthen Adept",
  category: "rival_alchemist",
  tags: ["rival_alchemist", "earth"],
  // Reads like a Solid-Form devotee: heavy, close, committal stomp.
  maxHealth: 65,
  moveSpeed: 4.5,
  attack: {
    windupSeconds: 0.4,
    activeSeconds: 0.2,
    recoverySeconds: 0.45,
    hitbox: { kind: "melee", range: 1.8, arcDegrees: 110 },
    baseDamage: 8,
  },
};

export const ENEMY_ASHBORN_PYROMANCER: EnemyDefinition = {
  id: "ashborn_pyromancer",
  displayName: "Ashborn Pyromancer",
  category: "rival_alchemist",
  tags: ["rival_alchemist", "fire"],
  // Reads like a small lobbed fireball, not a literal Fire School kit.
  maxHealth: 55,
  moveSpeed: 5.0,
  attack: {
    windupSeconds: 0.35,
    activeSeconds: 0.1,
    recoverySeconds: 0.35,
    hitbox: { kind: "projectile", speed: 11, radius: 0.3, maxRange: 8 },
    baseDamage: 8,
  },
};

export const ENEMY_TIDEBOUND_ADEPT: EnemyDefinition = {
  id: "tidebound_adept",
  displayName: "Tidebound Adept",
  category: "rival_alchemist",
  tags: ["rival_alchemist", "water"],
  // Reads like a Liquid-Form flowing arc-strike.
  maxHealth: 55,
  moveSpeed: 5.0,
  attack: {
    windupSeconds: 0.3,
    activeSeconds: 0.25,
    recoverySeconds: 0.3,
    hitbox: { kind: "wave", range: 4, width: 2 },
    baseDamage: 7,
  },
};

export const ENEMY_GALE_ADEPT: EnemyDefinition = {
  id: "gale_adept",
  displayName: "Gale Adept",
  category: "rival_alchemist",
  tags: ["rival_alchemist", "air"],
  // Reads like a Gas-Form dart/spread shot — fast, light per-hit.
  maxHealth: 45,
  moveSpeed: 5.5,
  attack: {
    windupSeconds: 0.2,
    activeSeconds: 0.1,
    recoverySeconds: 0.25,
    hitbox: { kind: "projectile", speed: 13, radius: 0.25, maxRange: 9 },
    baseDamage: 6,
  },
};

export const ENEMY_ENVIOUS_SEER: EnemyDefinition = {
  id: "envious_seer",
  displayName: "Envious Seer",
  category: "rival_alchemist",
  tags: ["rival_alchemist", "aether"],
  // Reads like a Plasma-Form precise bolt/beam — the sharpest single hit of
  // the rival alchemists, mirroring Plasma's glass-cannon identity.
  maxHealth: 50,
  moveSpeed: 4.5,
  attack: {
    windupSeconds: 0.5,
    activeSeconds: 0.05,
    recoverySeconds: 0.4,
    hitbox: { kind: "beam", length: 7, width: 0.3 },
    baseDamage: 9,
  },
};

export const ALL_ENEMIES: EnemyDefinition[] = [
  // Elemental wildlife — real biomes
  ENEMY_STONE_GOLEM,
  ENEMY_MAGMA_WORM,
  ENEMY_DROWNED_WRAITH,
  ENEMY_WIND_WISP,
  ENEMY_STARGLASS_WISP,
  // Elemental wildlife — forward-looking Confluence
  ENEMY_VOIDLING,
  ENEMY_HOLLOW_WRETCH,
  ENEMY_NULL_HORROR,
  // Homunculi
  ENEMY_HOMUNCULUS_HUSK,
  ENEMY_HOMUNCULUS_SKITTERLING,
  ENEMY_HOMUNCULUS_LOBBER,
  ENEMY_HOMUNCULUS_BLOATED,
  // Undead
  ENEMY_WAILING_REVENANT,
  ENEMY_CHARNEL_GHOUL,
  // Rival alchemists
  ENEMY_EARTHEN_ADEPT,
  ENEMY_ASHBORN_PYROMANCER,
  ENEMY_TIDEBOUND_ADEPT,
  ENEMY_GALE_ADEPT,
  ENEMY_ENVIOUS_SEER,
];
