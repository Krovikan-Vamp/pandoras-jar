import type { AttackTimeline } from "../combat/types.js";

/**
 * Trash-mob contract (GDD.md §10 "Enemy Roster"). Deliberately much
 * simpler than `BossDefinition` — no phases, no weighted pattern
 * selection, just one attack. Reuses the same `AttackTimeline` shape
 * player/boss attacks use, per the same "one hitbox/timing system" goal.
 */
export type EnemyCategory = "homunculus" | "undead" | "rival_alchemist" | "elemental_wildlife";

export interface EnemyDefinition {
  id: string;
  displayName: string;
  category: EnemyCategory;
  /**
   * Loose tags a `RoomSpawnMarker.enemyPoolTags` (procgen/types.ts) matches
   * against — typically the enemy's `category` plus one or more biome ids
   * (e.g. `["elemental_wildlife", "earth"]`). Matching is "some tag in
   * common," mirroring `RoomTemplate.biomeTags`' overlap semantics in
   * `WingGenerator.ts`.
   */
  tags: string[];
  maxHealth: number;
  moveSpeed: number;
  attack: AttackTimeline;
}
