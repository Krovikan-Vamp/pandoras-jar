import type { RoomTemplate } from "@pithos/sim";

/**
 * Water wing room pool — Algea's Deep (Pain), GDD.md §4/§9. All rooms carry
 * `biomeTags: ["water"]` so `generateWingPlan` can draw them for a Water
 * `WingDefinition`; two combat rooms additionally carry `"lab"` for a
 * homunculus-lab flavor beat (GDD.md §10: homunculi "appear as lab variants
 * across every wing").
 *
 * `RoomSpawnMarker.enemyPoolTags` follows the AND-match convention shared
 * across Wave 2 content: an enemy's `tags` array is
 * `[category, ...biomeIds]`, so `["elemental_wildlife", "water"]` targets
 * Water's drowned wraiths specifically, `["homunculus"]` (no biome tag)
 * targets any lab variant, and `["rival_alchemist", "water"]` targets a
 * Water-flavored rival alchemist. No `undead` tags here — per GDD.md §10,
 * the undead are concentrated in Air (Geras) and Fire (Loimos); Water's
 * "drowned wraiths" are elemental wildlife, not the undead category.
 */

export const WATER_ROOMS: RoomTemplate[] = [
  // --- Start rooms ---------------------------------------------------
  {
    id: "water_tide_gate",
    kind: "start",
    biomeTags: ["water"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 1,
  },
  {
    id: "water_sunken_atrium",
    kind: "start",
    biomeTags: ["water"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 1,
  },

  // --- Combat rooms (difficultyTier 1-5) ------------------------------
  {
    id: "water_flooded_cistern",
    kind: "combat",
    biomeTags: ["water"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["elemental_wildlife", "water"], count: 3 }],
  },
  {
    id: "water_bilge_channels",
    kind: "combat",
    biomeTags: ["water"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 2,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "water"], count: 2 },
      { enemyPoolTags: ["homunculus"], count: 1 },
    ],
  },
  {
    id: "water_drowned_archive",
    kind: "combat",
    biomeTags: ["water", "lab"],
    difficultyTier: 2,
    entryCount: 1,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["homunculus"], count: 3 }],
  },
  {
    id: "water_undertow_shrine",
    kind: "combat",
    biomeTags: ["water"],
    difficultyTier: 3,
    entryCount: 2,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "water"], count: 2 },
      { enemyPoolTags: ["rival_alchemist", "water"], count: 1 },
    ],
  },
  {
    id: "water_black_lagoon",
    kind: "combat",
    biomeTags: ["water"],
    difficultyTier: 3,
    entryCount: 1,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["elemental_wildlife", "water"], count: 4 }],
  },
  {
    id: "water_pressure_vault",
    kind: "combat",
    biomeTags: ["water", "lab"],
    difficultyTier: 4,
    entryCount: 1,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["homunculus"], count: 2 },
      { enemyPoolTags: ["elemental_wildlife", "water"], count: 2 },
    ],
  },
  {
    id: "water_abyssal_trench",
    kind: "combat",
    biomeTags: ["water"],
    difficultyTier: 5,
    entryCount: 1,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "water"], count: 3 },
      { enemyPoolTags: ["rival_alchemist", "water"], count: 1 },
    ],
  },

  // --- Reward rooms ----------------------------------------------------
  {
    id: "water_tithe_pool",
    kind: "reward",
    biomeTags: ["water"],
    difficultyTier: 2,
    entryCount: 1,
    exitCount: 1,
  },
  {
    id: "water_hopeful_shallows",
    kind: "reward",
    biomeTags: ["water"],
    difficultyTier: 4,
    entryCount: 1,
    exitCount: 1,
  },

  // --- Boss room ---------------------------------------------------------
  {
    id: "water_algeas_deep",
    kind: "boss",
    biomeTags: ["water"],
    difficultyTier: 6,
    entryCount: 1,
    exitCount: 1,
  },
];
