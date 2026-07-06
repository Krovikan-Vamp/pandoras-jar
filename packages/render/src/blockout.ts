import * as THREE from "three";

const ROOM_SIZE = 24;
const WALL_HEIGHT = 4;
const WALL_THICKNESS = 1;
const PILLAR_SIZE = 1.5;
const PILLAR_HEIGHT = 4;

function boxMesh(geometry: THREE.BufferGeometry, color: number, name: string): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

/**
 * Builds a simple grey-boxed blockout test room: a ground plane, four
 * boundary walls, and two standalone interior pillar obstacles (for testing
 * movement-around-obstacles feel later). Every mesh uses a slightly
 * different grey tone purely so shapes are distinguishable in a screenshot —
 * placeholder blockout art, not final art direction.
 *
 * Returned as a single Group so the caller can just `scene.add(createBlockoutRoom())`.
 */
export function createBlockoutRoom(): THREE.Group {
  const group = new THREE.Group();
  group.name = "BlockoutRoom";

  const half = ROOM_SIZE / 2;
  const wallSpan = ROOM_SIZE + WALL_THICKNESS;

  const ground = boxMesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    0x6b6b6b,
    "Ground"
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const northWall = boxMesh(
    new THREE.BoxGeometry(wallSpan, WALL_HEIGHT, WALL_THICKNESS),
    0x828282,
    "WallNorth"
  );
  northWall.position.set(0, WALL_HEIGHT / 2, -half);

  const southWall = boxMesh(
    new THREE.BoxGeometry(wallSpan, WALL_HEIGHT, WALL_THICKNESS),
    0x7a7a7a,
    "WallSouth"
  );
  southWall.position.set(0, WALL_HEIGHT / 2, half);

  const eastWall = boxMesh(
    new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, wallSpan),
    0x8c8c8c,
    "WallEast"
  );
  eastWall.position.set(half, WALL_HEIGHT / 2, 0);

  const westWall = boxMesh(
    new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, wallSpan),
    0x767676,
    "WallWest"
  );
  westWall.position.set(-half, WALL_HEIGHT / 2, 0);

  group.add(northWall, southWall, eastWall, westWall);

  const pillarA = boxMesh(
    new THREE.BoxGeometry(PILLAR_SIZE, PILLAR_HEIGHT, PILLAR_SIZE),
    0x999999,
    "PillarA"
  );
  pillarA.position.set(-5, PILLAR_HEIGHT / 2, -3);

  const pillarB = boxMesh(
    new THREE.BoxGeometry(PILLAR_SIZE, PILLAR_HEIGHT, PILLAR_SIZE),
    0x8f8f8f,
    "PillarB"
  );
  pillarB.position.set(6, PILLAR_HEIGHT / 2, 4);

  group.add(pillarA, pillarB);

  return group;
}
