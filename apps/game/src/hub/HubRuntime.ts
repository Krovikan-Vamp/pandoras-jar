import { createIsometricCamera, createPlayerPlaceholder, createScene, resizeIsometricCamera } from "@pithos/render";
import { MovementController } from "@pithos/sim";
import * as THREE from "three";

import { InputManager } from "../input/InputManager";
import { PlayerPhysics } from "../physics/PlayerPhysics";

const VIEW_SIZE = 14;
const MAX_DT = 1 / 20;
const SPAWN = new THREE.Vector3(0, 1, 0);

/** How close (world units, XZ-plane) the player must be to a zone's center to be considered "nearby" it. */
const INTERACT_RADIUS = 2.5;

/** Distance from the plaza center to every zone marker (see `computeZoneLayout`). */
const PLAZA_RADIUS = 11;

const GROUND_SIZE = 36;
const BOUNDARY_HALF_SIZE = GROUND_SIZE / 2;
const WALL_HEIGHT = 4;
const WALL_THICKNESS = 1;

/**
 * The 7 physical zones of the hub, per GDD §8 ("The Hub — Elpis's Threshold").
 * These exact ids are load-bearing: a sibling integration pass maps them
 * onto `HubScreen`'s existing internal room tabs, so they stay semantically
 * obvious rather than terse/abbreviated.
 */
export type HubRoomId = "sanctuary" | "threshold" | "reliquary" | "anvil" | "cistern" | "garden" | "shrines";

export interface HubRuntimeCallbacks {
  /** Fires once when the player presses interact while `getNearbyZone()` is non-null. */
  onZoneInteract: (roomId: HubRoomId) => void;
  /** Fires whenever proximity state changes (including transitions to/from `null`) so the UI can show/hide an interact prompt. */
  onNearbyZoneChanged: (roomId: HubRoomId | null) => void;
}

/** A zone's id and world-space (ground-level) center, used for proximity checks against the player. */
interface ZoneDefinition {
  id: HubRoomId;
  center: THREE.Vector3;
}

/** Elemental accent colors for the School Shrines ring — a brighter, more "marker-legible" palette than combat's ambient tints, not meant to match them exactly. */
const SCHOOL_SHRINE_COLORS: Record<string, number> = {
  earth: 0x6b8f3a,
  fire: 0xc84a2a,
  water: 0x2f7fae,
  air: 0x9fe0da,
  aether: 0x8a4fd9,
};

function mesh(geometry: THREE.BufferGeometry, color: number, name: string, emissive?: number): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: emissive ?? 0x000000,
    emissiveIntensity: emissive !== undefined ? 1 : 0,
  });
  const built = new THREE.Mesh(geometry, material);
  built.name = name;
  return built;
}

/**
 * Places the 7 hub zones evenly around a circle (a heptagon plaza) centered
 * on the spawn point, starting at "north" (-Z) and proceeding clockwise in
 * GDD §8's table order. Deliberately not mirrored/symmetric the way a 4- or
 * 6-sided layout would be — with an odd zone count that reads as a real,
 * slightly irregular town square rather than a grid of identical boxes.
 */
function computeZoneLayout(): ZoneDefinition[] {
  const order: HubRoomId[] = ["sanctuary", "threshold", "reliquary", "anvil", "cistern", "garden", "shrines"];
  const angleStep = (Math.PI * 2) / order.length;
  return order.map((id, index) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const x = Math.cos(angle) * PLAZA_RADIUS;
    const z = Math.sin(angle) * PLAZA_RADIUS;
    return { id, center: new THREE.Vector3(x, 0, z) };
  });
}

/** Ground plane + 4 boundary walls, following `packages/render/src/blockout.ts`'s naming convention exactly (`"Ground"` + `THREE.BoxGeometry` walls) so `PlayerPhysics.create`'s collider builder picks them up with zero changes there. */
function buildGroundAndWalls(group: THREE.Group): void {
  const ground = mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), 0x4a4438, "Ground");
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const span = GROUND_SIZE + WALL_THICKNESS;

  const northWall = mesh(new THREE.BoxGeometry(span, WALL_HEIGHT, WALL_THICKNESS), 0x5c5344, "BoundaryWallNorth");
  northWall.position.set(0, WALL_HEIGHT / 2, -BOUNDARY_HALF_SIZE);

  const southWall = mesh(new THREE.BoxGeometry(span, WALL_HEIGHT, WALL_THICKNESS), 0x554c3f, "BoundaryWallSouth");
  southWall.position.set(0, WALL_HEIGHT / 2, BOUNDARY_HALF_SIZE);

  const eastWall = mesh(new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, span), 0x615846, "BoundaryWallEast");
  eastWall.position.set(BOUNDARY_HALF_SIZE, WALL_HEIGHT / 2, 0);

  const westWall = mesh(new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, span), 0x504839, "BoundaryWallWest");
  westWall.position.set(-BOUNDARY_HALF_SIZE, WALL_HEIGHT / 2, 0);

  group.add(northWall, southWall, eastWall, westWall);
}

/** Elpis's Sanctuary — a tall glowing pillar, the narrative anchor/save point. */
function buildSanctuary(group: THREE.Group, center: THREE.Vector3): void {
  const pillar = mesh(new THREE.BoxGeometry(1, 6, 1), 0xd8c48a, "Zone_Sanctuary_Pillar");
  pillar.position.set(center.x, 3, center.z);
  group.add(pillar);

  const orb = mesh(new THREE.SphereGeometry(0.6, 16, 16), 0xfff3d0, "Zone_Sanctuary_Orb", 0xfff3d0);
  orb.position.set(center.x, 6.6, center.z);
  group.add(orb);
}

/** The Threshold Gate — an archway (two pillars + a lintel) the player walks under to descend into a wing. */
function buildThresholdGate(group: THREE.Group, center: THREE.Vector3): void {
  const pillarGeometry = new THREE.BoxGeometry(0.8, 3.2, 0.8);

  const leftPillar = mesh(pillarGeometry, 0x4a5f7a, "Zone_Threshold_PillarLeft");
  leftPillar.position.set(center.x - 1.6, 1.6, center.z);
  group.add(leftPillar);

  const rightPillar = mesh(pillarGeometry, 0x4a5f7a, "Zone_Threshold_PillarRight");
  rightPillar.position.set(center.x + 1.6, 1.6, center.z);
  group.add(rightPillar);

  // Lintel sits well above the player's ~2-unit capsule height, so the
  // archway is walk-through-able despite also being a Box collider.
  const lintel = mesh(new THREE.BoxGeometry(4, 0.7, 0.8), 0x8a5fd9, "Zone_Threshold_Lintel", 0x8a5fd9);
  lintel.position.set(center.x, 3.55, center.z);
  group.add(lintel);
}

/** The Reliquary — a shop stall (counter + awning). */
function buildReliquary(group: THREE.Group, center: THREE.Vector3): void {
  const counter = mesh(new THREE.BoxGeometry(2.4, 1, 1.2), 0x8a5a34, "Zone_Reliquary_Counter");
  counter.position.set(center.x, 0.5, center.z);
  group.add(counter);

  const canopy = mesh(new THREE.BoxGeometry(3, 0.3, 1.8), 0x7a2e3a, "Zone_Reliquary_Canopy");
  canopy.position.set(center.x, 2.4, center.z);
  group.add(canopy);
}

/** Hephaestus's Anvil — the practice range's namesake anvil block. */
function buildAnvil(group: THREE.Group, center: THREE.Vector3): void {
  const base = mesh(new THREE.BoxGeometry(1.6, 0.9, 1), 0x2e2e30, "Zone_Anvil_Base");
  base.position.set(center.x, 0.45, center.z);
  group.add(base);

  const horn = mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), 0x3a3a3d, "Zone_Anvil_Horn");
  horn.position.set(center.x + 0.9, 1.15, center.z);
  group.add(horn);

  const embers = mesh(new THREE.SphereGeometry(0.2, 12, 12), 0xff7020, "Zone_Anvil_Embers", 0xff7020);
  embers.position.set(center.x, 1, center.z);
  group.add(embers);
}

/** The Danaids' Cistern — a shallow, walkable water basin (decorative only; no collision, matching "shallow" and "endless" — nothing about it should block movement). */
function buildCistern(group: THREE.Group, center: THREE.Vector3): void {
  const rim = mesh(new THREE.CylinderGeometry(1.9, 2, 0.3, 20, 1, true), 0x557a86, "Zone_Cistern_Rim");
  rim.position.set(center.x, 0.15, center.z);
  group.add(rim);

  const water = mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.05, 24), 0x2f8fbf, "Zone_Cistern_Water", 0x123a4a);
  water.position.set(center.x, 0.05, center.z);
  group.add(water);
}

/** The Reagent Garden — a raised planter bed with a few sprouting shapes. */
function buildGarden(group: THREE.Group, center: THREE.Vector3): void {
  const planter = mesh(new THREE.BoxGeometry(2.4, 0.6, 2.4), 0x5a4530, "Zone_Garden_Planter");
  planter.position.set(center.x, 0.3, center.z);
  group.add(planter);

  const sproutOffsets: Array<[number, number]> = [
    [-0.7, -0.5],
    [0.6, -0.2],
    [-0.2, 0.7],
  ];
  sproutOffsets.forEach(([dx, dz], index) => {
    const sprout = mesh(new THREE.ConeGeometry(0.25, 0.7, 8), 0x4caf50, `Zone_Garden_Sprout${index}`);
    sprout.position.set(center.x + dx, 0.95, center.z + dz);
    group.add(sprout);
  });
}

/** School Shrines — 5 small obelisks in a ring, one per School, per GDD §8. */
function buildShrines(group: THREE.Group, center: THREE.Vector3): void {
  const schoolIds = ["earth", "fire", "water", "air", "aether"];
  const ringRadius = 1.6;
  schoolIds.forEach((schoolId, index) => {
    const angle = (index / schoolIds.length) * Math.PI * 2;
    const color = SCHOOL_SHRINE_COLORS[schoolId] ?? 0xffffff;
    const obelisk = mesh(new THREE.BoxGeometry(0.5, 1.8, 0.5), color, `Zone_Shrines_Obelisk_${schoolId}`, color);
    obelisk.position.set(center.x + Math.cos(angle) * ringRadius, 0.9, center.z + Math.sin(angle) * ringRadius);
    group.add(obelisk);
  });
}

const ZONE_BUILDERS: Record<HubRoomId, (group: THREE.Group, center: THREE.Vector3) => void> = {
  sanctuary: buildSanctuary,
  threshold: buildThresholdGate,
  reliquary: buildReliquary,
  anvil: buildAnvil,
  cistern: buildCistern,
  garden: buildGarden,
  shrines: buildShrines,
};

/**
 * Builds the hub's town-square environment as a single flat `THREE.Group`
 * (ground/walls/zone-marker meshes all as direct children, no nested
 * sub-groups) — `PlayerPhysics`'s collider builder only walks a room
 * group's direct children, so keeping everything flat is what makes
 * `PlayerPhysics.create` work here completely unmodified.
 */
function buildHubEnvironment(): { group: THREE.Group; zones: ZoneDefinition[] } {
  const group = new THREE.Group();
  group.name = "HubEnvironment";

  buildGroundAndWalls(group);

  const zones = computeZoneLayout();
  for (const zone of zones) {
    ZONE_BUILDERS[zone.id](group, zone.center);
  }

  return { group, zones };
}

/**
 * Owns the entire 3D game loop for the hub ("Elpis's Threshold", GDD §8): a
 * walkable town square laid out with the 7 hub zones, using the exact same
 * rendering/movement/physics/camera pattern as `ExpeditionRuntime` (same
 * `@pithos/render` scene/camera/placeholder factories, same
 * `PlayerPhysics`/`InputManager`/`MovementController`), minus every combat
 * system (no Flux/Form/attack/encounter logic at all) and plus
 * proximity-based zone interaction in their place.
 *
 * Interact key: reuses `InputManager.pollAttack()` as-is (left-click/J,
 * edge-triggered) rather than adding a new binding — in the hub this input
 * means "interact with the nearby zone" instead of "attack".
 */
export class HubRuntime {
  private readonly container: HTMLElement;
  private readonly callbacks: HubRuntimeCallbacks;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly isoOffset: THREE.Vector3;
  private readonly playerMesh: THREE.Mesh;
  private readonly input: InputManager;
  private readonly movement: MovementController;
  private readonly zones: ZoneDefinition[];

  private physics: PlayerPhysics | null = null;
  private nearbyZone: HubRoomId | null = null;
  private disposed = false;
  private lastTime = performance.now();
  private resizeListener: (() => void) | null = null;

  constructor(container: HTMLElement, callbacks: HubRuntimeCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = createScene();
    const { group: hubEnvironment, zones } = buildHubEnvironment();
    this.scene.add(hubEnvironment);
    this.zones = zones;

    this.playerMesh = createPlayerPlaceholder();
    this.scene.add(this.playerMesh);

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = createIsometricCamera(VIEW_SIZE, aspect);
    this.isoOffset = this.camera.position.clone();

    this.input = new InputManager();
    this.movement = new MovementController();

    this.resizeListener = () => {
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      resizeIsometricCamera(this.camera, VIEW_SIZE, this.container.clientWidth / this.container.clientHeight);
    };
    window.addEventListener("resize", this.resizeListener);

    void this.initPhysics(hubEnvironment);
    requestAnimationFrame(this.frame);
  }

  private async initPhysics(hubEnvironment: THREE.Group): Promise<void> {
    this.physics = await PlayerPhysics.create(hubEnvironment, SPAWN);
  }

  /** The zone the player is currently standing near, or `null`. Mirrors the last value delivered via `onNearbyZoneChanged`. */
  getNearbyZone(): HubRoomId | null {
    return this.nearbyZone;
  }

  private readonly frame = (now: number): void => {
    if (this.disposed) return;

    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    const movementState = this.movement.update(this.input.poll(), dt);

    if (this.physics) {
      const position = this.physics.step(movementState.velocity, dt);
      this.playerMesh.position.set(position.x, position.y, position.z);
    }

    this.camera.position.copy(this.playerMesh.position).add(this.isoOffset);
    this.camera.lookAt(this.playerMesh.position);

    this.updateZoneInteraction();

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.frame);
  };

  private updateZoneInteraction(): void {
    const closest = this.findNearbyZone();
    if (closest !== this.nearbyZone) {
      this.nearbyZone = closest;
      this.callbacks.onNearbyZoneChanged(closest);
    }

    // Always poll (edge-triggered, consumes the queued press) even with no
    // nearby zone, so a press made just outside interact range doesn't leak
    // into a later frame once the player has walked into range.
    const interactPressed = this.input.pollAttack();
    if (interactPressed && this.nearbyZone) {
      this.callbacks.onZoneInteract(this.nearbyZone);
    }
  }

  private findNearbyZone(): HubRoomId | null {
    let nearestId: HubRoomId | null = null;
    let nearestDistanceSq = INTERACT_RADIUS * INTERACT_RADIUS;

    for (const zone of this.zones) {
      const dx = this.playerMesh.position.x - zone.center.x;
      const dz = this.playerMesh.position.z - zone.center.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq <= nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearestId = zone.id;
      }
    }

    return nearestId;
  }

  dispose(): void {
    this.disposed = true;
    if (this.resizeListener) window.removeEventListener("resize", this.resizeListener);
    this.input.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
