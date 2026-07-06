import {
  DEFAULT_MOVEMENT_CONFIG,
  createMovementState,
  type MovementConfig,
  type MovementInput,
  type MovementState,
} from "./types";

/**
 * Pure, headless movement simulation: WASD-style input in, a `MovementState`
 * out. Knows nothing about physics engines, renderers, or the DOM — the
 * `apps/game` integration layer is responsible for feeding `MovementInput`
 * from real input devices and applying the resulting `velocity` to a Rapier
 * kinematic character controller.
 */
export class MovementController {
  readonly config: MovementConfig;
  readonly state: MovementState;

  private dashElapsed = 0;
  private dashDirection: { x: number; z: number } = { x: 0, z: 0 };

  constructor(
    config: MovementConfig = DEFAULT_MOVEMENT_CONFIG,
    initialState: MovementState = createMovementState(config),
  ) {
    this.config = config;
    this.state = initialState;
  }

  /** Advances the simulation by `dt` seconds and returns the (mutated) current state. */
  update(input: MovementInput, dt: number): MovementState {
    const { config, state } = this;

    this.updateDash(input, dt);
    this.updateGlide(input, dt);

    // Crouch and sprint are mutually exclusive; crouch (stealth) takes priority
    // over sprint when both are held.
    const isCrouching = input.crouchHeld;
    const isSprinting = input.sprintHeld && !isCrouching;

    let speed = config.baseSpeed;
    let visionRadius = config.baseVisionRadius;
    let hearingRadius = config.baseHearingRadius;

    if (isCrouching) {
      speed *= config.crouchSpeedMultiplier;
      visionRadius *= config.crouchVisionMultiplier;
      hearingRadius *= config.crouchHearingMultiplier;
    } else if (isSprinting) {
      speed *= config.sprintSpeedMultiplier;
      visionRadius *= config.sprintVisionMultiplier;
    }

    state.isCrouching = isCrouching;
    state.visionRadius = visionRadius;
    state.hearingRadius = hearingRadius;

    if (state.isDashing) {
      // Dashing overrides normal input-direction handling: hold the speed and
      // direction captured at dash start for the whole dash duration.
      const dashSpeed = config.dashSpeedMultiplier * config.baseSpeed;
      state.speed = dashSpeed;
      state.velocity.x = this.dashDirection.x * dashSpeed;
      state.velocity.z = this.dashDirection.z * dashSpeed;
    } else {
      const inputLength = Math.hypot(input.moveX, input.moveZ);
      const dirX = inputLength > 0 ? input.moveX / inputLength : 0;
      const dirZ = inputLength > 0 ? input.moveZ / inputLength : 0;
      state.speed = speed;
      state.velocity.x = dirX * speed;
      state.velocity.z = dirZ * speed;
    }

    return state;
  }

  private updateDash(input: MovementInput, dt: number): void {
    const { config, state } = this;

    if (state.isDashing) {
      this.dashElapsed += dt;
      if (this.dashElapsed >= config.dashDuration) {
        state.isDashing = false;
        state.isInvulnerable = false;
        state.dashCooldownRemaining = config.dashCooldown;
        this.dashElapsed = 0;
      }
      return;
    }

    if (state.dashCooldownRemaining > 0) {
      state.dashCooldownRemaining = Math.max(0, state.dashCooldownRemaining - dt);
    }

    if (!input.dashPressed || state.dashCooldownRemaining > 0) {
      return;
    }

    const inputLength = Math.hypot(input.moveX, input.moveZ);
    if (inputLength <= 0) {
      // No move direction and no last-faced-direction tracking in this
      // package yet; simplest correct behavior is to ignore the press
      // rather than dash to nowhere.
      return;
    }

    this.dashDirection = { x: input.moveX / inputLength, z: input.moveZ / inputLength };
    state.isDashing = true;
    state.isInvulnerable = true;
    this.dashElapsed = 0;
  }

  private updateGlide(input: MovementInput, dt: number): void {
    const { config, state } = this;

    if (input.glideHeld && state.glideRemaining > 0) {
      state.isGliding = true;
      state.glideRemaining = Math.max(0, state.glideRemaining - dt);
    } else {
      state.isGliding = false;
      state.glideRemaining = Math.min(
        config.glideMaxDuration,
        state.glideRemaining + config.glideRefillRate * dt,
      );
    }
  }
}
