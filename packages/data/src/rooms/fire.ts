import type { RoomTemplate } from "@pithos/sim";

/**
 * Fire wing room pool — Loimos's Forge (GDD.md §4, §9). All rooms are
 * tagged `["fire"]` (one lab-flavored combat room also carries `"lab"`, an
 * optional secondary tag per `procgen/types.ts`'s "generic homunculus lab
 * room" carve-out) so `generateWingPlan` can draw a full floor's worth of
 * start/combat/reward/boss rooms for the Fire wing, and so this same pool
 * is automatically eligible for the future Confluence wing's unioned pool.
 *
 * Per GDD.md §10, undead are canonically concentrated in Geras's Spire
 * (Air) *and* Loimos's Forge (Fire) — several combat rooms below spawn
 * `["undead", "fire"]`. Elemental wildlife (magma worms) and a couple of
 * `["rival_alchemist", "fire"]` mid-tier encounters round out the mix,
 * plus one `["homunculus"]` lab room (homunculi carry no biome tag — they
 * appear as lab variants across every wing).
 */
export const FIRE_ROOMS: RoomTemplate[] = [
  // --- Start rooms ---
  {
    id: "fire_ember_forge_entrance",
    kind: "start",
    biomeTags: ["fire"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 1,
  },
  {
    id: "fire_ashfall_threshold",
    kind: "start",
    biomeTags: ["fire"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 2,
  },

  // --- Combat rooms (difficultyTier 1-5) ---
  {
    id: "fire_slag_pit",
    kind: "combat",
    biomeTags: ["fire"],
    difficultyTier: 1,
    entryCount: 1,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["elemental_wildlife", "fire"], count: 3 }],
  },
  {
    id: "fire_cinder_warrens",
    kind: "combat",
    biomeTags: ["fire"],
    difficultyTier: 2,
    entryCount: 1,
    exitCount: 2,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "fire"], count: 2 },
      { enemyPoolTags: ["undead", "fire"], count: 2 },
    ],
  },
  {
    id: "fire_charnel_kiln",
    kind: "combat",
    biomeTags: ["fire"],
    difficultyTier: 2,
    entryCount: 2,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["undead", "fire"], count: 4 }],
  },
  {
    id: "fire_alembic_ward",
    kind: "combat",
    biomeTags: ["fire", "lab"],
    difficultyTier: 3,
    entryCount: 1,
    exitCount: 1,
    spawns: [{ enemyPoolTags: ["homunculus"], count: 3 }],
  },
  {
    id: "fire_molten_causeway",
    kind: "combat",
    biomeTags: ["fire"],
    difficultyTier: 3,
    entryCount: 1,
    exitCount: 2,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "fire"], count: 2 },
      { enemyPoolTags: ["rival_alchemist", "fire"], count: 1 },
    ],
  },
  {
    id: "fire_pyroclast_gallery",
    kind: "combat",
    biomeTags: ["fire"],
    difficultyTier: 4,
    entryCount: 2,
    exitCount: 2,
    spawns: [
      { enemyPoolTags: ["undead", "fire"], count: 2 },
      { enemyPoolTags: ["elemental_wildlife", "fire"], count: 2 },
    ],
  },
  {
    id: "fire_furnace_crucible",
    kind: "combat",
    biomeTags: ["fire"],
    difficultyTier: 5,
    entryCount: 1,
    exitCount: 1,
    spawns: [
      { enemyPoolTags: ["elemental_wildlife", "fire"], count: 3 },
      { enemyPoolTags: ["rival_alchemist", "fire"], count: 1 },
    ],
  },

  // --- Reward rooms ---
  {
    id: "fire_reliquary_embers",
    kind: "reward",
    biomeTags: ["fire"],
    difficultyTier: 3,
    entryCount: 1,
    exitCount: 1,
  },
  {
    id: "fire_hearth_of_ashes",
    kind: "reward",
    biomeTags: ["fire"],
    difficultyTier: 4,
    entryCount: 1,
    exitCount: 1,
  },

  // --- Boss room ---
  {
    id: "fire_loimos_forge",
    kind: "boss",
    biomeTags: ["fire"],
    difficultyTier: 5,
    entryCount: 1,
    exitCount: 0,
  },
];
