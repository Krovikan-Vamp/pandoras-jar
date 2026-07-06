import {
  createAmbientBiomeParticles,
  createChargeBurstEffect,
  createFormCastEffect,
  createHitImpact,
  createProjectileTrail,
  loadGltfModel,
  SCHOOL_PALETTE,
  type ProjectileTrailEffect,
  type VfxEffect,
} from "@pithos/render";
import type {
  AttackPattern,
  BossDecisionContext,
  BossDefinition,
  EnemyDefinition,
  FormId,
  HitboxArchetype,
  ResolvedAttack,
  SchoolId,
} from "@pithos/sim";
import { BossController, SCHOOL_IDS } from "@pithos/sim";
import * as THREE from "three";

/**
 * The moment-to-moment combat runtime: spawns trash-mob/boss encounters as
 * real (sourced, license-tracked — see assets/models/SOURCES.md) glTF
 * models, drives their AI each frame, resolves player attacks against
 * them, fires real traveling projectiles for ranged attacks, and layers in
 * the VFX library (packages/render/src/vfx) for hits/casts/bursts/ambient
 * biome particles. This is still a simplified combat simulation, not a
 * full physics engine — see the inline notes for exactly what's
 * approximated and why.
 *
 * Simplifications, stated plainly:
 * - Enemies move by directly lerping toward the player each frame (no
 *   Rapier body, no obstacle avoidance) — acceptable for blockout-room
 *   combat encounters; a later pass could give them real kinematic
 *   controllers matching PlayerPhysics.
 * - Melee/wave attacks collapse to a simple radius check rather than a
 *   faithful geometric arc/cone simulation. Projectile attacks DO travel
 *   as real moving meshes with real flight time (distance/speed) and
 *   apply damage based on where their target actually is on arrival — a
 *   real projectile a target can dodge by moving, not an instant hit-scan.
 *   Beam attacks render an instant visual flash (a beam is, per its own
 *   AttackTimeline, near-instantaneous) rather than a slow travel.
 * - Boss/enemy models all draw from the same 4 sourced meshes
 *   (humanoid/fox/robot/large-humanoid) tinted per School — there's no
 *   unique silhouette per named enemy/boss yet, just consistent
 *   category→model mapping plus real-time material recoloring.
 */

const PLAYER_ATTACK_FORWARD_OFFSET = 0.5;
const PROJECTILE_HIT_RADIUS = 0.9;
const BEAM_FLASH_DURATION_SECONDS = 0.15;

const MODEL_PATH = {
  humanoid: "/models/characters/humanoid_base.glb",
  fox: "/models/creatures/fox_creature.glb",
  robot: "/models/creatures/robot_construct.glb",
  largeHumanoid: "/models/creatures/large_humanoid_figure.glb",
} as const;

const ENEMY_TARGET_HEIGHT: Record<EnemyDefinition["category"], number> = {
  homunculus: 1.1,
  elemental_wildlife: 0.7,
  undead: 1.7,
  rival_alchemist: 1.7,
};

const BOSS_TARGET_HEIGHT = 3.2;

function modelPathForEnemy(category: EnemyDefinition["category"]): string {
  switch (category) {
    case "homunculus":
      return MODEL_PATH.robot;
    case "elemental_wildlife":
      return MODEL_PATH.fox;
    case "undead":
    case "rival_alchemist":
      return MODEL_PATH.humanoid;
  }
}

/** Finds a School tag among an enemy's tags for VFX/tint theming, falling back to a neutral default. */
function schoolTagOf(tags: string[]): SchoolId {
  const schoolIdSet: readonly string[] = SCHOOL_IDS;
  const found = tags.find((tag) => schoolIdSet.includes(tag));
  return (found as SchoolId | undefined) ?? "earth";
}

function hitboxRange(hitbox: HitboxArchetype): number {
  switch (hitbox.kind) {
    case "melee":
      return hitbox.range;
    case "wave":
      return hitbox.range;
    case "projectile":
      return hitbox.maxRange;
    case "beam":
      return hitbox.length;
  }
}

function hitboxSpeed(hitbox: HitboxArchetype): number {
  return hitbox.kind === "projectile" ? hitbox.speed : 14;
}

/** Scales `group` so its height matches `targetHeight`, returning the Y offset needed to ground it at the given base position. */
function normalizeHeight(group: THREE.Object3D, targetHeight: number): number {
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  group.scale.setScalar(scale);
  const scaledBox = new THREE.Box3().setFromObject(group);
  return -scaledBox.min.y;
}

/** Recolors every standard material in `group` to the given School's palette — this is how one sourced mesh serves every enemy/boss that shares its category. */
function applyTint(group: THREE.Object3D, schoolId: SchoolId): void {
  const palette = SCHOOL_PALETTE[schoolId];
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const tinted = materials.map((material: THREE.Material) => {
      const clone = material.clone();
      if (clone instanceof THREE.MeshStandardMaterial) {
        clone.color.setHex(palette.primary);
        clone.emissive.setHex(palette.emissive);
        clone.emissiveIntensity = 0.3;
      }
      return clone;
    });
    child.material = Array.isArray(child.material) ? tinted : (tinted[0] ?? child.material);
  });
}

interface LiveEnemy {
  definition: EnemyDefinition;
  mesh: THREE.Object3D;
  health: number;
  attackCooldownRemaining: number;
  schoolId: SchoolId;
}

interface LiveBoss {
  definition: BossDefinition;
  controller: BossController;
  mesh: THREE.Object3D;
  elapsedSeconds: number;
  telegraph: { pattern: AttackPattern; remainingSeconds: number } | null;
  schoolId: SchoolId;
}

interface LiveProjectile {
  mesh: THREE.Mesh;
  trail: ProjectileTrailEffect;
  origin: THREE.Vector3;
  destination: THREE.Vector3;
  elapsedSeconds: number;
  durationSeconds: number;
  damage: number;
  ownedByPlayer: boolean;
  schoolId: SchoolId;
}

export interface EncounterCallbacks {
  onRoomCleared: (ichorReward: number) => void;
  onBossDefeated: (ichorReward: number) => void;
  onPlayerDamaged: (amount: number) => void;
}

const ROOM_CLEAR_ICHOR_REWARD = 15;
const BOSS_DEFEAT_ICHOR_REWARD = 100;

export class EncounterRuntime {
  private readonly scene: THREE.Scene;
  private readonly callbacks: EncounterCallbacks;
  private readonly random: () => number;

  private enemies: LiveEnemy[] = [];
  private boss: LiveBoss | null = null;
  private roomClearReported = false;
  private projectiles: LiveProjectile[] = [];
  private oneShotVfx: VfxEffect[] = [];
  private ambientVfx: VfxEffect | null = null;
  private readonly modelTemplates = new Map<string, THREE.Group>();

  constructor(scene: THREE.Scene, callbacks: EncounterCallbacks, random: () => number = Math.random) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.random = random;
  }

  /** Warms the glTF loader cache for every model this runtime uses — call once before the first spawn so mid-run spawns never visibly pop in. */
  async preloadModels(): Promise<void> {
    await Promise.all(Object.values(MODEL_PATH).map((path) => loadGltfModel(path)));
  }

  /** True while any trash enemy or boss is still alive — the caller gates player-attack input etc. on this if desired, though it's not required to. */
  get isActive(): boolean {
    return this.enemies.length > 0 || this.boss !== null;
  }

  /**
   * Nearest live enemy/boss position to `from`, or null if nothing's alive.
   * Used to auto-face the player's attack at a target rather than requiring
   * literal directional aiming (this is a top-down isometric action game,
   * not a twin-stick shooter — auto-facing the nearest threat is the more
   * forgiving, genre-appropriate default, matching e.g. Hades' melee aim).
   */
  getNearestTargetPosition(from: THREE.Vector3): THREE.Vector3 | null {
    let nearest: THREE.Vector3 | null = null;
    let nearestDistance = Infinity;
    for (const enemy of this.enemies) {
      const distance = from.distanceTo(enemy.mesh.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = enemy.mesh.position;
      }
    }
    if (this.boss) {
      const distance = from.distanceTo(this.boss.mesh.position);
      if (distance < nearestDistance) {
        nearest = this.boss.mesh.position;
      }
    }
    return nearest;
  }

  private async loadTintedModel(path: string, schoolId: SchoolId, targetHeight: number): Promise<THREE.Group> {
    const group = await loadGltfModel(path);
    applyTint(group, schoolId);
    const groundOffset = normalizeHeight(group, targetHeight);
    group.position.y = groundOffset;
    return group;
  }

  async spawnRoom(definitions: EnemyDefinition[], center: THREE.Vector3, biomeSchoolId: SchoolId): Promise<void> {
    this.clear();
    this.roomClearReported = false;
    this.setAmbient(biomeSchoolId, center);

    await Promise.all(
      definitions.map(async (definition, index) => {
        const angle = (index / Math.max(definitions.length, 1)) * Math.PI * 2;
        const spawnRadius = 3;
        const enemySchool = schoolTagOf(definition.tags);
        const group = await this.loadTintedModel(
          modelPathForEnemy(definition.category),
          enemySchool,
          ENEMY_TARGET_HEIGHT[definition.category],
        );
        group.position.x = center.x + Math.cos(angle) * spawnRadius;
        group.position.z = center.z + Math.sin(angle) * spawnRadius;
        this.scene.add(group);
        this.enemies.push({
          definition,
          mesh: group,
          health: definition.maxHealth,
          attackCooldownRemaining: 0,
          schoolId: enemySchool,
        });
      }),
    );
  }

  async spawnBoss(definition: BossDefinition, position: THREE.Vector3, schoolId: SchoolId): Promise<void> {
    this.clear();
    this.setAmbient(schoolId, position, 10);

    const group = await this.loadTintedModel(MODEL_PATH.largeHumanoid, schoolId, BOSS_TARGET_HEIGHT);
    group.position.x = position.x;
    group.position.z = position.z;
    this.scene.add(group);

    this.boss = {
      definition,
      controller: new BossController(definition, this.random),
      mesh: group,
      elapsedSeconds: 0,
      telegraph: null,
      schoolId,
    };
  }

  private setAmbient(schoolId: SchoolId, center: THREE.Vector3, radius = 6): void {
    this.ambientVfx?.dispose();
    const effect = createAmbientBiomeParticles(schoolId, { center, radius });
    this.scene.add(effect.object3D);
    this.ambientVfx = effect;
  }

  private spawnOneShot(effect: VfxEffect): void {
    this.scene.add(effect.object3D);
    this.oneShotVfx.push(effect);
  }

  clear(): void {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.mesh);
    }
    this.enemies = [];
    if (this.boss) {
      this.scene.remove(this.boss.mesh);
      this.boss = null;
    }
    for (const projectile of this.projectiles) {
      this.scene.remove(projectile.mesh);
      this.scene.remove(projectile.trail.object3D);
      projectile.trail.dispose();
    }
    this.projectiles = [];
    for (const effect of this.oneShotVfx) {
      this.scene.remove(effect.object3D);
      effect.dispose();
    }
    this.oneShotVfx = [];
    if (this.ambientVfx) {
      this.scene.remove(this.ambientVfx.object3D);
      this.ambientVfx.dispose();
      this.ambientVfx = null;
    }
  }

  /** Advances enemy/boss AI, in-flight projectiles, and VFX; resolves any attacks that land on the player this frame. */
  update(dt: number, playerPosition: THREE.Vector3): void {
    this.updateTrashEnemies(dt, playerPosition);
    this.updateBoss(dt, playerPosition);
    this.updateProjectiles(dt, playerPosition);
    this.updateVfx(dt);
  }

  private updateVfx(dt: number): void {
    this.ambientVfx?.update(dt);
    this.oneShotVfx = this.oneShotVfx.filter((effect) => {
      effect.update(dt);
      if (effect.isFinished) {
        this.scene.remove(effect.object3D);
        effect.dispose();
        return false;
      }
      return true;
    });
  }

  private updateTrashEnemies(dt: number, playerPosition: THREE.Vector3): void {
    for (const enemy of this.enemies) {
      const toPlayer = new THREE.Vector3().subVectors(playerPosition, enemy.mesh.position);
      toPlayer.y = 0;
      const distance = toPlayer.length();
      const attackRange = hitboxRange(enemy.definition.attack.hitbox);

      if (distance > attackRange) {
        toPlayer.normalize();
        enemy.mesh.position.addScaledVector(toPlayer, enemy.definition.moveSpeed * dt);
        enemy.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      } else if (enemy.attackCooldownRemaining <= 0) {
        this.fireAttack(enemy.mesh.position, playerPosition, enemy.definition.attack.hitbox, enemy.definition.attack.baseDamage, enemy.schoolId, false);
        const timeline = enemy.definition.attack;
        enemy.attackCooldownRemaining = timeline.windupSeconds + timeline.activeSeconds + timeline.recoverySeconds;
      }

      if (enemy.attackCooldownRemaining > 0) {
        enemy.attackCooldownRemaining = Math.max(0, enemy.attackCooldownRemaining - dt);
      }
    }

    this.enemies = this.enemies.filter((enemy) => {
      if (enemy.health > 0) return true;
      this.scene.remove(enemy.mesh);
      return false;
    });

    if (this.enemies.length === 0 && !this.roomClearReported && !this.boss) {
      this.roomClearReported = true;
      this.callbacks.onRoomCleared(ROOM_CLEAR_ICHOR_REWARD);
    }
  }

  private updateBoss(dt: number, playerPosition: THREE.Vector3): void {
    const boss = this.boss;
    if (!boss) return;

    const toPlayer = new THREE.Vector3().subVectors(playerPosition, boss.mesh.position);
    toPlayer.y = 0;
    const distanceToPlayer = toPlayer.length();
    boss.elapsedSeconds += dt;

    const ctx: BossDecisionContext = {
      currentHealthFraction: boss.controller.getHealthFraction(),
      distanceToPlayer,
      elapsedSeconds: boss.elapsedSeconds,
    };
    boss.controller.update(ctx, dt);

    if (boss.telegraph) {
      boss.telegraph.remainingSeconds -= dt;
      if (boss.telegraph.remainingSeconds <= 0) {
        const pattern = boss.telegraph.pattern;
        const range = hitboxRange(pattern.timeline.hitbox);
        if (distanceToPlayer <= range) {
          this.fireAttack(boss.mesh.position, playerPosition, pattern.timeline.hitbox, pattern.timeline.baseDamage, boss.schoolId, false);
        }
        boss.telegraph = null;
      }
    } else {
      // Slowly close distance when not mid-attack, so the fight doesn't stall at range.
      if (distanceToPlayer > 2) {
        toPlayer.normalize();
        boss.mesh.position.addScaledVector(toPlayer, 2 * dt);
        boss.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      }
      const pattern = boss.controller.selectNextAttack(ctx);
      if (pattern) {
        boss.telegraph = { pattern, remainingSeconds: pattern.timeline.windupSeconds };
      }
    }

    if (boss.controller.isDefeated()) {
      this.spawnOneShot(createChargeBurstEffect(boss.mesh.position.clone(), boss.schoolId, 4));
      this.scene.remove(boss.mesh);
      this.boss = null;
      this.callbacks.onBossDefeated(BOSS_DEFEAT_ICHOR_REWARD);
    }
  }

  /**
   * Delivers one attack from `origin` toward `targetPositionNow`. Melee/wave
   * attacks land instantly (they already require close range to trigger at
   * all); projectile attacks become a real traveling mesh that only deals
   * damage if its target is still near the (pre-computed) impact point when
   * it arrives; beam attacks render an instant visual flash and land
   * immediately, matching their near-zero `activeSeconds`.
   */
  private fireAttack(
    origin: THREE.Vector3,
    targetPositionNow: THREE.Vector3,
    hitbox: HitboxArchetype,
    damage: number,
    schoolId: SchoolId,
    ownedByPlayer: boolean,
  ): void {
    if (hitbox.kind === "projectile") {
      this.launchProjectile(origin, targetPositionNow.clone(), hitboxSpeed(hitbox), damage, schoolId, ownedByPlayer);
      return;
    }
    if (hitbox.kind === "beam") {
      this.flashBeam(origin, targetPositionNow, schoolId);
    }
    this.deliverDamage(targetPositionNow, damage, ownedByPlayer);
    this.spawnOneShot(createHitImpact(targetPositionNow.clone(), schoolId));
  }

  private deliverDamage(atPosition: THREE.Vector3, damage: number, ownedByPlayer: boolean): void {
    if (ownedByPlayer) {
      this.applyDamageAt(atPosition, damage);
    } else {
      this.callbacks.onPlayerDamaged(damage);
    }
  }

  private applyDamageAt(position: THREE.Vector3, damage: number): void {
    let closestEnemy: LiveEnemy | null = null;
    let closestDistance = PROJECTILE_HIT_RADIUS;
    for (const enemy of this.enemies) {
      const distance = position.distanceTo(enemy.mesh.position);
      if (distance <= closestDistance) {
        closestDistance = distance;
        closestEnemy = enemy;
      }
    }
    if (closestEnemy) {
      closestEnemy.health -= damage;
      return;
    }
    if (this.boss && position.distanceTo(this.boss.mesh.position) <= PROJECTILE_HIT_RADIUS) {
      this.boss.controller.applyDamage(damage);
    }
  }

  private launchProjectile(
    origin: THREE.Vector3,
    destination: THREE.Vector3,
    speed: number,
    damage: number,
    schoolId: SchoolId,
    ownedByPlayer: boolean,
  ): void {
    const distance = origin.distanceTo(destination);
    const durationSeconds = Math.max(distance / speed, 0.05);

    const palette = SCHOOL_PALETTE[schoolId];
    const geometry = new THREE.SphereGeometry(0.15, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: palette.emissive });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(origin).setY(origin.y + 0.8);
    this.scene.add(mesh);

    const trail = createProjectileTrail(schoolId);
    trail.setPosition(mesh.position);
    this.scene.add(trail.object3D);

    this.projectiles.push({
      mesh,
      trail,
      origin: origin.clone().setY(origin.y + 0.8),
      destination: destination.clone().setY(origin.y + 0.8),
      elapsedSeconds: 0,
      durationSeconds,
      damage,
      ownedByPlayer,
      schoolId,
    });
  }

  private flashBeam(origin: THREE.Vector3, destination: THREE.Vector3, schoolId: SchoolId): void {
    const palette = SCHOOL_PALETTE[schoolId];
    const start = origin.clone().setY(origin.y + 0.8);
    const end = destination.clone().setY(origin.y + 0.8);
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = Math.max(direction.length(), 0.01);

    const geometry = new THREE.CylinderGeometry(0.06, 0.06, length, 6, 1, true);
    geometry.translate(0, length / 2, 0);
    geometry.rotateX(Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: palette.emissive,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(start);
    mesh.lookAt(end);
    this.scene.add(mesh);

    let remaining = BEAM_FLASH_DURATION_SECONDS;
    const fadeEffect: VfxEffect = {
      object3D: mesh,
      isFinished: false,
      update(dt: number) {
        remaining -= dt;
        material.opacity = Math.max(0, remaining / BEAM_FLASH_DURATION_SECONDS) * 0.9;
        (fadeEffect as { isFinished: boolean }).isFinished = remaining <= 0;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
    this.spawnOneShot(fadeEffect);
  }

  private updateProjectiles(dt: number, playerPosition: THREE.Vector3): void {
    this.projectiles = this.projectiles.filter((projectile) => {
      projectile.elapsedSeconds += dt;
      const t = Math.min(projectile.elapsedSeconds / projectile.durationSeconds, 1);
      projectile.mesh.position.lerpVectors(projectile.origin, projectile.destination, t);
      projectile.trail.setPosition(projectile.mesh.position);
      projectile.trail.update(dt);

      if (t < 1) return true;

      // Arrived: damage whoever's actually near the impact point now (a real dodge window for enemy-fired projectiles).
      const impactPoint = projectile.ownedByPlayer ? projectile.destination : playerPosition;
      const arrivedNearTarget = projectile.mesh.position.distanceTo(impactPoint) <= PROJECTILE_HIT_RADIUS + 0.5;
      if (arrivedNearTarget) {
        this.deliverDamage(projectile.mesh.position, projectile.damage, projectile.ownedByPlayer);
      }
      this.spawnOneShot(createHitImpact(projectile.mesh.position.clone(), projectile.schoolId));

      this.scene.remove(projectile.mesh);
      this.scene.remove(projectile.trail.object3D);
      projectile.trail.dispose();
      return false;
    });
  }

  /**
   * Resolves a player attack (already computed via `resolveAttack`) against
   * whichever live enemy/boss is nearest and within range, in front of the
   * player — or, for projectile/beam Forms, fires a real traveling
   * projectile / instant beam flash instead. Also plays the attacking
   * Form's cast VFX. Returns true if something was hit (melee/wave only —
   * projectiles report success at launch, not on eventual impact).
   */
  playerAttack(
    playerPosition: THREE.Vector3,
    facingDirection: THREE.Vector3,
    resolved: ResolvedAttack,
    formId: FormId,
  ): boolean {
    this.spawnOneShot(createFormCastEffect(playerPosition.clone(), resolved.damageType === "physical" ? "earth" : (resolved.damageType as SchoolId), formId));

    const hitbox = resolved.timeline.hitbox;
    if (hitbox.kind === "projectile" || hitbox.kind === "beam") {
      const target = this.getNearestTargetPosition(playerPosition) ?? playerPosition.clone().addScaledVector(facingDirection, hitboxRange(hitbox));
      this.fireAttack(playerPosition, target, hitbox, resolved.damage, resolved.damageType === "physical" ? "earth" : (resolved.damageType as SchoolId), true);
      return true;
    }

    const range = hitboxRange(hitbox);
    const attackPoint = new THREE.Vector3()
      .copy(playerPosition)
      .addScaledVector(facingDirection, PLAYER_ATTACK_FORWARD_OFFSET);

    let closestTarget: LiveEnemy | "boss" | null = null;
    let closestDistance = Infinity;

    for (const enemy of this.enemies) {
      const distance = attackPoint.distanceTo(enemy.mesh.position);
      if (distance <= range && distance < closestDistance) {
        closestDistance = distance;
        closestTarget = enemy;
      }
    }
    if (this.boss) {
      const distance = attackPoint.distanceTo(this.boss.mesh.position);
      if (distance <= range && distance < closestDistance) {
        closestDistance = distance;
        closestTarget = "boss";
      }
    }

    if (closestTarget === null) return false;

    const impactPoint = closestTarget === "boss" ? this.boss?.mesh.position : closestTarget.mesh.position;
    if (impactPoint) {
      this.spawnOneShot(createHitImpact(impactPoint.clone(), resolved.damageType === "physical" ? "earth" : (resolved.damageType as SchoolId)));
    }

    if (closestTarget === "boss") {
      this.boss?.controller.applyDamage(resolved.damage);
    } else {
      closestTarget.health -= resolved.damage;
    }
    return true;
  }

  /** Applies flat damage to every live enemy/boss within `radius` of `center` — used for Form charge-release bursts (see FormFluxMachine.consumeChargeOnSwapOut). */
  playerAreaDamage(center: THREE.Vector3, radius: number, damage: number, schoolId: SchoolId): void {
    this.spawnOneShot(createChargeBurstEffect(center.clone(), schoolId, radius));
    for (const enemy of this.enemies) {
      if (center.distanceTo(enemy.mesh.position) <= radius) {
        enemy.health -= damage;
      }
    }
    if (this.boss && center.distanceTo(this.boss.mesh.position) <= radius) {
      this.boss.controller.applyDamage(damage);
    }
  }

  dispose(): void {
    this.clear();
  }
}
