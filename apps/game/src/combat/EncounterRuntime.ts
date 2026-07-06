import type {
  AttackPattern,
  BossDecisionContext,
  BossDefinition,
  EnemyDefinition,
  HitboxArchetype,
  ResolvedAttack,
} from "@pithos/sim";
import { BossController } from "@pithos/sim";
import * as THREE from "three";

/**
 * The moment-to-moment combat runtime: spawns trash-mob/boss encounters as
 * simple capsule meshes, drives their AI each frame, and resolves player
 * attacks against them. This is intentionally a simplified first pass, not
 * a full physics simulation — see the inline notes for exactly what's
 * approximated and why, matching the "expressible today" pattern used
 * throughout packages/sim's perk/combat data (real mechanic now, deeper
 * fidelity is a documented follow-up, not a silent gap).
 *
 * Simplifications, stated plainly:
 * - Enemies move by directly lerping toward the player each frame (no
 *   Rapier body, no obstacle avoidance) — acceptable for blockout-room
 *   combat encounters; a later pass could give them real kinematic
 *   controllers matching PlayerPhysics.
 * - Every `HitboxArchetype` collapses to a simple radius check
 *   (`hitboxRange`) rather than real melee arcs/wave cones/beam lines —
 *   good enough to make attacks land or miss meaningfully, not a faithful
 *   geometric simulation of each archetype.
 * - Boss attacks are "telegraph, then apply damage if the player is still
 *   in range when the active window ends" — no distinct visual telegraph
 *   mesh yet (that's `packages/render`'s VFX work, not built yet).
 */

const ENEMY_RADIUS = 0.35;
const ENEMY_HEIGHT = 1.0;
const BOSS_RADIUS = 0.9;
const BOSS_HEIGHT = 2.4;
const PLAYER_ATTACK_FORWARD_OFFSET = 0.5;

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

function categoryColor(category: EnemyDefinition["category"]): number {
  switch (category) {
    case "homunculus":
      return 0x8a8a6b;
    case "undead":
      return 0x5a6b6b;
    case "rival_alchemist":
      return 0xb05a8c;
    case "elemental_wildlife":
      return 0x6b8cb0;
  }
}

interface LiveEnemy {
  definition: EnemyDefinition;
  mesh: THREE.Mesh;
  health: number;
  attackCooldownRemaining: number;
}

interface LiveBoss {
  definition: BossDefinition;
  controller: BossController;
  mesh: THREE.Mesh;
  elapsedSeconds: number;
  telegraph: { pattern: AttackPattern; remainingSeconds: number } | null;
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

  constructor(scene: THREE.Scene, callbacks: EncounterCallbacks, random: () => number = Math.random) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.random = random;
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

  spawnRoom(definitions: EnemyDefinition[], center: THREE.Vector3): void {
    this.clear();
    this.roomClearReported = false;

    definitions.forEach((definition, index) => {
      const angle = (index / Math.max(definitions.length, 1)) * Math.PI * 2;
      const spawnRadius = 3;
      const geometry = new THREE.CapsuleGeometry(ENEMY_RADIUS, ENEMY_HEIGHT, 4, 8);
      const material = new THREE.MeshStandardMaterial({ color: categoryColor(definition.category) });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        center.x + Math.cos(angle) * spawnRadius,
        ENEMY_HEIGHT / 2 + ENEMY_RADIUS,
        center.z + Math.sin(angle) * spawnRadius,
      );
      this.scene.add(mesh);
      this.enemies.push({ definition, mesh, health: definition.maxHealth, attackCooldownRemaining: 0 });
    });
  }

  spawnBoss(definition: BossDefinition, position: THREE.Vector3): void {
    this.clear();
    const geometry = new THREE.CapsuleGeometry(BOSS_RADIUS, BOSS_HEIGHT, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0x8a1f2e, emissive: 0x2a0508 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, BOSS_HEIGHT / 2 + BOSS_RADIUS, position.z);
    this.scene.add(mesh);
    this.boss = {
      definition,
      controller: new BossController(definition, this.random),
      mesh,
      elapsedSeconds: 0,
      telegraph: null,
    };
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
  }

  /** Advances enemy/boss AI and resolves any attacks that land on the player this frame. */
  update(dt: number, playerPosition: THREE.Vector3): void {
    this.updateTrashEnemies(dt, playerPosition);
    this.updateBoss(dt, playerPosition);
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
      } else if (enemy.attackCooldownRemaining <= 0) {
        this.callbacks.onPlayerDamaged(enemy.definition.attack.baseDamage);
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
          this.callbacks.onPlayerDamaged(pattern.timeline.baseDamage);
        }
        boss.telegraph = null;
      }
    } else {
      // Slowly close distance when not mid-attack, so the fight doesn't stall at range.
      if (distanceToPlayer > 2) {
        toPlayer.normalize();
        boss.mesh.position.addScaledVector(toPlayer, 2 * dt);
      }
      const pattern = boss.controller.selectNextAttack(ctx);
      if (pattern) {
        boss.telegraph = { pattern, remainingSeconds: pattern.timeline.windupSeconds };
      }
    }

    if (boss.controller.isDefeated()) {
      this.scene.remove(boss.mesh);
      this.boss = null;
      this.callbacks.onBossDefeated(BOSS_DEFEAT_ICHOR_REWARD);
    }
  }

  /**
   * Resolves a player attack (already computed via `resolveAttack`) against
   * whichever live enemy/boss is nearest and within range, in front of the
   * player. Returns true if something was hit.
   */
  playerAttack(playerPosition: THREE.Vector3, facingDirection: THREE.Vector3, resolved: ResolvedAttack): boolean {
    const range = hitboxRange(resolved.timeline.hitbox);
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
    if (closestTarget === "boss") {
      this.boss?.controller.applyDamage(resolved.damage);
    } else {
      closestTarget.health -= resolved.damage;
    }
    return true;
  }

  /** Applies flat damage to every live enemy/boss within `radius` of `center` — used for Form charge-release bursts (see FormFluxMachine.consumeChargeOnSwapOut). */
  playerAreaDamage(center: THREE.Vector3, radius: number, damage: number): void {
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
