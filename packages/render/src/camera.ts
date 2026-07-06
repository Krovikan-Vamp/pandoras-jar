import * as THREE from "three";

/**
 * Classic isometric elevation: atan(1/sqrt(2)) ~= 35.264 degrees above the
 * horizontal plane.
 */
const ISOMETRIC_ELEVATION = Math.atan(1 / Math.sqrt(2));

/** 45 degree azimuthal spin around the Y (up) axis. */
const ISOMETRIC_AZIMUTH = Math.PI / 4;

/** Distance to pull the camera back along the isometric direction from its look target. */
const CAMERA_DISTANCE = 50;

const NEAR = 0.1;
const FAR = 100;

/**
 * Unit vector pointing from the camera's look target back toward the
 * camera, derived from ISOMETRIC_ELEVATION/ISOMETRIC_AZIMUTH. This works out
 * to (1, 1, 1) normalized — the classic isometric direction.
 */
function isometricDirection(): THREE.Vector3 {
  const horizontal = Math.cos(ISOMETRIC_ELEVATION);
  return new THREE.Vector3(
    horizontal * Math.sin(ISOMETRIC_AZIMUTH),
    Math.sin(ISOMETRIC_ELEVATION),
    horizontal * Math.cos(ISOMETRIC_AZIMUTH)
  ).normalize();
}

/**
 * Creates an orthographic camera at the classic isometric viewing angle,
 * framed by a square-ish frustum sized from `viewSize`/`aspect`.
 *
 * This factory only sets up the camera's constant angle/orientation and
 * frustum — it does not track anything. The caller (the game loop, later in
 * `apps/game`) is expected to keep the camera glued to the player each
 * frame by translating this camera's `position` by the player's world-space
 * position (e.g. `camera.position.copy(player.position).add(isoOffset)`
 * then `camera.lookAt(player.position)`), leaving the isometric
 * offset/orientation established here unchanged.
 */
export function createIsometricCamera(viewSize: number, aspect: number): THREE.OrthographicCamera {
  const halfHeight = viewSize / 2;
  const halfWidth = (viewSize * aspect) / 2;

  const camera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    NEAR,
    FAR
  );

  camera.position.copy(isometricDirection()).multiplyScalar(CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);

  return camera;
}

/** Updates an isometric camera's frustum bounds after a window/canvas resize. */
export function resizeIsometricCamera(
  camera: THREE.OrthographicCamera,
  viewSize: number,
  aspect: number
): void {
  const halfHeight = viewSize / 2;
  const halfWidth = (viewSize * aspect) / 2;

  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}
