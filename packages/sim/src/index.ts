export type { Entity, Vector3 } from "./ecs/world";
export { createWorld } from "./ecs/world";

export type { MovementConfig, MovementInput, MovementState } from "./movement/types";
export { DEFAULT_MOVEMENT_CONFIG, createMovementState } from "./movement/types";

export { MovementController } from "./movement/MovementController";
