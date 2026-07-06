import type { RoomTemplate } from "@pithos/sim";

/**
 * Air wing room pool — Geras's Spire (Old Age), GDD.md §4/§9/§11.
 *
 * `enemyPoolTags` follow the shared content-authoring convention: an
 * `EnemyDefinition.tags` array is `[category, ...biomeIds]`
 * (category ∈ "homunculus" | "undead" | "rival_alchemist" |
 * "elemental_wildlife"), and a `RoomSpawnMarker.enemyPoolTags` is resolved
 * at runtime as an AND-match — every listed tag must be present on a
 * candidate enemy. Homunculi are authored without a biome tag (they "appear
 * as lab variants across every wing" per GDD.md §10), so wanting one
 * anywhere just tags `["homunculus"]`. Per GDD.md §10, Air (alongside Fire)
 * is one of the two wings that canonically concentrates undead/cursed-dead
 * spawns — Old Age pairs naturally with the cursed dead — so undead spawns
 * show up across multiple tiers here, not just as a token inclusion.
 */
export const AIR_ROOMS: RoomTemplate[] = [
  // --- start ---------------------------------------------------------
  {
    id: "air_spire_threshold",
    kind: "start",
    biomeTags: ["air"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 1,
  },
  {
    id: "air_windswept_landing",
    kind: "start",
    biomeTags: ["air"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 1,
  },

  // --- combat (tiers 1-5, some repetition within a tier) --------------
  {
    id: "air_crumbling_belfry",
    kind: "combat",
    biomeTags: ["air"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["elemental_wildlife", "air"], count: 3 }],
  },
  {
    id: "air_hollow_windpipes",
    kind: "combat",
    biomeTags: ["air"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "air"], count: 2 },
      { enemyPoolTags: ["undead", "air"], count: 1 },
    ],
  },
  {
    id: "air_shattered_causeway",
    kind: "combat",
    biomeTags: ["air"],
    difficultyTier: 2,
    entryCount: 1,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["undead", "air"], count: 3 }],
  },
  {
    id: "air_alchemists_gallery",
    // A homunculus "lab" flavor room — optionally double-tagged, per the
    // brief's note that lab combat rooms may carry a second tag.
    kind: "combat",
    biomeTags: ["air", "lab"],
    difficultyTier: 2,
    entryCount: 1,
    exitCount: 1,
    // No biome tag on the homunculus pool tag — they appear across every
    // wing (GDD.md §10), so requiring "air" here would wrongly match zero.
    spawns: [{ enemyPoolTags: ["homunculus"], count: 2 }],
  },
  {
    id: "air_vertigo_stair",
    kind: "combat",
    biomeTags: ["air"],
    difficultyTier: 3,
    entryCount: 1,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "air"], count: 2 },
      { enemyPoolTags: ["undead", "air"], count: 2 },
    ],
  },
  {
    id: "air_rival_conclave",
    kind: "combat",
    biomeTags: ["air"],
    difficultyTier: 4,
    entryCount: 1,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["rival_alchemist", "air"], count: 1 },
      { enemyPoolTags: ["elemental_wildlife", "air"], count: 2 },
    ],
  },
  {
    id: "air_last_updraft",
    // Hardest pre-boss combat room on the floor: a real mix of undead,
    // a rival alchemist, and wildlife.
    kind: "combat",
    biomeTags: ["air"],
    difficultyTier: 5,
    entryCount: 1,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["undead", "air"], count: 2 },
      { enemyPoolTags: ["rival_alchemist", "air"], count: 1 },
      { enemyPoolTags: ["elemental_wildlife", "air"], count: 1 },
    ],
  },

  // --- reward ----------------------------------------------------------
  {
    id: "air_gilded_updraft",
    kind: "reward",
    biomeTags: ["air"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 1,
  },
  {
    id: "air_hourglass_atrium",
    kind: "reward",
    biomeTags: ["air"],
    difficultyTier: 3,
    entryCount: 1,
    exitCount: 1,
  },

  // --- boss --------------------------------------------------------------
  {
    id: "air_geras_spire_apex",
    kind: "boss",
    biomeTags: ["air"],
    difficultyTier: 5,
    entryCount: 1,
    exitCount: 1,
  },
];
