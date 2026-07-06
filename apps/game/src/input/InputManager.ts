import type { FormId, MovementInput } from "@pithos/sim";

const FORM_SWAP_KEYS: Record<string, FormId> = {
  Digit1: "solid",
  Digit2: "liquid",
  Digit3: "gas",
  Digit4: "plasma",
};

/**
 * Controls (placeholder bindings — not final, just enough to prove the
 * mechanics):
 *   WASD          move
 *   Shift         sprint (hold)
 *   C             crouch (hold)
 *   Space         dash (tap)
 *   F             glide (hold)
 *   Left click/J  attack (tap)
 *   1-4           swap to Solid/Liquid/Gas/Plasma (tap)
 */
export class InputManager {
  private readonly keys = new Set<string>();
  private dashQueued = false;
  private attackQueued = false;
  private formSwapQueued: FormId | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space" && !this.keys.has(event.code)) {
      this.dashQueued = true;
    }
    if (event.code === "KeyJ" && !this.keys.has(event.code)) {
      this.attackQueued = true;
    }
    const requestedForm = FORM_SWAP_KEYS[event.code];
    if (requestedForm && !this.keys.has(event.code)) {
      this.formSwapQueued = requestedForm;
    }
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.attackQueued = true;
    }
  };

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
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

  /** Edge-triggered: true only on the poll immediately after an attack input, then consumed. */
  pollAttack(): boolean {
    const pressed = this.attackQueued;
    this.attackQueued = false;
    return pressed;
  }

  /** Edge-triggered: the requested Form to swap into this frame, or null. */
  pollFormSwap(): FormId | null {
    const requested = this.formSwapQueued;
    this.formSwapQueued = null;
    return requested;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousedown", this.onMouseDown);
  }
}
