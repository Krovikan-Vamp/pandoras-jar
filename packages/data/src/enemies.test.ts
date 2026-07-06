import { describe, expect, it } from "vitest";
import { ALL_ENEMIES } from "./enemies.js";
import { AETHER_ROOMS } from "./rooms/aether.js";
import { AIR_ROOMS } from "./rooms/air.js";
import { EARTH_ROOMS } from "./rooms/earth.js";
import { FIRE_ROOMS } from "./rooms/fire.js";
import { WATER_ROOMS } from "./rooms/water.js";

describe("ALL_ENEMIES", () => {
  it("is non-empty", () => {
    expect(ALL_ENEMIES.length).toBeGreaterThan(0);
  });

  it("every enemy has positive maxHealth, moveSpeed, and attack.baseDamage", () => {
    for (const enemy of ALL_ENEMIES) {
      expect(enemy.maxHealth, `${enemy.id}.maxHealth`).toBeGreaterThan(0);
      expect(enemy.moveSpeed, `${enemy.id}.moveSpeed`).toBeGreaterThan(0);
      expect(enemy.attack.baseDamage, `${enemy.id}.attack.baseDamage`).toBeGreaterThan(0);
    }
  });

  it("every enemy id is unique", () => {
    const ids = ALL_ENEMIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every enemy's tags[0] matches its category", () => {
    for (const enemy of ALL_ENEMIES) {
      expect(enemy.tags[0], enemy.id).toBe(enemy.category);
    }
  });

  /**
   * The load-bearing check: every distinct `enemyPoolTags` combination
   * requested by any `spawns` entry across all five already-landed room
   * files must be satisfiable by at least one authored `EnemyDefinition`
   * (i.e. some enemy's `tags` array is a superset of the requested tags —
   * the same AND-match semantics `RoomSpawnMarker.enemyPoolTags` resolves
   * against at runtime, per `procgen/types.ts` and `enemies/types.ts`).
   * Fails loudly (naming the unsatisfied tag combo) if a room's spawn
   * marker would resolve to zero eligible enemies at runtime.
   */
  it("satisfies every enemyPoolTags combination requested by the five landed room files", () => {
    const allRoomSets = [EARTH_ROOMS, FIRE_ROOMS, WATER_ROOMS, AIR_ROOMS, AETHER_ROOMS];

    const requestedCombos = new Set<string>();
    for (const rooms of allRoomSets) {
      for (const room of rooms) {
        for (const spawn of room.spawns ?? []) {
          requestedCombos.add(JSON.stringify([...spawn.enemyPoolTags].sort()));
        }
      }
    }

    // Sanity check on the extraction itself — if this is 0, the test below
    // would vacuously pass without checking anything.
    expect(requestedCombos.size).toBeGreaterThan(0);

    const unsatisfied: string[] = [];
    for (const combo of requestedCombos) {
      const requiredTags: string[] = JSON.parse(combo);
      const satisfiable = ALL_ENEMIES.some((enemy) =>
        requiredTags.every((tag) => enemy.tags.includes(tag)),
      );
      if (!satisfiable) {
        unsatisfied.push(combo);
      }
    }

    expect(unsatisfied, `Unsatisfiable enemyPoolTags combos: ${unsatisfied.join(", ")}`).toEqual(
      [],
    );
  });

  it("covers all four EnemyCategory values", () => {
    const categories = new Set(ALL_ENEMIES.map((e) => e.category));
    expect(categories).toEqual(
      new Set(["homunculus", "undead", "rival_alchemist", "elemental_wildlife"]),
    );
  });

  it("undead are only tagged for air and fire biomes", () => {
    const undead = ALL_ENEMIES.filter((e) => e.category === "undead");
    expect(undead.length).toBeGreaterThan(0);
    for (const enemy of undead) {
      const biomeTags = enemy.tags.filter((t) => t !== "undead");
      for (const tag of biomeTags) {
        expect(["air", "fire"]).toContain(tag);
      }
    }
  });

  it("homunculi carry no biome tag", () => {
    const homunculi = ALL_ENEMIES.filter((e) => e.category === "homunculus");
    expect(homunculi.length).toBeGreaterThan(0);
    for (const enemy of homunculi) {
      expect(enemy.tags, enemy.id).toEqual(["homunculus"]);
    }
  });

  it("rival alchemists cover all five real biomes", () => {
    const biomes = ALL_ENEMIES.filter((e) => e.category === "rival_alchemist").map(
      (e) => e.tags[1],
    );
    expect(new Set(biomes)).toEqual(new Set(["earth", "fire", "water", "air", "aether"]));
  });
});
