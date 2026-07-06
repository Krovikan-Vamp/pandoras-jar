import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

const PLAYER_RADIUS = 0.4;
const PLAYER_HALF_HEIGHT = 0.6;
const GROUND_STICK_SPEED = 2;

/**
 * Builds static colliders matching the blockout room's meshes so the
 * Rapier character controller actually collides with walls/pillars/ground.
 * `packages/render`'s `createBlockoutRoom()` only produces visuals — physics
 * geometry has to be derived from it separately here, since `packages/sim`
 * and `packages/render` know nothing about each other or about Rapier.
 */
function buildStaticColliders(world: RAPIER.World, room: THREE.Group): void {
  for (const child of room.children) {
    if (!(child instanceof THREE.Mesh)) continue;

    if (child.name === "Ground") {
      const geometry = child.geometry as THREE.PlaneGeometry;
      const { width, height } = geometry.parameters;
      const desc = RAPIER.ColliderDesc.cuboid(width / 2, 0.05, height / 2).setTranslation(
        child.position.x,
        -0.05,
        child.position.z,
      );
      world.createCollider(desc);
      continue;
    }

    if (child.geometry instanceof THREE.BoxGeometry) {
      const { width, height, depth } = child.geometry.parameters;
      const desc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setTranslation(
        child.position.x,
        child.position.y,
        child.position.z,
      );
      world.createCollider(desc);
    }
  }
}

/**
 * Wraps a Rapier kinematic character controller for the player. Movement
 * feel itself (speed, dash, glide) is entirely `@pithos/sim`'s job — this
 * class only resolves a desired per-frame displacement against the room's
 * static colliders and reports back the corrected world position.
 */
export class PlayerPhysics {
  private readonly world: RAPIER.World;
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;

  private constructor(
    world: RAPIER.World,
    controller: RAPIER.KinematicCharacterController,
    body: RAPIER.RigidBody,
    collider: RAPIER.Collider,
  ) {
    this.world = world;
    this.controller = controller;
    this.body = body;
    this.collider = collider;
  }

  static async create(room: THREE.Group, spawn: THREE.Vector3): Promise<PlayerPhysics> {
    await RAPIER.init();

    // Top-down movement — no need for gravity to pull the player down; a
    // small constant downward bias (applied per-frame in `step`) is enough
    // to keep the character controller snapped to the ground/steps.
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    buildStaticColliders(world, room);

    const controller = world.createCharacterController(0.01);
    controller.setSlideEnabled(true);
    controller.enableAutostep(0.3, 0.2, true);
    controller.enableSnapToGround(0.3);

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      spawn.x,
      spawn.y,
      spawn.z,
    );
    const body = world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.capsule(PLAYER_HALF_HEIGHT, PLAYER_RADIUS);
    const collider = world.createCollider(colliderDesc, body);

    return new PlayerPhysics(world, controller, body, collider);
  }

  /** Advances the player by one frame given `@pithos/sim`'s desired XZ velocity, returns the corrected world position. */
  step(velocityXZ: { x: number; z: number }, dt: number): THREE.Vector3 {
    const desired = {
      x: velocityXZ.x * dt,
      y: -GROUND_STICK_SPEED * dt,
      z: velocityXZ.z * dt,
    };

    this.controller.computeColliderMovement(this.collider, desired);
    const corrected = this.controller.computedMovement();

    const current = this.body.translation();
    const next = {
      x: current.x + corrected.x,
      y: current.y + corrected.y,
      z: current.z + corrected.z,
    };
    this.body.setNextKinematicTranslation(next);
    this.world.step();

    const finalPos = this.body.translation();
    return new THREE.Vector3(finalPos.x, finalPos.y, finalPos.z);
  }
}
