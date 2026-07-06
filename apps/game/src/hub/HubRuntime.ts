import {
  createAmbientBiomeParticles,
  createIsometricCamera,
  createPlayerPlaceholder,
  createScene,
  loadGltfModel,
  resizeIsometricCamera,
  type VfxEffect,
} from "@pithos/render";
import { MovementController, type SchoolId } from "@pithos/sim";
import * as THREE from "three";

import { InputManager } from "../input/InputManager";
import { PlayerPhysics } from "../physics/PlayerPhysics";

const VIEW_SIZE = 14;
const MAX_DT = 1 / 20;
const SPAWN = new THREE.Vector3(0, 1, 0);

const PLAYER_MODEL_PATH = "/models/characters/humanoid_base.glb";
const PLAYER_TARGET_HEIGHT = 1.8;
const PILLAR_MODEL_PATH = "/models/props/pillar.glb";
const OBELISK_MODEL_PATH = "/models/props/obelisk.glb";
const CRYSTAL_MODEL_PATH = "/models/props/crystal.glb";

/** A placeholder primitive to swap for a real sourced model once it loads, keeping the
 * primitive as an already-working physics collider (see PlayerPhysics.buildStaticColliders,
 * which only recognizes THREE.BoxGeometry meshes) rather than re-deriving collision from
 * glTF geometry. */
interface DecorationSlot {
  modelPath: string;
  hideMesh: THREE.Mesh;
  position: THREE.Vector3;
  targetHeight: number;
  tint: number;
  emissive: number;
  /** "ground" (default) sits the model's base at y=0; "float" keeps `position.y` as-is. */
  mode?: "ground" | "float";
}

/** Scales `group` so its height matches `targetHeight`, returning the Y offset needed to ground it. */
function normalizeHeight(group: THREE.Object3D, targetHeight: number): number {
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  group.scale.setScalar(scale);
  const scaledBox = new THREE.Box3().setFromObject(group);
  return -scaledBox.min.y;
}

/** Recolors every standard material in `group` to the given flat color/emissive pair. */
function tintModel(group: THREE.Object3D, color: number, emissive: number): void {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const tinted = materials.map((material: THREE.Material) => {
      const clone = material.clone();
      if (clone instanceof THREE.MeshStandardMaterial) {
        clone.color.setHex(color);
        clone.emissive.setHex(emissive);
        clone.emissiveIntensity = 0.5;
      }
      return clone;
    });
    child.material = Array.isArray(child.material) ? tinted : (tinted[0] ?? child.material);
  });
}

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
const SCHOOL_SHRINE_COLORS: Record<SchoolId, number> = {
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
function buildSanctuary(group: THREE.Group, center: THREE.Vector3, decorationSlots: DecorationSlot[]): void {
  const pillar = mesh(new THREE.BoxGeometry(1, 6, 1), 0xd8c48a, "Zone_Sanctuary_Pillar");
  pillar.position.set(center.x, 3, center.z);
  group.add(pillar);

  const orb = mesh(new THREE.SphereGeometry(0.6, 16, 16), 0xfff3d0, "Zone_Sanctuary_Orb", 0xfff3d0);
  orb.position.set(center.x, 6.6, center.z);
  group.add(orb);

  decorationSlots.push(
    {
      modelPath: PILLAR_MODEL_PATH,
      hideMesh: pillar,
      position: new THREE.Vector3(center.x, 0, center.z),
      targetHeight: 6,
      tint: 0xd8c48a,
      emissive: 0xf0c56c,
    },
    {
      modelPath: CRYSTAL_MODEL_PATH,
      hideMesh: orb,
      position: new THREE.Vector3(center.x, 6.6, center.z),
      targetHeight: 1,
      tint: 0xfff3d0,
      emissive: 0xfff3d0,
      mode: "float",
    },
  );
}

/** The Threshold Gate — an archway (two pillars + a lintel) the player walks under to descend into a wing. */
function buildThresholdGate(group: THREE.Group, center: THREE.Vector3, decorationSlots: DecorationSlot[]): void {
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

  decorationSlots.push(
    {
      modelPath: PILLAR_MODEL_PATH,
      hideMesh: leftPillar,
      position: new THREE.Vector3(center.x - 1.6, 0, center.z),
      targetHeight: 3.2,
      tint: 0x4a5f7a,
      emissive: 0x2a3550,
    },
    {
      modelPath: PILLAR_MODEL_PATH,
      hideMesh: rightPillar,
      position: new THREE.Vector3(center.x + 1.6, 0, center.z),
      targetHeight: 3.2,
      tint: 0x4a5f7a,
      emissive: 0x2a3550,
    },
  );
}

/** The Reliquary — a shop stall (counter + awning). */
function buildReliquary(group: THREE.Group, center: THREE.Vector3, _decorationSlots: DecorationSlot[]): void {
  const counter = mesh(new THREE.BoxGeometry(2.4, 1, 1.2), 0x8a5a34, "Zone_Reliquary_Counter");
  counter.position.set(center.x, 0.5, center.z);
  group.add(counter);

  const canopy = mesh(new THREE.BoxGeometry(3, 0.3, 1.8), 0x7a2e3a, "Zone_Reliquary_Canopy");
  canopy.position.set(center.x, 2.4, center.z);
  group.add(canopy);
}

/** Hephaestus's Anvil — the practice range's namesake anvil block. */
function buildAnvil(group: THREE.Group, center: THREE.Vector3, _decorationSlots: DecorationSlot[]): void {
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
function buildCistern(group: THREE.Group, center: THREE.Vector3, _decorationSlots: DecorationSlot[]): void {
  const rim = mesh(new THREE.CylinderGeometry(1.9, 2, 0.3, 20, 1, true), 0x557a86, "Zone_Cistern_Rim");
  rim.position.set(center.x, 0.15, center.z);
  group.add(rim);

  const water = mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.05, 24), 0x2f8fbf, "Zone_Cistern_Water", 0x123a4a);
  water.position.set(center.x, 0.05, center.z);
  group.add(water);
}

/** The Reagent Garden — a raised planter bed with a few sprouting shapes. */
function buildGarden(group: THREE.Group, center: THREE.Vector3, _decorationSlots: DecorationSlot[]): void {
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
function buildShrines(group: THREE.Group, center: THREE.Vector3, decorationSlots: DecorationSlot[]): void {
  const schoolIds: SchoolId[] = ["earth", "fire", "water", "air", "aether"];
  const ringRadius = 1.6;
  schoolIds.forEach((schoolId, index) => {
    const angle = (index / schoolIds.length) * Math.PI * 2;
    const color = SCHOOL_SHRINE_COLORS[schoolId] ?? 0xffffff;
    const obelisk = mesh(new THREE.BoxGeometry(0.5, 1.8, 0.5), color, `Zone_Shrines_Obelisk_${schoolId}`, color);
    const x = center.x + Math.cos(angle) * ringRadius;
    const z = center.z + Math.sin(angle) * ringRadius;
    obelisk.position.set(x, 0.9, z);
    group.add(obelisk);

    decorationSlots.push({
      modelPath: OBELISK_MODEL_PATH,
      hideMesh: obelisk,
      position: new THREE.Vector3(x, 0, z),
      targetHeight: 1.8,
      tint: color,
      emissive: color,
    });
  });
}

const ZONE_BUILDERS: Record<HubRoomId, (group: THREE.Group, center: THREE.Vector3, decorationSlots: DecorationSlot[]) => void> = {
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
 * `PlayerPhysics.create` work here completely unmodified. Also collects a
 * `DecorationSlot` per primitive that has a real sourced-model replacement
 * (see `HubRuntime.loadDecorations`) — the primitive stays in the group as
 * the (already-working) physics collider and is just hidden once its real
 * model lands.
 */
function buildHubEnvironment(): { group: THREE.Group; zones: ZoneDefinition[]; decorationSlots: DecorationSlot[] } {
  const group = new THREE.Group();
  group.name = "HubEnvironment";

  buildGroundAndWalls(group);

  const decorationSlots: DecorationSlot[] = [];
  const zones = computeZoneLayout();
  for (const zone of zones) {
    ZONE_BUILDERS[zone.id](group, zone.center, decorationSlots);
  }

  return { group, zones, decorationSlots };
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
  private playerMesh: THREE.Object3D;
  private readonly input: InputManager;
  private readonly movement: MovementController;
  private readonly zones: ZoneDefinition[];
  private readonly ambientEffects: VfxEffect[] = [];

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
    const { group: hubEnvironment, zones, decorationSlots } = buildHubEnvironment();
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

    this.spawnAmbientEffects(zones);

    void this.initPhysics(hubEnvironment);
    void this.loadDecorations(decorationSlots);
    void this.loadPlayerModel();
    requestAnimationFrame(this.frame);
  }

  private async initPhysics(hubEnvironment: THREE.Group): Promise<void> {
    this.physics = await PlayerPhysics.create(hubEnvironment, SPAWN);
  }

  private async loadPlayerModel(): Promise<void> {
    try {
      const group = await loadGltfModel(PLAYER_MODEL_PATH);
      const groundOffset = normalizeHeight(group, PLAYER_TARGET_HEIGHT);
      group.position.copy(this.playerMesh.position).setY(groundOffset);
      this.scene.remove(this.playerMesh);
      this.playerMesh = group;
      this.scene.add(this.playerMesh);
    } catch {
      // Keep the placeholder capsule if the model fails to load.
    }
  }

  private async loadDecorations(slots: DecorationSlot[]): Promise<void> {
    await Promise.all(slots.map((slot) => this.loadDecoration(slot)));
  }

  private async loadDecoration(slot: DecorationSlot): Promise<void> {
    try {
      const model = await loadGltfModel(slot.modelPath);
      tintModel(model, slot.tint, slot.emissive);
      const groundOffset = normalizeHeight(model, slot.targetHeight);
      const y = slot.mode === "float" ? slot.position.y : groundOffset;
      model.position.set(slot.position.x, y, slot.position.z);
      this.scene.add(model);
      slot.hideMesh.visible = false;
    } catch {
      // Leave the primitive placeholder visible if the model fails to load.
    }
  }

  /** A twinkling gold-violet sparkle field at Elpis's Sanctuary (Aether's palette doubles as
   * "hope" here — GDD §13 describes Aether as "prismatic/starlit"), plus a matching small field
   * at each School Shrine tinted to that School, so the plaza doesn't read as flat/lifeless. */
  private spawnAmbientEffects(zones: ZoneDefinition[]): void {
    const sanctuary = zones.find((zone) => zone.id === "sanctuary");
    if (sanctuary) {
      const effect = createAmbientBiomeParticles("aether", {
        center: sanctuary.center.clone().setY(3),
        radius: 3,
      });
      this.scene.add(effect.object3D);
      this.ambientEffects.push(effect);
    }

    const shrines = zones.find((zone) => zone.id === "shrines");
    if (shrines) {
      const schoolIds: SchoolId[] = ["earth", "fire", "water", "air", "aether"];
      for (const schoolId of schoolIds) {
        const effect = createAmbientBiomeParticles(schoolId, {
          center: shrines.center.clone().setY(1),
          radius: 1.5,
        });
        this.scene.add(effect.object3D);
        this.ambientEffects.push(effect);
      }
    }
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

    const horizontalSpeedSq = movementState.velocity.x * movementState.velocity.x + movementState.velocity.z * movementState.velocity.z;
    if (horizontalSpeedSq > 0.0001) {
      this.playerMesh.rotation.y = Math.atan2(movementState.velocity.x, movementState.velocity.z);
    }

    this.camera.position.copy(this.playerMesh.position).add(this.isoOffset);
    this.camera.lookAt(this.playerMesh.position);

    this.updateZoneInteraction();

    for (const effect of this.ambientEffects) {
      effect.update(dt);
    }

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
    for (const effect of this.ambientEffects) {
      effect.dispose();
    }
    this.input.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
