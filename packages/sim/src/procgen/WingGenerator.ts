import type { FloorPlan, RoomKind, RoomTemplate, WingDefinition, WingPlan } from "./types.js";

/**
 * Small, hand-rolled, deterministic PRNG (mulberry32). No dependency pulled
 * in for this on purpose — the whole point of seeding is that
 * `mulberry32(42)` produces the exact same stream of numbers every time, on
 * every platform, forever, which is what makes `generateWingPlan` (and any
 * future replay/seed-sharing feature) reproducible.
 *
 * Returns a closure over the 32-bit state; call it repeatedly to draw
 * successive floats in `[0, 1)`.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws a uniform random integer in `[0, maxExclusive)`. Assumes `maxExclusive > 0`. */
function randomIndex(rng: () => number, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

function hasOverlap(a: readonly string[], b: readonly string[]): boolean {
  return a.some((tag) => b.includes(tag));
}

function byKindAndTags(pool: readonly RoomTemplate[], kind: RoomKind, biomeTags: readonly string[]): RoomTemplate[] {
  return pool.filter((room) => room.kind === kind && hasOverlap(room.biomeTags, biomeTags));
}

function requireAtLeast(
  candidates: readonly RoomTemplate[],
  needed: number,
  wingId: string,
  floorIndex: number,
  kind: RoomKind,
  biomeTags: readonly string[],
): void {
  if (candidates.length < needed) {
    throw new Error(
      `generateWingPlan: wing "${wingId}" floor ${floorIndex} needs ${needed} "${kind}" room(s) ` +
        `tagged with one of [${biomeTags.join(", ")}], but the room pool only has ${candidates.length} matching candidate(s).`,
    );
  }
}

/**
 * Picks one room uniformly at random from `candidates`. Used for `start`,
 * `reward`, and `boss` rooms — these don't need difficulty escalation
 * (a start room is a fixed entry point; a reward/shop variant and the
 * wing's boss aren't tiered the way trash-combat encounters are), so a
 * plain uniform draw is all that's needed here.
 */
function pickOne(rng: () => number, candidates: readonly RoomTemplate[]): RoomTemplate {
  const room = candidates[randomIndex(rng, candidates.length)];
  if (!room) {
    // Unreachable given the requireAtLeast(..., 1, ...) guard callers use
    // before this, but keeps noUncheckedIndexedAccess happy without a cast.
    throw new Error("pickOne: candidates array was empty");
  }
  return room;
}

/**
 * Difficulty-escalation weighting: each combat "slot" in a floor has a
 * target `difficultyTier` interpolated between the pool's min and max tier.
 * Progress toward the max is dominated by which floor we're on (floors
 * escalate the wing's overall difficulty), with a gentler secondary ramp
 * across the slots *within* a floor (so the last combat room of a floor
 * already leans toward the next floor's difficulty, instead of every floor
 * resetting to the same internal curve). Rooms are then weighted by inverse
 * distance from that target tier (closer tier = more likely, never zero
 * probability) and drawn without replacement, so a floor's combat rooms are
 * always distinct room templates.
 */
function targetDifficultyTier(
  floorIndex: number,
  floorCount: number,
  slotIndex: number,
  slotCount: number,
  minTier: number,
  maxTier: number,
): number {
  const floorProgress = floorCount > 1 ? floorIndex / (floorCount - 1) : 1;
  const slotProgress = slotCount > 1 ? slotIndex / (slotCount - 1) : 1;
  const progress = floorProgress * 0.75 + slotProgress * 0.25;
  return minTier + progress * (maxTier - minTier);
}

/**
 * Draws one item from `items`, weighted by `weightOf` (higher weight = more
 * likely). Weights must be positive finite numbers.
 */
function weightedPickOne<T>(rng: () => number, items: readonly T[], weightOf: (item: T) => number): T | undefined {
  if (items.length === 0) {
    return undefined;
  }

  const weights = items.map(weightOf);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) {
      return items[i];
    }
  }

  // Floating-point rounding can leave `roll` fractionally positive after the
  // loop; fall back to the last item rather than `undefined`.
  return items[items.length - 1];
}

function pickCombatRoomsForFloor(
  rng: () => number,
  candidates: readonly RoomTemplate[],
  floorIndex: number,
  floorCount: number,
  roomsPerFloor: number,
): RoomTemplate[] {
  const tiers = candidates.map((room) => room.difficultyTier);
  const minTier = Math.min(...tiers);
  const maxTier = Math.max(...tiers);

  // Draw one weighted pick per slot, re-centering the target tier for each
  // slot so difficulty ramps within the floor too. Each pick is removed from
  // `remaining` before the next slot is drawn, so the same room template
  // can't appear twice in one floor.
  let remaining = candidates.slice();
  const picked: RoomTemplate[] = [];
  for (let slot = 0; slot < roomsPerFloor; slot++) {
    const target = targetDifficultyTier(floorIndex, floorCount, slot, roomsPerFloor, minTier, maxTier);
    const room = weightedPickOne(rng, remaining, (r) => 1 / (1 + Math.abs(r.difficultyTier - target)));
    if (!room) {
      break;
    }
    picked.push(room);
    remaining = remaining.filter((r) => r !== room);
  }

  // Sort ascending by difficultyTier so the floor's combat rooms escalate in
  // traversal order (FloorPlan's documented invariant), independent of the
  // (randomized) order they happened to be drawn in.
  return picked.slice().sort((a, b) => a.difficultyTier - b.difficultyTier);
}

function generateFloorPlan(
  rng: () => number,
  wing: WingDefinition,
  roomPool: readonly RoomTemplate[],
  floorIndex: number,
): FloorPlan {
  const isFinalFloor = floorIndex === wing.floorCount - 1;

  const startCandidates = byKindAndTags(roomPool, "start", wing.biomeTags);
  requireAtLeast(startCandidates, 1, wing.id, floorIndex, "start", wing.biomeTags);
  const startRoom = pickOne(rng, startCandidates);

  const combatCandidates = byKindAndTags(roomPool, "combat", wing.biomeTags);
  requireAtLeast(combatCandidates, wing.roomsPerFloor, wing.id, floorIndex, "combat", wing.biomeTags);
  const combatRooms = pickCombatRoomsForFloor(rng, combatCandidates, floorIndex, wing.floorCount, wing.roomsPerFloor);

  const rewardCandidates = byKindAndTags(roomPool, "reward", wing.biomeTags);
  requireAtLeast(rewardCandidates, 1, wing.id, floorIndex, "reward", wing.biomeTags);
  const rewardRoom = pickOne(rng, rewardCandidates);

  const rooms: RoomTemplate[] = [startRoom, ...combatRooms, rewardRoom];

  // Only the wing's final floor gets a boss room — GDD.md §9: "Each wing
  // has several escalating floors, ending in that wing's Spite." Earlier
  // floors are pure combat/reward floors with no mini-boss encounter.
  if (isFinalFloor) {
    const bossCandidates = byKindAndTags(roomPool, "boss", wing.biomeTags);
    requireAtLeast(bossCandidates, 1, wing.id, floorIndex, "boss", wing.biomeTags);
    rooms.push(pickOne(rng, bossCandidates));
  }

  return { floorIndex, rooms };
}

/**
 * Generates a full `WingPlan` for `wing` by walking its floors in order and,
 * per floor, sampling a start room, `wing.roomsPerFloor` combat rooms
 * (escalating in `difficultyTier`, see `targetDifficultyTier` above), one
 * reward room, and — on the final floor only — one boss room, all filtered
 * to `RoomTemplate`s whose `biomeTags` overlap `wing.biomeTags`.
 *
 * A single `mulberry32(seed)` PRNG instance is created once and threaded
 * through every draw in a fixed order (floor 0's start/combat/reward/boss,
 * then floor 1's, ...), so `generateWingPlan(wing, pool, seed)` called twice
 * with the same arguments always returns a deep-equal `WingPlan`.
 *
 * Throws if `roomPool` doesn't contain enough matching rooms (by kind +
 * biome-tag overlap) for any required slot on any floor — see
 * `requireAtLeast` for the exact error message.
 */
export function generateWingPlan(wing: WingDefinition, roomPool: readonly RoomTemplate[], seed: number): WingPlan {
  const rng = mulberry32(seed);

  const floors: FloorPlan[] = [];
  for (let floorIndex = 0; floorIndex < wing.floorCount; floorIndex++) {
    floors.push(generateFloorPlan(rng, wing, roomPool, floorIndex));
  }

  return { wingId: wing.id, seed, floors };
}
