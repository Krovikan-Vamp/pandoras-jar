export type { Entity, Vector3 } from "./ecs/world.js";
export { createWorld } from "./ecs/world.js";

export type { MovementConfig, MovementInput, MovementState } from "./movement/types.js";
export { DEFAULT_MOVEMENT_CONFIG, createMovementState } from "./movement/types.js";

export { MovementController } from "./movement/MovementController.js";
