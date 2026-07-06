import {
  createBlockoutRoom,
  createIsometricCamera,
  createPlayerPlaceholder,
  createScene,
  resizeIsometricCamera,
} from "@pithos/render";
import { MovementController, createWorld } from "@pithos/sim";
import * as THREE from "three";

import { mountAdminRouteIfRequested } from "./admin/mountAdminRoute";
import { DebugHud } from "./debug/DebugHud";
import { InputManager } from "./input/InputManager";
import { PlayerPhysics } from "./physics/PlayerPhysics";

const VIEW_SIZE = 14;
const MAX_DT = 1 / 20; // clamp large frame gaps (tab switches, etc.) to avoid a spiral of death
const SPAWN = new THREE.Vector3(0, 1, 8);

async function main(): Promise<void> {
  if (mountAdminRouteIfRequested()) return;

  const appRoot = document.querySelector<HTMLDivElement>("#app");
  if (!appRoot) throw new Error("#app root element not found");

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  appRoot.appendChild(renderer.domElement);

  const scene = createScene();
  const room = createBlockoutRoom();
  scene.add(room);

  const playerMesh = createPlayerPlaceholder();
  scene.add(playerMesh);

  const aspect = window.innerWidth / window.innerHeight;
  const camera = createIsometricCamera(VIEW_SIZE, aspect);
  // Capture the constant isometric offset the factory established (camera
  // was positioned relative to the origin) before we start re-targeting the
  // camera at the player every frame.
  const isoOffset = camera.position.clone();

  const hud = new DebugHud(scene);
  const input = new InputManager();
  const movement = new MovementController();
  // The ECS entity is the authoritative per-frame state: physics/render both
  // read from and write back to `player.position`/`player.velocity` rather
  // than passing raw THREE.Vector3s around directly. `player.movement` is
  // the same object as `movement.state` (MovementController mutates and
  // returns it in place), so it stays in sync with zero extra bookkeeping.
  const world = createWorld();
  const player = world.add({
    position: { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z },
    velocity: { x: 0, y: 0, z: 0 },
    movement: movement.state,
  });

  const physics = await PlayerPhysics.create(room, SPAWN);

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizeIsometricCamera(camera, VIEW_SIZE, window.innerWidth / window.innerHeight);
  });

  let lastTime = performance.now();

  function frame(now: number): void {
    const dt = Math.min((now - lastTime) / 1000, MAX_DT);
    lastTime = now;

    const state = movement.update(input.poll(), dt);
    player.velocity.x = state.velocity.x;
    player.velocity.z = state.velocity.z;

    const position = physics.step(state.velocity, dt);
    player.position.x = position.x;
    player.position.y = position.y;
    player.position.z = position.z;

    playerMesh.position.set(player.position.x, player.position.y, player.position.z);
    camera.position.copy(playerMesh.position).add(isoOffset);
    camera.lookAt(playerMesh.position);

    hud.update(state, playerMesh.position);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main().catch((error: unknown) => {
  console.error("Failed to start PITHOS:", error);
});
