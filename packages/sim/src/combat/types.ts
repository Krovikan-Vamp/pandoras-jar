/**
 * Shared School×Form combat contracts. Every content-authoring package
 * (packages/data) and every combat subsystem (Flux/Form, perks, bosses)
 * builds against these types — they're intentionally defined once, up
 * front, rather than left for each subsystem to invent its own shape.
 */

export type FormId = "solid" | "liquid" | "gas" | "plasma";
export type SchoolId = "earth" | "fire" | "water" | "air" | "aether";

export type DamageType = "physical" | "earth" | "fire" | "water" | "air" | "aether";

export type HitboxArchetype =
  | { kind: "melee"; range: number; arcDegrees: number }
  | { kind: "wave"; range: number; width: number }
  | { kind: "projectile"; speed: number; radius: number; maxRange: number }
  | { kind: "beam"; length: number; width: number };

/** Windup/active/recovery framing shared by every attack — player, boss, or trash mob. */
export interface AttackTimeline {
  windupSeconds: number;
  activeSeconds: number;
  recoverySeconds: number;
  hitbox: HitboxArchetype;
  baseDamage: number;
}

/** A status effect application (e.g. burning, soaked, petrified) — resolved by the perk/status system, opaque here. */
export interface StatusEffectApplication {
  statusId: string;
  durationSeconds: number;
  magnitude: number;
}

export interface AbilityScript {
  id: string;
  cooldownSeconds: number;
  timeline: AttackTimeline;
  onHitStatus?: StatusEffectApplication;
}

/** The empowered burst released when swapping out of a charged Form. */
export interface BurstEffect {
  id: string;
  timeline: AttackTimeline;
  radius: number;
}

export interface ChargeParams {
  buildRatePerSecond: number;
  maxCharge: number;
  /** Fraction of maxCharge (0..1) needed on swap-out to trigger burstOnSwapOut. */
  releaseThreshold: number;
}

/** Per-Form Flux/Charge runtime state for one actor. Shape owned here; `state/FormFluxMachine.ts` implements the behavior against it. */
export interface FluxState {
  currentFlux: number;
  maxFlux: number;
  regenPerSecond: number;
  charge: Record<FormId, number>;
}

/** Shared behavior per Form — School-agnostic. */
export interface FormDefinition {
  id: FormId;
  displayName: string;
  primaryAttack: AttackTimeline;
  secondaryAbility: AbilityScript;
  moveSpeedMultiplier: number;
  fluxCostToSwapIn: number;
  chargeParams: ChargeParams;
  burstOnSwapOut: BurstEffect;
}

/** Per-(School,Form) flavor override — VFX/damage-type/minor modifiers only; big changes belong to perks. */
export interface FormFlavor {
  schoolId: SchoolId;
  formId: FormId;
  damageType: DamageType;
  /** Small multiplier on top of the Form's base damage — keep close to 1.0. */
  damageMultiplier: number;
  onHitStatus?: StatusEffectApplication;
  /** Key into packages/render's VFX recipe registry (this package knows nothing about Three.js/three.quarks). */
  vfxProfileId: string;
  /** Key into the TSL uber-shader's per-School material presets. */
  materialThemeId: string;
}

export interface PassiveEffect {
  id: string;
  description: string;
}

export interface UltimateBehavior {
  id: string;
  cooldownSeconds: number;
  timeline: AttackTimeline;
  radius: number;
}

export interface SchoolDefinition {
  id: SchoolId;
  displayName: string;
  passive: PassiveEffect;
  ultimate: UltimateBehavior;
  /** Must have exactly one entry per FormId — see `assertCompleteFlavorMap` in resolveAttack.ts. */
  flavor: Record<FormId, FormFlavor>;
}

export interface ResolvedAttack {
  timeline: AttackTimeline;
  damageType: DamageType;
  damage: number;
  onHitStatus?: StatusEffectApplication;
  vfxProfileId: string;
  materialThemeId: string;
}

export const FORM_IDS: readonly FormId[] = ["solid", "liquid", "gas", "plasma"];
export const SCHOOL_IDS: readonly SchoolId[] = ["earth", "fire", "water", "air", "aether"];
