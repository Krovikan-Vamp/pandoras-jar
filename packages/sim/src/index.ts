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
export type { CombatEventBus, CombatEventMap } from "./perks/EventBus.js";
export { createEventBus } from "./perks/EventBus.js";
export type { Modifier, ModifierOp } from "./perks/ModifierRegistry.js";
export { ModifierRegistryImpl } from "./perks/ModifierRegistry.js";
export type { Perk, PerkTier } from "./perks/Perk.js";

export { FormFluxMachine } from "./state/FormFluxMachine.js";
export type {
  RunFlowActor,
  RunFlowContext,
  RunFlowEvent,
  RunFlowSnapshot,
  RunFlowStateValue,
  WingId,
} from "./state/RunFlowMachine.js";
export {
  MIDPOINT_REVELATION_FRAGMENT_THRESHOLD,
  TOTAL_FRAGMENT_COUNT,
  createInitialRunFlowContext,
  createRunFlowActor,
  isConfluenceUnlocked,
  runFlowMachine,
} from "./state/RunFlowMachine.js";

export type { FloorPlan, RoomKind, RoomTemplate, WingDefinition, WingPlan } from "./procgen/types.js";
export { generateWingPlan, mulberry32 } from "./procgen/WingGenerator.js";

export type {
  AttackPattern,
  BossDecisionContext,
  BossDefinition,
  BossPhase,
  BossPhaseId,
} from "./bosses/types.js";
export { BossController } from "./bosses/BossController.js";
