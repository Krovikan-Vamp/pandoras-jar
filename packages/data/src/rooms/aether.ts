import type { RoomTemplate } from "@pithos/sim";

/**
 * Aether wing room pool (GDD.md §4 "Phthonos's Reach (Envy)"; §9 "Run
 * Structure"; §10 "Enemy Roster"; TECHNICAL_SPEC.md §3 "Procedural
 * room/wing generation"). Consumed by `generateWingPlan` (`packages/sim`),
 * which filters this pool by `kind` + `biomeTags` overlap and, for
 * `combat` rooms, by `difficultyTier` to escalate across a floor.
 *
 * Aether is thematically the last wing fought before the midpoint Kenoma
 * revelation (GDD.md §2: "Once several Fragments are recovered, Elpis
 * realizes something is wrong..."), so this pool's `difficultyTier`s skew
 * a step higher than a "first wing" like Earth would (2-6 here, rather
 * than Earth's 1-5) while staying internally consistent room-to-room.
 *
 * Enemy-pool tagging convention (matches the AND-match scheme a sibling
 * agent is authoring `EnemyDefinition`s against — see
 * `packages/sim/src/enemies/types.ts`; every listed tag must be present on
 * a candidate enemy's `tags` array for it to be eligible):
 *  - `["elemental_wildlife", "aether"]` — Aether's biome-native
 *    star-touched wisps and prismatic horrors (GDD.md §10's "elemental
 *    wildlife" category, given an Aether-appropriate equivalent to the
 *    Confluence's "void-touched horrors").
 *  - `["homunculus"]` — lab-variant constructs, deliberately untagged by
 *    biome since homunculi "appear as lab variants across every wing"
 *    (GDD.md §10) — requiring a biome tag here would match zero enemies.
 *  - `["rival_alchemist", "aether"]` — an Aether-flavored human rival,
 *    used sparingly in a couple of the harder rooms as "strong mid-tier
 *    variety" per GDD.md §10.
 * Undead are intentionally absent here — GDD.md §10 concentrates them in
 * Geras's Spire (Air) and Loimos's Forge (Fire), not Aether.
 */
export const AETHER_ROOMS: RoomTemplate[] = [
  // --- Start rooms (2) -------------------------------------------------
  {
    id: "aether_threshold_of_glass",
    kind: "start",
    biomeTags: ["aether"],
    difficultyTier: 1,
    entryCount: 0,
    exitCount: 1,
  },
  {
    id: "aether_first_starlight",
    kind: "start",
    biomeTags: ["aether"],
    difficultyTier: 2,
    entryCount: 0,
    exitCount: 1,
  },

  // --- Combat rooms (7, spanning tiers 2-6; some tiers repeat so a
  //     floor's draw-without-replacement pool always has enough options) --
  {
    id: "aether_starlit_causeway",
    kind: "combat",
    biomeTags: ["aether"],
    difficultyTier: 2,
    entryCount: 1,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["elemental_wildlife", "aether"], count: 3 }],
  },
  {
    id: "aether_prism_atrium_lab",
    kind: "combat",
    biomeTags: ["aether", "lab"],
    difficultyTier: 3,
    entryCount: 1,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["homunculus"], count: 2 },
      { enemyPoolTags: ["elemental_wildlife", "aether"], count: 2 },
    ],
  },
  {
    id: "aether_shattered_observatory",
    kind: "combat",
    biomeTags: ["aether"],
    difficultyTier: 4,
    entryCount: 1,
    exitCount: 2,
    spawns: [{ enemyPoolTags: ["elemental_wildlife", "aether"], count: 4 }],
  },
  {
    id: "aether_gravity_well_gallery",
    kind: "combat",
    biomeTags: ["aether"],
    difficultyTier: 4,
    entryCount: 2,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "aether"], count: 2 },
      { enemyPoolTags: ["rival_alchemist", "aether"], count: 1 },
    ],
  },
  {
    id: "aether_comet_forge_annex",
    kind: "combat",
    biomeTags: ["aether", "lab"],
    difficultyTier: 5,
    entryCount: 1,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["homunculus"], count: 3 }],
  },
  {
    id: "aether_null_horizon_rift",
    kind: "combat",
    biomeTags: ["aether"],
    difficultyTier: 5,
    entryCount: 1,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "aether"], count: 3 },
      { enemyPoolTags: ["rival_alchemist", "aether"], count: 1 },
    ],
  },
  {
    id: "aether_envious_reflection_hall",
    kind: "combat",
    biomeTags: ["aether"],
    difficultyTier: 6,
    entryCount: 1,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["rival_alchemist", "aether"], count: 2 },
      { enemyPoolTags: ["elemental_wildlife", "aether"], count: 2 },
    ],
  },

  // --- Reward rooms (2) -------------------------------------------------
  {
    id: "aether_hoarders_vault",
    kind: "reward",
    biomeTags: ["aether"],
    difficultyTier: 3,
    entryCount: 1,
    exitCount: 1,
  },
  {
    id: "aether_fragment_alcove",
    kind: "reward",
    biomeTags: ["aether"],
    difficultyTier: 5,
    entryCount: 1,
    exitCount: 1,
  },

  // --- Boss room (exactly 1) — Phthonos's Reach, per GDD.md §4 ----------
  {
    id: "aether_phthonos_reach",
    kind: "boss",
    biomeTags: ["aether"],
    difficultyTier: 7,
    entryCount: 1,
    exitCount: 0,
  },
];
