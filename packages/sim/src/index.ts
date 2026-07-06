export type { CombatIdentity, Entity, Health, Vector3 } from "./ecs/world.js";
export { createWorld } from "./ecs/world.js";

export type { MovementConfig, MovementInput, MovementState } from "./movement/types.js";
export { DEFAULT_MOVEMENT_CONFIG, createMovementState } from "./movement/types.js";

export { MovementController } from "./movement/MovementController.js";

export type {
  AbilityScript,
  AttackTimeline,
  BurstEffect,
  ChargeParams,
  DamageType,
  FluxState,
  FormDefinition,
  FormFlavor,
  FormId,
  HitboxArchetype,
  PassiveEffect,
  ResolvedAttack,
  SchoolDefinition,
  SchoolId,
  StatusEffectApplication,
  UltimateBehavior,
} from "./combat/types.js";
export { FORM_IDS, SCHOOL_IDS } from "./combat/types.js";

export { assertCompleteFlavorMap, resolveAttack } from "./combat/resolveAttack.js";

export type { ModifierRegistry, StatBlock, StatKey } from "./perks/types.js";
