import type { RoomTemplate } from "@pithos/sim";

/**
 * Earth wing room pool (GDD.md §4 "Ponos's Hollow"; §9 "Run Structure";
 * §10 "Enemy Roster"; TECHNICAL_SPEC.md §3 "Procedural room/wing
 * generation"). Consumed by `generateWingPlan` (`packages/sim`), which
 * filters this pool by `kind` + `biomeTags` overlap and, for `combat`
 * rooms, by `difficultyTier` to escalate across a floor.
 *
 * Enemy-pool tagging convention (matches the tagging scheme a sibling
 * agent is authoring `EnemyDefinition`s against — see
 * `packages/sim/src/enemies/types.ts`): `RoomSpawnMarker.enemyPoolTags`
 * is an AND-match against an enemy's `tags` array
 * (`[category, ...biomeIds]`).
 *  - `["elemental_wildlife", "earth"]` — Earth's biome-native stone
 *    golems etc. (GDD.md §10).
 *  - `["homunculus"]` — lab-variant constructs, deliberately untagged by
 *    biome since homunculi "appear as lab variants across every wing."
 *  - `["rival_alchemist", "earth"]` — an Earth-flavored human rival, used
 *    sparingly in a couple of the harder rooms as "strong mid-tier
 *    variety" per GDD.md §10.
 * Undead are intentionally absent here — GDD.md §10 concentrates them in
 * Geras's Spire (Air) and Loimos's Forge (Fire), not Earth.
 */
export const EARTH_ROOMS: RoomTemplate[] = [
  // --- Start rooms (1-2) ---------------------------------------------
  {
    id: "earth_hollow_entrance",
    kind: "start",
    biomeTags: ["earth"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 2,
  },
  {
    id: "earth_sunken_threshold",
    kind: "start",
    biomeTags: ["earth"],
    difficultyTier: 1,
    entryCount: 2,
    exitCount: 2,
  },

  // --- Combat rooms (6-8, spanning tiers 1-5; some tiers repeat so a
  //     floor's draw-without-replacement pool always has enough options) --
  {
    id: "earth_crumbling_vault",
    kind: "combat",
    biomeTags: ["earth"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["elemental_wildlife", "earth"], count: 3 }],
  },
  {
    id: "earth_root_cellar_lab",
    kind: "combat",
    biomeTags: ["earth", "lab"],
    difficultyTier: 2,
    entryCount: 1,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["homunculus"], count: 3 }],
  },
  {
    id: "earth_shattered_quarry",
    kind: "combat",
    biomeTags: ["earth"],
    difficultyTier: 2,
    entryCount: 1,
    exitCount: 2,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "earth"], count: 3 },
      { enemyPoolTags: ["homunculus"], count: 1 },
    ],
  },
  {
    id: "earth_fissure_gallery",
    kind: "combat",
    biomeTags: ["earth"],
    difficultyTier: 3,
    entryCount: 2,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["elemental_wildlife", "earth"], count: 4 }],
  },
  {
    id: "earth_golem_warren",
    kind: "combat",
    biomeTags: ["earth"],
    difficultyTier: 3,
    entryCount: 1,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "earth"], count: 2 },
      { enemyPoolTags: ["rival_alchemist", "earth"], count: 1 },
    ],
  },
  {
    id: "earth_collapsed_atrium",
    kind: "combat",
    biomeTags: ["earth"],
    difficultyTier: 4,
    entryCount: 1,
    exitCount: 2,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "earth"], count: 3 },
      { enemyPoolTags: ["homunculus"], count: 2 },
    ],
  },
  {
    id: "earth_deep_marrow_chasm",
    kind: "combat",
    biomeTags: ["earth"],
    difficultyTier: 5,
    entryCount: 1,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "earth"], count: 4 },
      { enemyPoolTags: ["rival_alchemist", "earth"], count: 1 },
    ],
  },

  // --- Reward rooms (1-2) ---------------------------------------------
  {
    id: "earth_offering_hollow",
    kind: "reward",
    biomeTags: ["earth"],
    difficultyTier: 3,
    entryCount: 1,
    exitCount: 1,
  },
  {
    id: "earth_marrow_cache",
    kind: "reward",
    biomeTags: ["earth"],
    difficultyTier: 3,
    entryCount: 1,
    exitCount: 1,
  },

  // --- Boss room (exactly 1) — Ponos's Hollow, per GDD.md §4 -----------
  {
    id: "earth_ponos_hollow",
    kind: "boss",
    biomeTags: ["earth"],
    difficultyTier: 5,
    entryCount: 1,
    exitCount: 1,
  },
];
