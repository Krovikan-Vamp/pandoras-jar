import * as THREE from "three";

const RADIUS = 0.4;
const HEIGHT = 1.2;

/** Warm gold/amber — a nod to Elpis/hope theming, distinct against the grey blockout room. */
const PLACEHOLDER_COLOR = 0xe0a940;

/**
 * Creates a simple human-scale capsule mesh standing in for the player
 * character until the asset pipeline (tech spec §5-6) produces a real
 * sourced/rigged model.
 *
 * three@^0.185 ships THREE.CapsuleGeometry natively, so no cylinder+sphere
 * fallback is needed for the pinned version here.
 */
export function createPlayerPlaceholder(): THREE.Mesh {
  const geometry = new THREE.CapsuleGeometry(RADIUS, HEIGHT, 4, 8);
  const material = new THREE.MeshStandardMaterial({ color: PLACEHOLDER_COLOR });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "PlayerPlaceholder";
  // CapsuleGeometry is centered on its cylindrical axis; lift so the
  // rounded bottom rests on y = 0 (the blockout room's ground plane).
  mesh.position.y = HEIGHT / 2 + RADIUS;
  return mesh;
}
