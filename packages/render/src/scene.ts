import * as THREE from "three";

/**
 * Creates a bare THREE.Scene with minimal, neutral lighting and a plain
 * ash-grey background color.
 *
 * Phase 0 scope: no shadows, no tone-mapped/HDR lighting rig, no elemental
 * theming — just enough light to read the blockout geometry in `blockout.ts`.
 * The "stained glass on ash" art direction and per-School lighting/material
 * work described in the tech spec's Rendering & VFX section is Phase 1+.
 */
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();

  // Plain dark ash-grey placeholder background — a nod to the game's
  // "grey ash world" direction, not final art direction.
  scene.background = new THREE.Color(0x2b2b2e);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 1.2);
  directional.position.set(5, 10, 7.5);
  scene.add(directional);

  return scene;
}
