import type { MovementState } from "@pithos/sim";
import * as THREE from "three";

/**
 * Phase 0 diagnostic overlay — not the "dev-mode room editor" described in
 * the tech spec (that's a gizmo-based room-authoring tool, needed once
 * there's more than one room to author; premature before then). This is
 * just enough to visually confirm the movement mechanics are actually
 * working: an on-screen state readout plus a ground ring that visualizes
 * the current vision radius, since "sprinting narrows vision" is invisible
 * without something rendering that radius.
 */
export class DebugHud {
  private readonly root: HTMLDivElement;
  readonly visionRing: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "fixed",
      top: "12px",
      left: "12px",
      padding: "10px 14px",
      background: "rgba(0, 0, 0, 0.55)",
      color: "#f0e6d2",
      font: "13px/1.5 ui-monospace, monospace",
      whiteSpace: "pre",
      borderRadius: "6px",
      pointerEvents: "none",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.root);

    const ringGeometry = new THREE.RingGeometry(0.98, 1, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xf0d060,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    this.visionRing = new THREE.Mesh(ringGeometry, ringMaterial);
    this.visionRing.rotation.x = -Math.PI / 2;
    scene.add(this.visionRing);
  }

  update(state: MovementState, playerPosition: THREE.Vector3): void {
    this.visionRing.position.set(playerPosition.x, 0.02, playerPosition.z);
    this.visionRing.scale.setScalar(state.visionRadius);

    this.root.textContent = [
      "WASD move · Shift sprint · C crouch · Space dash · F glide",
      "",
      `speed            ${state.speed.toFixed(2)}`,
      `visionRadius     ${state.visionRadius.toFixed(2)}`,
      `hearingRadius    ${state.hearingRadius.toFixed(2)}`,
      `crouching        ${state.isCrouching}`,
      `dashing          ${state.isDashing}${state.isInvulnerable ? "  (i-frames)" : ""}`,
      `dashCooldown     ${state.dashCooldownRemaining.toFixed(2)}`,
      `gliding          ${state.isGliding}`,
      `glideRemaining   ${state.glideRemaining.toFixed(2)}`,
    ].join("\n");
  }

  dispose(): void {
    this.root.remove();
  }
}
