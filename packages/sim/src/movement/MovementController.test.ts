import { describe, expect, it } from "vitest";
import { MovementController } from "./MovementController.js";
import { DEFAULT_MOVEMENT_CONFIG, type MovementInput } from "./types.js";

function makeInput(overrides: Partial<MovementInput> = {}): MovementInput {
  return {
    moveX: 0,
    moveZ: 0,
    sprintHeld: false,
    crouchHeld: false,
    dashPressed: false,
    glideHeld: false,
    ...overrides,
  };
}

describe("MovementController", () => {
  describe("speed / vision / hearing tradeoffs", () => {
    it("walking (no modifiers) uses base speed, vision, and hearing", () => {
      const controller = new MovementController();
      const state = controller.update(makeInput({ moveZ: 1 }), 1 / 60);

      expect(state.speed).toBe(DEFAULT_MOVEMENT_CONFIG.baseSpeed);
      expect(state.visionRadius).toBe(DEFAULT_MOVEMENT_CONFIG.baseVisionRadius);
      expect(state.hearingRadius).toBe(DEFAULT_MOVEMENT_CONFIG.baseHearingRadius);
    });

    it("sprinting increases speed and narrows vision relative to walking", () => {
      const walker = new MovementController();
      const walkState = walker.update(makeInput({ moveZ: 1 }), 1 / 60);

      const sprinter = new MovementController();
      const sprintState = sprinter.update(makeInput({ moveZ: 1, sprintHeld: true }), 1 / 60);

      expect(sprintState.speed).toBeGreaterThan(walkState.speed);
      expect(sprintState.visionRadius).toBeLessThan(walkState.visionRadius);
      // Sprinting doesn't affect hearing.
      expect(sprintState.hearingRadius).toBe(walkState.hearingRadius);
    });

    it("crouching narrows vision further than walking, widens hearing, and reduces speed", () => {
      const walker = new MovementController();
      const walkState = walker.update(makeInput({ moveZ: 1 }), 1 / 60);

      const crouncher = new MovementController();
      const crouchState = crouncher.update(makeInput({ moveZ: 1, crouchHeld: true }), 1 / 60);

      expect(crouchState.isCrouching).toBe(true);
      expect(crouchState.speed).toBeLessThan(walkState.speed);
      expect(crouchState.visionRadius).toBeLessThan(walkState.visionRadius);
      expect(crouchState.hearingRadius).toBeGreaterThan(walkState.hearingRadius);
    });

    it("treats crouch as taking priority when both sprint and crouch are held", () => {
      const controller = new MovementController();
      const state = controller.update(
        makeInput({ moveZ: 1, sprintHeld: true, crouchHeld: true }),
        1 / 60,
      );

      expect(state.isCrouching).toBe(true);
      expect(state.speed).toBe(DEFAULT_MOVEMENT_CONFIG.baseSpeed * DEFAULT_MOVEMENT_CONFIG.crouchSpeedMultiplier);
    });
  });

  describe("dash", () => {
    it("grants invulnerability for its duration, then starts a cooldown and blocks re-triggering until it expires", () => {
      const controller = new MovementController();
      const dt = 1 / 60;

      // Trigger the dash on a frame with nonzero move input.
      let state = controller.update(makeInput({ moveZ: 1, dashPressed: true }), dt);
      expect(state.isDashing).toBe(true);
      expect(state.isInvulnerable).toBe(true);
      expect(state.speed).toBe(
        DEFAULT_MOVEMENT_CONFIG.dashSpeedMultiplier * DEFAULT_MOVEMENT_CONFIG.baseSpeed,
      );

      // Advance through the rest of the dash duration. The triggering frame
      // above doesn't itself count toward dash-elapsed time, so this starts at 0.
      let elapsed = 0;
      while (elapsed < DEFAULT_MOVEMENT_CONFIG.dashDuration) {
        state = controller.update(makeInput({ moveZ: 1 }), dt);
        elapsed += dt;
      }

      expect(state.isDashing).toBe(false);
      expect(state.isInvulnerable).toBe(false);
      expect(state.dashCooldownRemaining).toBeGreaterThan(0);

      // A second dash press during cooldown must be ignored.
      state = controller.update(makeInput({ moveZ: 1, dashPressed: true }), dt);
      expect(state.isDashing).toBe(false);

      // Advance past the cooldown window.
      let cooldownElapsed = 0;
      while (cooldownElapsed < DEFAULT_MOVEMENT_CONFIG.dashCooldown) {
        state = controller.update(makeInput({ moveZ: 1 }), dt);
        cooldownElapsed += dt;
      }
      expect(state.dashCooldownRemaining).toBe(0);

      // Dash can now be re-triggered.
      state = controller.update(makeInput({ moveZ: 1, dashPressed: true }), dt);
      expect(state.isDashing).toBe(true);
      expect(state.isInvulnerable).toBe(true);
    });

    it("ignores a dash press with no move input instead of dashing in place", () => {
      const controller = new MovementController();
      const state = controller.update(makeInput({ dashPressed: true }), 1 / 60);

      expect(state.isDashing).toBe(false);
      expect(state.isInvulnerable).toBe(false);
    });
  });

  describe("glide", () => {
    it("drains glideRemaining while held", () => {
      const controller = new MovementController();
      const dt = 0.5;

      const state = controller.update(makeInput({ glideHeld: true }), dt);

      expect(state.isGliding).toBe(true);
      expect(state.glideRemaining).toBeCloseTo(DEFAULT_MOVEMENT_CONFIG.glideMaxDuration - dt);
    });

    it("refills glideRemaining while not held, clamped to the max", () => {
      const controller = new MovementController();

      // Drain most of the fuel first.
      controller.update(makeInput({ glideHeld: true }), 2);
      const drainedState = controller.update(makeInput({ glideHeld: true }), 0.4);
      expect(drainedState.isGliding).toBe(true);
      expect(drainedState.glideRemaining).toBeLessThan(DEFAULT_MOVEMENT_CONFIG.glideMaxDuration);

      // Release and let it refill for longer than needed; it should clamp at the max.
      const refilledState = controller.update(makeInput({ glideHeld: false }), 10);

      expect(refilledState.isGliding).toBe(false);
      expect(refilledState.glideRemaining).toBe(DEFAULT_MOVEMENT_CONFIG.glideMaxDuration);
    });

    it("stops gliding once fuel is exhausted, even while still held", () => {
      const controller = new MovementController();

      // Drain well past the max duration.
      const state = controller.update(
        makeInput({ glideHeld: true }),
        DEFAULT_MOVEMENT_CONFIG.glideMaxDuration + 1,
      );

      expect(state.glideRemaining).toBe(0);
      expect(state.isGliding).toBe(false);
    });
  });
});
