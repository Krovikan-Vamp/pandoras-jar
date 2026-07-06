import type * as THREE from "three";

/**
 * The shared shape every particle-effect factory in `vfx/` returns.
 *
 * This package knows nothing about combat/game logic: a factory takes a
 * position/color/intensity-ish set of inputs and hands back a self-contained
 * `VfxEffect`. The caller (a future integration pass, not this package) is
 * responsible for:
 *   - adding `object3D` to a THREE.Scene,
 *   - calling `update(dt)` once per frame with the frame delta in seconds,
 *   - checking `isFinished` on one-shot effects and calling `dispose()` +
 *     removing `object3D` from the scene once it flips true,
 *   - calling `dispose()` itself for continuous effects (ambient fields,
 *     projectile trails) once the caller decides the effect should end.
 */
export interface VfxEffect {
  /** Root object to add to the scene. May be a single Points/Sprite or a Group. */
  readonly object3D: THREE.Object3D;

  /** Advances the effect's animation by `dt` seconds. Safe to call with dt === 0. */
  update(dt: number): void;

  /**
   * True once a one-shot effect has fully played out and can be disposed.
   * Continuous effects (ambient fields, projectile trails) never flip this on
   * their own — they run until the caller disposes them.
   */
  readonly isFinished: boolean;

  /** Frees GPU resources (geometry/material) owned exclusively by this effect. */
  dispose(): void;
}
