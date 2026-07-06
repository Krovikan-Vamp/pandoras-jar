import { describe, expect, it } from "vitest";
import type { RoomKind, RoomTemplate, WingDefinition } from "./types.js";
import { generateWingPlan, mulberry32 } from "./WingGenerator.js";

/**
 * TEST FIXTURES ONLY — not real authored game content. Real per-biome
 * `RoomTemplate`s (bounds, spawn markers, hazard volumes) are a later
 * content-authoring pass; these exist purely to exercise the generator's
 * kind/tag/tier filtering and selection logic against something
 * pool-shaped.
 */
const BIOMES = ["earth", "fire", "water", "air", "aether"] as const;
const TIERS = [1, 2, 3, 4, 5];

function makeRoom(
  id: string,
  kind: RoomKind,
  biomeTags: string[],
  difficultyTier: number,
): RoomTemplate {
  return { id, kind, biomeTags, difficultyTier, entryCount: 1, exitCount: 1 };
}

function makeBiomeRooms(biome: string): RoomTemplate[] {
  const rooms: RoomTemplate[] = [
    makeRoom(`${biome}-start-1`, "start", [biome], 1),
    makeRoom(`${biome}-start-2`, "start", [biome], 1),
    makeRoom(`${biome}-reward-1`, "reward", [biome], 1),
    makeRoom(`${biome}-reward-2`, "reward", [biome], 1),
    makeRoom(`${biome}-boss-1`, "boss", [biome], 5),
  ];
  for (const tier of TIERS) {
    rooms.push(makeRoom(`${biome}-combat-${tier}-a`, "combat", [biome], tier));
    rooms.push(makeRoom(`${biome}-combat-${tier}-b`, "combat", [biome], tier));
  }
  return rooms;
}

/**
 * A "lab" homunculus combat room and the Confluence's own boss (Kenoma),
 * both tagged for every biome — mirroring GDD.md §10 ("Homunculi &
 * constructs ... appear as 'lab' variants across every wing") and §11
 * (Kenoma, the Confluence's boss) — so the mixed-tag-room test has
 * something to exercise beyond single-tag rooms.
 */
const CROSS_BIOME_ROOMS: RoomTemplate[] = [
  makeRoom("lab-combat-1", "combat", [...BIOMES], 2),
  makeRoom("lab-combat-2", "combat", [...BIOMES], 4),
  makeRoom("kenoma-boss", "boss", [...BIOMES], 5),
];

const FIXTURE_POOL: RoomTemplate[] = [...BIOMES.flatMap(makeBiomeRooms), ...CROSS_BIOME_ROOMS];

function earthWing(overrides: Partial<WingDefinition> = {}): WingDefinition {
  return { id: "earth", biomeTags: ["earth"], floorCount: 4, roomsPerFloor: 3, ...overrides };
}

function confluenceWing(overrides: Partial<WingDefinition> = {}): WingDefinition {
  return {
    id: "confluence",
    biomeTags: [...BIOMES],
    floorCount: 3,
    roomsPerFloor: 4,
    ...overrides,
  };
}

function combatTiers(floor: { rooms: RoomTemplate[] }): number[] {
  return floor.rooms.filter((r) => r.kind === "combat").map((r) => r.difficultyTier);
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

describe("mulberry32", () => {
  it("is deterministic: the same seed produces the same stream of values", () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("generateWingPlan", () => {
  it("is deterministic: the same wing/pool/seed produces a deep-equal plan every time", () => {
    const planA = generateWingPlan(earthWing(), FIXTURE_POOL, 42);
    const planB = generateWingPlan(earthWing(), FIXTURE_POOL, 42);
    expect(planB).toEqual(planA);
  });

  it("typically produces a different plan for a different seed", () => {
    const planA = generateWingPlan(earthWing(), FIXTURE_POOL, 42);
    const planB = generateWingPlan(earthWing(), FIXTURE_POOL, 43);
    expect(planB).not.toEqual(planA);
  });

  it("builds each floor as start, escalating combat rooms, then reward, with no boss room before the final floor", () => {
    const plan = generateWingPlan(earthWing(), FIXTURE_POOL, 1);

    expect(plan.floors).toHaveLength(4);
    for (const floor of plan.floors.slice(0, -1)) {
      const kinds = floor.rooms.map((r) => r.kind);
      expect(kinds[0]).toBe("start");
      expect(kinds.at(-1)).toBe("reward");
      expect(kinds).not.toContain("boss");
      expect(kinds.filter((k) => k === "combat")).toHaveLength(3);
    }

    const finalFloor = plan.floors.at(-1)!;
    const finalKinds = finalFloor.rooms.map((r) => r.kind);
    expect(finalKinds[0]).toBe("start");
    expect(finalKinds.at(-1)).toBe("boss");
    expect(finalKinds.filter((k) => k === "reward")).toHaveLength(1);
    expect(finalKinds.filter((k) => k === "combat")).toHaveLength(3);
  });

  it("only ever selects rooms tagged for the wing's biome", () => {
    const plan = generateWingPlan(earthWing(), FIXTURE_POOL, 5);
    for (const floor of plan.floors) {
      for (const room of floor.rooms) {
        expect(room.biomeTags).toContain("earth");
      }
    }
  });

  it("sorts each floor's combat rooms in non-decreasing difficultyTier order", () => {
    const plan = generateWingPlan(earthWing(), FIXTURE_POOL, 9);
    for (const floor of plan.floors) {
      const tiers = combatTiers(floor);
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1]!);
      }
    }
  });

  it("trends combat-room difficulty upward across floors", () => {
    const plan = generateWingPlan(earthWing({ floorCount: 6, roomsPerFloor: 2 }), FIXTURE_POOL, 42);
    const firstFloorAvg = average(combatTiers(plan.floors[0]!));
    const lastFloorAvg = average(combatTiers(plan.floors.at(-1)!));
    expect(lastFloorAvg).toBeGreaterThan(firstFloorAvg);
  });

  it("never repeats the same combat room template within a single floor", () => {
    const plan = generateWingPlan(earthWing({ roomsPerFloor: 5 }), FIXTURE_POOL, 11);
    for (const floor of plan.floors) {
      const ids = floor.rooms.filter((r) => r.kind === "combat").map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("a Confluence-style wing (biomeTags covering all 5 elements) pulls from the union of single-tag pools", () => {
    const plan = generateWingPlan(confluenceWing(), FIXTURE_POOL, 42);

    expect(plan.floors).toHaveLength(3);

    const combatTagsUsed = new Set<string>();
    for (const floor of plan.floors) {
      for (const room of floor.rooms.filter((r) => r.kind === "combat")) {
        for (const tag of room.biomeTags) {
          combatTagsUsed.add(tag);
        }
      }
    }

    // With 4 combat rooms per floor across 3 floors, sampling from a pool
    // spanning all 5 single-tag biomes plus the cross-biome "lab" rooms
    // should draw from more than just one biome's rooms.
    expect(combatTagsUsed.size).toBeGreaterThan(1);

    const finalFloor = plan.floors.at(-1)!;
    expect(finalFloor.rooms.at(-1)!.kind).toBe("boss");
  });

  it("throws a clear error when the pool doesn't have enough matching combat rooms for a floor", () => {
    const sparsePool: RoomTemplate[] = [
      makeRoom("water-start-1", "start", ["water"], 1),
      makeRoom("water-combat-1", "combat", ["water"], 1),
      makeRoom("water-reward-1", "reward", ["water"], 1),
      makeRoom("water-boss-1", "boss", ["water"], 3),
    ];
    const wing: WingDefinition = { id: "water", biomeTags: ["water"], floorCount: 1, roomsPerFloor: 2 };

    expect(() => generateWingPlan(wing, sparsePool, 1)).toThrowError(/needs 2 "combat" room/);
  });

  it("throws a clear error when the pool has no boss room matching the wing's biome tags", () => {
    const pool: RoomTemplate[] = [
      makeRoom("air-start-1", "start", ["air"], 1),
      makeRoom("air-combat-1", "combat", ["air"], 1),
      makeRoom("air-combat-2", "combat", ["air"], 2),
      makeRoom("air-reward-1", "reward", ["air"], 1),
      // No "boss" kind room tagged "air".
    ];
    const wing: WingDefinition = { id: "air", biomeTags: ["air"], floorCount: 1, roomsPerFloor: 2 };

    expect(() => generateWingPlan(wing, pool, 1)).toThrowError(/needs 1 "boss" room/);
  });
});
