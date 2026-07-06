import * as THREE from "three";

/** A uniformly-distributed random unit vector (a random point on the unit sphere). */
export function randomUnitVector(): THREE.Vector3 {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(sinPhi * Math.cos(theta), Math.cos(phi), sinPhi * Math.sin(theta));
}

/** A uniformly-distributed random point inside a sphere of the given radius, centered on the origin. */
export function randomPointInSphere(radius: number): THREE.Vector3 {
  // Cube-root the radial random sample so points are uniform by volume
  // rather than clustering toward the center.
  const distance = Math.cbrt(Math.random()) * radius;
  return randomUnitVector().multiplyScalar(distance);
}

/** A uniformly-distributed random angle, in radians, for a full horizontal turn. */
export function randomHorizontalAngle(): number {
  return Math.random() * Math.PI * 2;
}
