import * as THREE from "three";
import type { FormId, SchoolId } from "@pithos/sim";

import { ParticlePoints } from "./ParticlePoints.js";
import { randomHorizontalAngle, randomUnitVector } from "./random.js";
import { SCHOOL_PALETTE } from "./SchoolPalette.js";
import { getSoftCircleTexture, getStreakTexture } from "./spriteTextures.js";
import type { VfxEffect } from "./types.js";

/**
 * Creates a Form-cast VFX, tinted by the School's palette. Per the GDD's
 * Form identities (docs/GDD.md §4), each Form gets a distinct particle
 * "language" so School+Form combos stay readable at a glance even though
 * they share a color palette:
 *   - Solid: chunky, gravity-affected debris/shard meshes that tumble and land.
 *   - Liquid: a flowing, arcing wave of streak particles.
 *   - Gas: an expanding, dissipating soft cloud.
 *   - Plasma: a tight, fast, bright spark burst with a brief flash afterimage.
 */
export function createFormCastEffect(position: THREE.Vector3, schoolId: SchoolId, formId: FormId): VfxEffect {
  const effect = FORM_CAST_FACTORIES[formId](schoolId);
  effect.object3D.position.copy(position);
  return effect;
}

const FORM_CAST_FACTORIES: Record<FormId, (schoolId: SchoolId) => VfxEffect> = {
  solid: (schoolId) => new SolidCastEffect(schoolId),
  liquid: (schoolId) => new LiquidCastEffect(schoolId),
  gas: (schoolId) => new GasCastEffect(schoolId),
  plasma: (schoolId) => new PlasmaCastEffect(schoolId),
};

// ---------------------------------------------------------------------------
// Solid — chunky, gravity-affected debris shards.
// ---------------------------------------------------------------------------

const SOLID_DEBRIS_COUNT = 14;
const SOLID_DURATION = 0.8;
const SOLID_GRAVITY = 12;
const SOLID_FADE_START = 0.55;

interface DebrisPiece {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  readonly velocity: THREE.Vector3;
  readonly angularVelocity: THREE.Vector3;
}

class SolidCastEffect implements VfxEffect {
  readonly object3D: THREE.Group;

  private readonly pieces: DebrisPiece[] = [];
  private elapsed = 0;

  constructor(schoolId: SchoolId) {
    const palette = SCHOOL_PALETTE[schoolId];
    const emissive = new THREE.Color(palette.emissive).multiplyScalar(0.2);

    this.object3D = new THREE.Group();
    this.object3D.name = "FormCastSolid";

    for (let i = 0; i < SOLID_DEBRIS_COUNT; i++) {
      const size = THREE.MathUtils.randFloat(0.08, 0.18);
      const geometry =
        Math.random() < 0.5 ? new THREE.TetrahedronGeometry(size) : new THREE.BoxGeometry(size, size, size);
      const color = new THREE.Color(Math.random() < 0.5 ? palette.primary : palette.secondary);
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive,
        roughness: 0.75,
        metalness: 0.1,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geometry, material);

      // Mostly-upward "pop" so debris visibly launches before gravity takes over.
      const direction = randomUnitVector();
      direction.y = Math.abs(direction.y) * 1.1 + 0.5;
      const speed = THREE.MathUtils.randFloat(1.4, 3.0);

      this.pieces.push({
        mesh,
        material,
        velocity: direction.multiplyScalar(speed),
        angularVelocity: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(12),
          THREE.MathUtils.randFloatSpread(12),
          THREE.MathUtils.randFloatSpread(12)
        ),
      });
      this.object3D.add(mesh);
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed / SOLID_DURATION;
    const opacity = 1 - THREE.MathUtils.smoothstep(t, SOLID_FADE_START, 1);

    this.pieces.forEach(({ mesh, material, velocity, angularVelocity }) => {
      velocity.y -= SOLID_GRAVITY * dt;
      mesh.position.addScaledVector(velocity, dt);
      mesh.rotation.x += angularVelocity.x * dt;
      mesh.rotation.y += angularVelocity.y * dt;
      mesh.rotation.z += angularVelocity.z * dt;
      material.opacity = opacity;
    });
  }

  get isFinished(): boolean {
    return this.elapsed >= SOLID_DURATION;
  }

  dispose(): void {
    this.pieces.forEach(({ mesh, material }) => {
      mesh.geometry.dispose();
      material.dispose();
    });
  }
}

// ---------------------------------------------------------------------------
// Liquid — a flowing, arcing wave/splash of streak particles.
// ---------------------------------------------------------------------------

const LIQUID_PARTICLE_COUNT = 22;
const LIQUID_DURATION = 0.55;
const LIQUID_GRAVITY = 7;
const LIQUID_BASE_SIZE = ParticlePoints.toDeviceSize(15);

interface StreakParticle {
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly size: number;
  readonly color: THREE.Color;
}

class LiquidCastEffect implements VfxEffect {
  readonly object3D: THREE.Object3D;

  private readonly system: ParticlePoints;
  private readonly particles: StreakParticle[] = [];
  private elapsed = 0;

  constructor(schoolId: SchoolId) {
    const palette = SCHOOL_PALETTE[schoolId];
    const primary = new THREE.Color(palette.primary);
    const emissive = new THREE.Color(palette.emissive);

    this.system = new ParticlePoints({
      count: LIQUID_PARTICLE_COUNT,
      texture: getStreakTexture(),
      blending: THREE.NormalBlending,
    });

    for (let i = 0; i < LIQUID_PARTICLE_COUNT; i++) {
      const angle = randomHorizontalAngle();
      const speed = THREE.MathUtils.randFloat(2.2, 4.2);
      const velocity = new THREE.Vector3(Math.cos(angle) * speed, THREE.MathUtils.randFloat(1.8, 3.2), Math.sin(angle) * speed);

      this.particles.push({
        position: new THREE.Vector3(0, 0, 0),
        velocity,
        size: LIQUID_BASE_SIZE * THREE.MathUtils.randFloat(0.7, 1.2),
        color: Math.random() < 0.3 ? emissive : primary,
      });
    }

    this.writeParticles(1);
    this.system.commit();

    this.object3D = this.system.points;
  }

  update(dt: number): void {
    this.elapsed += dt;
    const fade = 1 - THREE.MathUtils.smoothstep(this.elapsed / LIQUID_DURATION, 0.35, 1);

    this.particles.forEach((particle) => {
      particle.velocity.y -= LIQUID_GRAVITY * dt;
      particle.position.addScaledVector(particle.velocity, dt);
    });

    this.writeParticles(fade);
    this.system.commit();
  }

  private writeParticles(alpha: number): void {
    this.particles.forEach((particle, i) => {
      this.system.setPosition(i, particle.position.x, particle.position.y, particle.position.z);
      this.system.setColor(i, particle.color);
      this.system.sizes[i] = particle.size;
      this.system.alphas[i] = alpha;
      // Orients the streak sprite along the particle's rise/fall — a
      // screen-space approximation that reads well under the game's fixed
      // isometric camera angle without this package needing to know the
      // camera's actual view matrix (see ParticlePoints doc comment).
      const horizontalSpeed = Math.hypot(particle.velocity.x, particle.velocity.z);
      this.system.angles[i] = Math.atan2(particle.velocity.y, horizontalSpeed);
    });
  }

  get isFinished(): boolean {
    return this.elapsed >= LIQUID_DURATION;
  }

  dispose(): void {
    this.system.dispose();
  }
}

// ---------------------------------------------------------------------------
// Gas — an expanding, dissipating cloud/fog of soft particles.
// ---------------------------------------------------------------------------

const GAS_PARTICLE_COUNT = 20;
const GAS_DURATION = 1.0;
const GAS_BASE_SIZE = ParticlePoints.toDeviceSize(24);

interface CloudParticle {
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly baseSize: number;
  readonly color: THREE.Color;
}

class GasCastEffect implements VfxEffect {
  readonly object3D: THREE.Object3D;

  private readonly system: ParticlePoints;
  private readonly particles: CloudParticle[] = [];
  private elapsed = 0;

  constructor(schoolId: SchoolId) {
    const palette = SCHOOL_PALETTE[schoolId];
    const primary = new THREE.Color(palette.primary);
    const secondary = new THREE.Color(palette.secondary);

    this.system = new ParticlePoints({
      count: GAS_PARTICLE_COUNT,
      texture: getSoftCircleTexture(),
      blending: THREE.NormalBlending,
    });

    for (let i = 0; i < GAS_PARTICLE_COUNT; i++) {
      const direction = randomUnitVector();
      direction.y = Math.abs(direction.y) * 0.6 + 0.15;
      const speed = THREE.MathUtils.randFloat(0.6, 1.7);

      this.particles.push({
        position: new THREE.Vector3(0, 0, 0),
        velocity: direction.multiplyScalar(speed),
        baseSize: GAS_BASE_SIZE * THREE.MathUtils.randFloat(0.7, 1.3),
        color: Math.random() < 0.5 ? primary : secondary,
      });
    }

    this.writeParticles(0, 1);
    this.system.commit();

    this.object3D = this.system.points;
  }

  update(dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed / GAS_DURATION;
    const growth = 1 + t * 1.8;
    const fadeIn = THREE.MathUtils.smoothstep(t, 0, 0.15);
    const fadeOut = 1 - THREE.MathUtils.smoothstep(t, 0.4, 1);
    const alpha = fadeIn * fadeOut * 0.75;

    this.particles.forEach((particle) => {
      particle.position.addScaledVector(particle.velocity, dt);
    });

    this.writeParticles(alpha, growth);
    this.system.commit();
  }

  private writeParticles(alpha: number, growth: number): void {
    this.particles.forEach((particle, i) => {
      this.system.setPosition(i, particle.position.x, particle.position.y, particle.position.z);
      this.system.setColor(i, particle.color);
      this.system.sizes[i] = particle.baseSize * growth;
      this.system.alphas[i] = alpha;
    });
  }

  get isFinished(): boolean {
    return this.elapsed >= GAS_DURATION;
  }

  dispose(): void {
    this.system.dispose();
  }
}

// ---------------------------------------------------------------------------
// Plasma — a tight, fast, bright spark burst with a brief flash afterimage.
// ---------------------------------------------------------------------------

const PLASMA_SPARK_COUNT = 12;
const PLASMA_DURATION = 0.22;
const PLASMA_SPARK_BASE_SIZE = ParticlePoints.toDeviceSize(6);
const PLASMA_SPARK_DRAG_HALF_LIFE = 0.05;
const PLASMA_FLASH_DURATION = 0.15;
const PLASMA_FLASH_MAX_SCALE = 0.9;

interface SparkParticle {
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly size: number;
  readonly color: THREE.Color;
}

class PlasmaCastEffect implements VfxEffect {
  readonly object3D: THREE.Group;

  private readonly system: ParticlePoints;
  private readonly sparks: SparkParticle[] = [];
  private readonly flash: THREE.Sprite;
  private readonly flashMaterial: THREE.SpriteMaterial;
  private elapsed = 0;

  constructor(schoolId: SchoolId) {
    const palette = SCHOOL_PALETTE[schoolId];
    const primary = new THREE.Color(palette.primary);
    const emissive = new THREE.Color(palette.emissive);

    this.object3D = new THREE.Group();
    this.object3D.name = "FormCastPlasma";

    this.system = new ParticlePoints({ count: PLASMA_SPARK_COUNT, texture: getSoftCircleTexture() });
    for (let i = 0; i < PLASMA_SPARK_COUNT; i++) {
      const speed = THREE.MathUtils.randFloat(4.5, 7.5);
      this.sparks.push({
        position: new THREE.Vector3(0, 0, 0),
        velocity: randomUnitVector().multiplyScalar(speed),
        size: PLASMA_SPARK_BASE_SIZE * THREE.MathUtils.randFloat(0.7, 1.3),
        color: Math.random() < 0.55 ? emissive : primary,
      });
    }
    this.writeSparks(1);
    this.system.commit();
    this.object3D.add(this.system.points);

    this.flashMaterial = new THREE.SpriteMaterial({
      map: getSoftCircleTexture(),
      color: emissive,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 1,
    });
    this.flash = new THREE.Sprite(this.flashMaterial);
    this.flash.scale.setScalar(0.0001);
    this.object3D.add(this.flash);
  }

  update(dt: number): void {
    this.elapsed += dt;

    const drag = Math.pow(0.5, dt / PLASMA_SPARK_DRAG_HALF_LIFE);
    this.sparks.forEach((spark) => {
      spark.velocity.multiplyScalar(drag);
      spark.position.addScaledVector(spark.velocity, dt);
    });
    const sparkFade = 1 - THREE.MathUtils.smoothstep(this.elapsed / PLASMA_DURATION, 0.3, 1);
    this.writeSparks(sparkFade);
    this.system.commit();

    // A quick bright pop that rises then collapses within PLASMA_FLASH_DURATION.
    const flashT = Math.min(this.elapsed / PLASMA_FLASH_DURATION, 1);
    const flashScale = PLASMA_FLASH_MAX_SCALE * Math.sin(Math.PI * flashT);
    this.flash.scale.setScalar(Math.max(flashScale, 0.0001));
    this.flashMaterial.opacity = 1 - THREE.MathUtils.smoothstep(flashT, 0.5, 1);
  }

  private writeSparks(alpha: number): void {
    this.sparks.forEach((spark, i) => {
      this.system.setPosition(i, spark.position.x, spark.position.y, spark.position.z);
      this.system.setColor(i, spark.color);
      this.system.sizes[i] = spark.size;
      this.system.alphas[i] = alpha;
    });
  }

  get isFinished(): boolean {
    return this.elapsed >= PLASMA_DURATION;
  }

  dispose(): void {
    this.system.dispose();
    this.flashMaterial.dispose();
  }
}
