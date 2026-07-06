import type { MovementInput } from "@pithos/sim";

/**
 * Controls (Phase 0 placeholder bindings — not final, just enough to prove
 * movement feel):
 *   WASD    move
 *   Shift   sprint (hold)
 *   C       crouch (hold)
 *   Space   dash (tap)
 *   F       glide (hold)
 */
export class InputManager {
  private readonly keys = new Set<string>();
  private dashQueued = false;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space" && !this.keys.has(event.code)) {
      this.dashQueued = true;
    }
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  /** Reads current input state into a `MovementInput` and consumes the edge-triggered dash press. */
  poll(): MovementInput {
    const moveX = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const moveZ = (this.keys.has("KeyS") ? 1 : 0) - (this.keys.has("KeyW") ? 1 : 0);

    const dashPressed = this.dashQueued;
    this.dashQueued = false;

    return {
      moveX,
      moveZ,
      sprintHeld: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      crouchHeld: this.keys.has("KeyC"),
      dashPressed,
      glideHeld: this.keys.has("KeyF"),
    };
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }
}
