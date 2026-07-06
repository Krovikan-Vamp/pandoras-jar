/**
 * Procedural room/wing generation contracts (see TECHNICAL_SPEC.md §3
 * "Procedural room/wing generation" and GDD.md §9 "Run Structure").
 *
 * `RoomTemplate` describes *abstract* room metadata — kind, biome
 * eligibility, difficulty, and door-connection counts — not the authored
 * geometry/spawn-marker/hazard content a real room needs. Authoring actual
 * `RoomTemplate` content per biome (bounds, spawn markers, hazard volumes)
 * is a later content pass owned by other work; this package only needs
 * enough shape to run the generator and let tests assert on its behavior.
 *
 * The Confluence wing (GDD.md §9: "Once all five Fragments are recovered,
 * the Confluence unlocks — mixed-biome, harder end-game content") is not a
 * distinct system: it's a `WingDefinition` whose `biomeTags` covers all 5
 * elements, run through the exact same `generateWingPlan` as any other
 * wing (TECHNICAL_SPEC.md §3: "no new generation system needed, only new
 * data tags").
 */

export type RoomKind = "start" | "combat" | "reward" | "boss";

/**
 * A trash-mob spawn instruction inside a `RoomTemplate`. Deliberately
 * references enemies by loose *tag* (e.g. `"elemental_wildlife"`, `"earth"`)
 * rather than a concrete enemy id — this keeps room content and the enemy
 * roster (`enemies/types.ts`) decoupled: either can be authored without the
 * other existing yet, and which exact `EnemyDefinition`s satisfy a tag is
 * resolved at runtime, not baked into the room template.
 */
export interface RoomSpawnMarker {
  enemyPoolTags: string[];
  count: number;
}

export interface RoomTemplate {
  id: string;
  kind: RoomKind;
  /**
   * Which biome(s) this room is eligible for. A normal wing's rooms carry a
   * single tag (e.g. `["fire"]`); a room authored to be Confluence-eligible
   * (or naturally elemental-agnostic, like a generic homunculus lab combat
   * room) can carry more than one, up to all 5.
   */
  biomeTags: string[];
  /** 1..N. Used to bias combat-room selection so later floors skew harder — see WingGenerator.ts. */
  difficultyTier: number;
  /** How many door connections lead into this room. Carried through as authoring metadata for the (future) physical room-graph/door-linking pass — not consumed by WingGenerator itself, which only produces a linear per-floor traversal order. */
  entryCount: number;
  /** How many door connections lead out of this room. Same caveat as `entryCount`. */
  exitCount: number;
  /** Omitted/empty for start/reward/boss rooms that don't spawn trash mobs. */
  spawns?: RoomSpawnMarker[];
}

export interface WingDefinition {
  /** e.g. "earth", "fire", "water", "air", "aether", or "confluence". */
  id: string;
  /**
   * Which biome tag(s) this wing draws its room pool from. A single tag for
   * a normal wing; all 5 elemental tags for Confluence, per
   * TECHNICAL_SPEC.md §3 ("sampling from the union of all 5 biomes' tagged
   * room/enemy pools instead of one").
   */
  biomeTags: string[];
  floorCount: number;
  /** Combat rooms between the start room and the boss/reward, per floor. */
  roomsPerFloor: number;
}

export interface FloorPlan {
  floorIndex: number;
  /**
   * In traversal order: one `start` room, then `roomsPerFloor` `combat`
   * rooms (non-decreasing `difficultyTier` within this array), then one
   * `reward` room, then — on the wing's final floor only — exactly one
   * `boss` room. Earlier floors end at the reward room; see
   * WingGenerator.ts for why only the last floor gets a boss room.
   */
  rooms: RoomTemplate[];
}

export interface WingPlan {
  wingId: string;
  seed: number;
  floors: FloorPlan[];
}
