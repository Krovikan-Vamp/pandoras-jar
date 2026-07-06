/**
 * Per-frame player input, already normalized/debounced by the caller
 * (the future `apps/game` input layer). This package never reads raw
 * keyboard/gamepad state.
 */
export interface MovementInput {
  /** -1..1, already normalized by the caller. */
  moveX: number;
  /** -1..1, already normalized by the caller. */
  moveZ: number;
  sprintHeld: boolean;
  crouchHeld: boolean;
  /** Edge-triggered: true only on the frame the dash button was pressed. */
  dashPressed: boolean;
  glideHeld: boolean;
}

/**
 * The output of a single `MovementController.update()` call. Physics/render
 * integration layers read this every frame; nothing in here knows about
 * Rapier or Three.js.
 */
export interface MovementState {
  /** Current effective move speed, in units/sec. */
  speed: number;
  /** Current vision range. Narrows while sprinting/crouching. */
  visionRadius: number;
  /** Current hearing range. Widens while crouching. */
  hearingRadius: number;
  isCrouching: boolean;
  isDashing: boolean;
  /** True during the dash's i-frame window. */
  isInvulnerable: boolean;
  dashCooldownRemaining: number;
  isGliding: boolean;
  /** Seconds of glide fuel left. */
  glideRemaining: number;
  /** Normalized move direction * current speed, ready to hand to a physics controller. */
  velocity: { x: number; z: number };
}

export interface MovementConfig {
  baseSpeed: number;
  sprintSpeedMultiplier: number;
  crouchSpeedMultiplier: number;

  baseVisionRadius: number;
  /** < 1: sprinting narrows vision. */
  sprintVisionMultiplier: number;
  /** < 1: crouching narrows vision further than sprinting does. */
  crouchVisionMultiplier: number;

  baseHearingRadius: number;
  /** > 1: crouching widens hearing. */
  crouchHearingMultiplier: number;

  dashSpeedMultiplier: number;
  /** Seconds the dash (and its i-frames) lasts. */
  dashDuration: number;
  /** Seconds after a dash ends before another can be triggered. */
  dashCooldown: number;

  /** Max seconds of glide fuel. */
  glideMaxDuration: number;
  /** Fuel refilled per second while not actively gliding. */
  glideRefillRate: number;
}

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  baseSpeed: 6,
  sprintSpeedMultiplier: 1.6,
  crouchSpeedMultiplier: 0.5,

  baseVisionRadius: 12,
  sprintVisionMultiplier: 0.7,
  crouchVisionMultiplier: 0.55,

  baseHearingRadius: 6,
  crouchHearingMultiplier: 1.8,

  dashSpeedMultiplier: 3.5,
  dashDuration: 0.18,
  dashCooldown: 0.8,

  glideMaxDuration: 2.5,
  glideRefillRate: 1.25,
};

/** Builds a fresh, idle `MovementState` for a given config (full vision/hearing, full glide, no dash/cooldown). */
export function createMovementState(
  config: MovementConfig = DEFAULT_MOVEMENT_CONFIG,
): MovementState {
  return {
    speed: config.baseSpeed,
    visionRadius: config.baseVisionRadius,
    hearingRadius: config.baseHearingRadius,
    isCrouching: false,
    isDashing: false,
    isInvulnerable: false,
    dashCooldownRemaining: 0,
    isGliding: false,
    glideRemaining: config.glideMaxDuration,
    velocity: { x: 0, z: 0 },
  };
}
