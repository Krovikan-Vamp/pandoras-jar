import { World } from "miniplex";
import type { MovementState } from "../movement/types.js";

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * The single entity shape for Phase 0. All components are optional so that
 * `world.with(...)` can narrow to the archetypes that actually need them
 * (miniplex's standard pattern) — a plain player entity will have all three
 * of `position`/`velocity`/`movement` populated.
 */
export interface Entity {
  position?: Vector3;
  velocity?: Vector3;
  /**
   * Tag + data component: presence marks the entity as movement-controlled,
   * and its value is the `MovementState` produced by `MovementController`.
   */
  movement?: MovementState;
}

export function createWorld(): World<Entity> {
  return new World<Entity>();
}
