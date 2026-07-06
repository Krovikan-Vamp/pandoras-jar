import {
  ALL_ENEMIES,
  ALL_FORMS,
  ALL_PERKS,
  ALL_SCHOOLS,
  BOSS_KENOMA,
  CONFLUENCE_ROOM_POOL,
  WING_BOSSES,
  WING_ROOMS,
} from "@pithos/data";
import {
  createBlockoutRoom,
  createIsometricCamera,
  createPlayerPlaceholder,
  createScene,
  loadGltfModel,
  resizeIsometricCamera,
  SCHOOL_PALETTE,
} from "@pithos/render";
import {
  createEventBus,
  createWorld,
  FormFluxMachine,
  generateWingPlan,
  ModifierRegistryImpl,
  MovementController,
  resolveAttack,
  SCHOOL_IDS,
  type CombatEventBus,
  type EnemyDefinition,
  type FluxState,
  type FormDefinition,
  type FormId,
  type Health,
  type Perk,
  type RoomTemplate,
  type SchoolDefinition,
  type SchoolId,
  type WingDefinition,
} from "@pithos/sim";
import * as THREE from "three";

import { DebugHud } from "../debug/DebugHud";
import { InputManager } from "../input/InputManager";
import { PlayerPhysics } from "../physics/PlayerPhysics";
import { EncounterRuntime } from "./EncounterRuntime";

const VIEW_SIZE = 14;
const MAX_DT = 1 / 20;
const SPAWN = new THREE.Vector3(0, 1, 0);
const PLAYER_MAX_HEALTH = 100;
const PLAYER_MAX_FLUX = 100;
const PLAYER_FLUX_REGEN_PER_SECOND = 6;

/** Wing id is either a real School (an ordinary wing) or "confluence" (Kenoma's domain, mixing all 5). */
export type WingId = SchoolId | "confluence";

/** Confluence has no School of its own — default its combat identity to Aether ("the synthesis element" per GDD §4), a documented simplification pending real in-hub School selection. */
const CONFLUENCE_DEFAULT_SCHOOL: SchoolId = "aether";

const SCHOOL_AMBIENT_TINT: Record<SchoolId, number> = {
  earth: 0x3a3226,
  fire: 0x3a1f1f,
  water: 0x1f2e3a,
  air: 0x2a3a3a,
  aether: 0x2a1f3a,
};

export interface HudSnapshot {
  health: Health;
  movement: ReturnType<MovementController["update"]>;
  flux: FluxState;
  currentSchool: SchoolDefinition;
  currentForm: FormDefinition;
}

export interface ExpeditionCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onPerkChoiceNeeded: (choices: [Perk, Perk, Perk]) => void;
  onRoomCleared: (ichorReward: number) => void;
  onFloorCleared: (isFinalFloor: boolean, ichorReward: number) => void;
  onBossDefeated: (ichorReward: number) => void;
  onPlayerDied: () => void;
}

const PLAYER_MODEL_PATH = "/models/characters/humanoid_base.glb";
const PLAYER_TARGET_HEIGHT = 1.8;

/** Recolors every standard material in `group` to the given School's palette. */
function applyPlayerTint(group: THREE.Object3D, schoolId: SchoolId): void {
  const palette = SCHOOL_PALETTE[schoolId];
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const tinted = materials.map((material: THREE.Material) => {
      const clone = material.clone();
      if (clone instanceof THREE.MeshStandardMaterial) {
        clone.color.setHex(palette.secondary);
        clone.emissive.setHex(palette.emissive);
        clone.emissiveIntensity = 0.4;
      }
      return clone;
    });
    child.material = Array.isArray(child.material) ? tinted : (tinted[0] ?? child.material);
  });
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

function resolveRoomSpawns(room: RoomTemplate): EnemyDefinition[] {
  const resolved: EnemyDefinition[] = [];
  for (const marker of room.spawns ?? []) {
    const candidates = ALL_ENEMIES.filter((enemy) => marker.enemyPoolTags.every((tag) => enemy.tags.includes(tag)));
    for (let i = 0; i < marker.count; i++) {
      const candidate = candidates[Math.floor(Math.random() * candidates.length)];
      if (candidate) resolved.push(candidate);
    }
  }
  return resolved;
}

/**
 * Owns the entire 3D game loop for the "inExpedition"/"bossFight" run-flow
 * states: rendering, physics, input, the School×Form combat loop, and
 * procedural room/floor progression through a single generated wing plan.
 *
 * Scope, stated plainly: one floor per wing run (not GDD's "several
 * escalating floors") and a fixed 3 combat rooms — enough to be a genuine,
 * winnable/loseable run rather than a single fight, while keeping this
 * first integration pass reviewable. Raising `roomsPerFloor`/`floorCount`
 * later is a one-line change, not an architectural one.
 */
export class ExpeditionRuntime {
  private readonly container: HTMLElement;
  private readonly callbacks: ExpeditionCallbacks;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly isoOffset: THREE.Vector3;
  private playerMesh: THREE.Object3D;
  private readonly debugHud: DebugHud;
  private readonly input: InputManager;
  private readonly movement: MovementController;
  private readonly world = createWorld();
  private readonly eventBus: CombatEventBus = createEventBus();
  private readonly modifiers = new ModifierRegistryImpl();
  private readonly flux = new FormFluxMachine(PLAYER_MAX_FLUX, PLAYER_FLUX_REGEN_PER_SECOND);
  private readonly encounter: EncounterRuntime;
  private readonly heldPerks: Perk[] = [];

  private physics: PlayerPhysics | null = null;
  private currentFormId: FormId = "solid";
  private schoolId: SchoolId = "earth";
  private wingId: WingId = "earth";
  private health: Health = { current: PLAYER_MAX_HEALTH, max: PLAYER_MAX_HEALTH };
  private combatRooms: RoomTemplate[] = [];
  private combatRoomIndex = 0;
  private awaitingPerkChoice = false;
  private attackCooldownRemaining = 0;
  private inBossFight = false;
  private playerDiedReported = false;
  private disposed = false;
  private lastTime = performance.now();
  private resizeListener: (() => void) | null = null;

  constructor(container: HTMLElement, callbacks: ExpeditionCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = createScene();
    const room = createBlockoutRoom();
    this.scene.add(room);

    this.playerMesh = createPlayerPlaceholder();
    this.scene.add(this.playerMesh);

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = createIsometricCamera(VIEW_SIZE, aspect);
    this.isoOffset = this.camera.position.clone();

    this.debugHud = new DebugHud(this.scene);
    this.input = new InputManager();
    this.movement = new MovementController();
    this.encounter = new EncounterRuntime(this.scene, {
      onRoomCleared: (ichorReward) => this.handleRoomCleared(ichorReward),
      onBossDefeated: (ichorReward) => this.handleBossDefeated(ichorReward),
      onPlayerDamaged: (amount) => this.applyDamageToPlayer(amount),
    });

    this.world.add({
      position: { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z },
      velocity: { x: 0, y: 0, z: 0 },
      movement: this.movement.state,
    });

    this.resizeListener = () => {
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      resizeIsometricCamera(this.camera, VIEW_SIZE, this.container.clientWidth / this.container.clientHeight);
    };
    window.addEventListener("resize", this.resizeListener);

    void this.initPhysics(room);
    requestAnimationFrame(this.frame);
  }

  private async initPhysics(room: THREE.Group): Promise<void> {
    this.physics = await PlayerPhysics.create(room, SPAWN);
  }

  /** Starts descending into a wing: resolves its School/room-pool/boss, generates a plan, spawns the first combat room. */
  async start(wingId: WingId): Promise<void> {
    this.wingId = wingId;
    this.schoolId = wingId === "confluence" ? CONFLUENCE_DEFAULT_SCHOOL : wingId;
    this.scene.background = new THREE.Color(SCHOOL_AMBIENT_TINT[this.schoolId]);

    await Promise.all([this.encounter.preloadModels(), this.loadPlayerModel()]);

    const roomPool = wingId === "confluence" ? CONFLUENCE_ROOM_POOL : WING_ROOMS[wingId];
    const wingDefinition: WingDefinition = {
      id: wingId,
      biomeTags: wingId === "confluence" ? [...SCHOOL_IDS] : [wingId],
      floorCount: 1,
      roomsPerFloor: 3,
    };
    const plan = generateWingPlan(wingDefinition, roomPool, Date.now());
    const floor = plan.floors[0];
    this.combatRooms = floor ? floor.rooms.filter((room) => room.kind === "combat") : [];
    this.combatRoomIndex = 0;
    this.inBossFight = false;
    await this.spawnCurrentCombatRoom();
  }

  private async loadPlayerModel(): Promise<void> {
    try {
      const group = await loadGltfModel(PLAYER_MODEL_PATH);
      applyPlayerTint(group, this.schoolId);
      const groundOffset = normalizeHeight(group, PLAYER_TARGET_HEIGHT);
      group.position.copy(this.playerMesh.position).setY(groundOffset);
      this.scene.remove(this.playerMesh);
      this.playerMesh = group;
      this.scene.add(this.playerMesh);
    } catch (error) {
      // Real model failed to load (e.g. offline dev server) — the capsule placeholder already in the scene stays as a graceful fallback.
      console.warn("ExpeditionRuntime: falling back to placeholder player mesh —", error);
    }
  }

  private async spawnCurrentCombatRoom(): Promise<void> {
    const room = this.combatRooms[this.combatRoomIndex];
    if (!room) return;
    const enemies = resolveRoomSpawns(room);
    await this.encounter.spawnRoom(enemies, this.playerMesh.position, this.schoolId);
  }

  private handleRoomCleared(ichorReward: number): void {
    if (this.inBossFight) return;
    this.callbacks.onRoomCleared(ichorReward);

    const isLastCombatRoom = this.combatRoomIndex >= this.combatRooms.length - 1;
    if (isLastCombatRoom) {
      this.callbacks.onFloorCleared(true, 0);
    }

    const choices = this.pickPerkChoices();
    this.awaitingPerkChoice = true;
    this.callbacks.onPerkChoiceNeeded(choices);
  }

  private pickPerkChoices(): [Perk, Perk, Perk] {
    const heldIds = new Set(this.heldPerks.map((perk) => perk.id));
    const pool = ALL_PERKS.filter((perk) => !heldIds.has(perk.id));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const [a, b, c] = shuffled;
    return [a ?? ALL_PERKS[0], b ?? ALL_PERKS[1], c ?? ALL_PERKS[2]] as [Perk, Perk, Perk];
  }

  /** Called by the UI layer once the player clicks a perk card. */
  async resolvePerkChoice(perk: Perk): Promise<void> {
    perk.apply(this.modifiers, this.eventBus, "player");
    this.heldPerks.push(perk);
    this.awaitingPerkChoice = false;

    const wasLastCombatRoom = this.combatRoomIndex >= this.combatRooms.length - 1;
    if (wasLastCombatRoom) {
      await this.spawnBossFight();
    } else {
      this.combatRoomIndex += 1;
      await this.spawnCurrentCombatRoom();
    }
  }

  private async spawnBossFight(): Promise<void> {
    this.inBossFight = true;
    const boss = this.wingId === "confluence" ? BOSS_KENOMA : WING_BOSSES[this.wingId];
    const bossSpawn = this.playerMesh.position.clone().add(new THREE.Vector3(0, 0, -6));
    await this.encounter.spawnBoss(boss, bossSpawn, this.schoolId);
  }

  private handleBossDefeated(ichorReward: number): void {
    this.inBossFight = false;
    this.callbacks.onBossDefeated(ichorReward);
  }

  private applyDamageToPlayer(amount: number): void {
    this.health = { ...this.health, current: Math.max(0, this.health.current - amount) };
    if (this.health.current <= 0 && !this.playerDiedReported) {
      this.playerDiedReported = true;
      this.callbacks.onPlayerDied();
    }
  }

  private readonly frame = (now: number): void => {
    if (this.disposed) return;

    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    const movementState = this.movement.update(this.input.poll(), dt);
    const [player] = this.world.with("position", "velocity", "movement");
    if (player) {
      player.velocity.x = movementState.velocity.x;
      player.velocity.z = movementState.velocity.z;
    }

    if (this.physics) {
      const position = this.physics.step(movementState.velocity, dt);
      if (player) {
        player.position.x = position.x;
        player.position.y = position.y;
        player.position.z = position.z;
      }
      this.playerMesh.position.set(position.x, position.y, position.z);
    }

    const horizontalSpeedSq = movementState.velocity.x * movementState.velocity.x + movementState.velocity.z * movementState.velocity.z;
    if (horizontalSpeedSq > 0.0001) {
      const targetYaw = Math.atan2(movementState.velocity.x, movementState.velocity.z);
      this.playerMesh.rotation.y = targetYaw;
    }

    this.camera.position.copy(this.playerMesh.position).add(this.isoOffset);
    this.camera.lookAt(this.playerMesh.position);
    this.debugHud.update(movementState, this.playerMesh.position);

    if (!this.playerDiedReported && !this.awaitingPerkChoice) {
      this.updateCombat(dt, movementState);
    }

    this.callbacks.onHudUpdate({
      health: this.health,
      movement: movementState,
      flux: this.flux.state,
      currentSchool: ALL_SCHOOLS[this.schoolId],
      currentForm: ALL_FORMS[this.currentFormId],
    });

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.frame);
  };

  private updateCombat(dt: number, movementState: ReturnType<MovementController["update"]>): void {
    const currentForm = ALL_FORMS[this.currentFormId];
    this.flux.regenerate(dt);
    this.flux.accumulateCharge(this.currentFormId, currentForm, dt);

    const requestedForm = this.input.pollFormSwap();
    if (requestedForm && requestedForm !== this.currentFormId) {
      const nextForm = ALL_FORMS[requestedForm];
      if (this.flux.canAfford(nextForm)) {
        const { released } = this.flux.consumeChargeOnSwapOut(this.currentFormId, currentForm);
        if (released) {
          const burstDamage = currentForm.burstOnSwapOut.timeline.baseDamage * this.modifiers.get("damageMultiplier");
          this.encounter.playerAreaDamage(
            this.playerMesh.position,
            currentForm.burstOnSwapOut.radius,
            burstDamage,
            this.schoolId,
          );
        }
        this.flux.spend(nextForm);
        this.currentFormId = requestedForm;
      }
    }

    if (this.attackCooldownRemaining > 0) {
      this.attackCooldownRemaining = Math.max(0, this.attackCooldownRemaining - dt);
    }

    if (this.input.pollAttack() && this.attackCooldownRemaining <= 0) {
      const resolved = resolveAttack(ALL_FORMS[this.currentFormId], ALL_SCHOOLS[this.schoolId], "primary", this.modifiers);
      // Auto-face the nearest live target rather than requiring literal
      // directional aiming (see EncounterRuntime.getNearestTargetPosition);
      // fall back to movement facing, then a fixed default, if nothing's alive to target.
      const nearestTarget = this.encounter.getNearestTargetPosition(this.playerMesh.position);
      const facing = nearestTarget
        ? new THREE.Vector3().subVectors(nearestTarget, this.playerMesh.position).setY(0)
        : new THREE.Vector3(movementState.velocity.x, 0, movementState.velocity.z);
      if (facing.lengthSq() === 0) facing.set(0, 0, -1);
      facing.normalize();
      this.encounter.playerAttack(this.playerMesh.position, facing, resolved, this.currentFormId);
      const { windupSeconds, activeSeconds, recoverySeconds } = resolved.timeline;
      // cooldownMultiplier < 1 means faster recovery (e.g. perks that speed up attacks).
      this.attackCooldownRemaining =
        (windupSeconds + activeSeconds + recoverySeconds) * this.modifiers.get("cooldownMultiplier");
    }

    this.encounter.update(dt, this.playerMesh.position);
  }

  dispose(): void {
    this.disposed = true;
    if (this.resizeListener) window.removeEventListener("resize", this.resizeListener);
    this.input.dispose();
    this.debugHud.dispose();
    this.encounter.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
