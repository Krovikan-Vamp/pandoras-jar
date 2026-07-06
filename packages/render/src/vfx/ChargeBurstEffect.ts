import * as THREE from "three";
import type { SchoolId } from "@pithos/sim";

import { ParticlePoints } from "./ParticlePoints.js";
import { randomUnitVector } from "./random.js";
import { SCHOOL_PALETTE } from "./SchoolPalette.js";
import { getSoftCircleTexture } from "./spriteTextures.js";
import type { VfxEffect } from "./types.js";

const MIN_PARTICLE_COUNT = 28;
const MAX_PARTICLE_COUNT = 100;
const MIN_DURATION = 0.5;
const MAX_DURATION = 0.85;
const RING_SEGMENTS = 48;
/** Inner/outer radius ratio of the unit ring template mesh (thin band). */
const RING_INNER_RATIO = 0.82;
const PARTICLE_GRAVITY = 3;

interface BurstParticle {
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly size: number;
  readonly color: THREE.Color;
}

/**
 * A bigger, more dramatic radial shockwave/explosion for Form charge-release
 * bursts (the GDD's "empowered burst" released when swapping out of a
 * charged Form). Reads as clearly more powerful than `HitImpact`: a
 * ground shockwave ring, a bright central flash, and a wide particle burst,
 * all scaled by `radius`.
 */
export function createChargeBurstEffect(position: THREE.Vector3, schoolId: SchoolId, radius: number): VfxEffect {
  const effect = new ChargeBurstEffectImpl(schoolId, Math.max(radius, 0.1));
  effect.object3D.position.copy(position);
  return effect;
}

class ChargeBurstEffectImpl implements VfxEffect {
  readonly object3D: THREE.Group;

  private readonly duration: number;
  private readonly maxRadius: number;
  private readonly system: ParticlePoints;
  private readonly particles: BurstParticle[] = [];
  private readonly ring: THREE.Mesh;
  private readonly ringMaterial: THREE.MeshBasicMaterial;
  private readonly flash: THREE.Sprite;
  private readonly flashMaterial: THREE.SpriteMaterial;
  private elapsed = 0;

  constructor(schoolId: SchoolId, radius: number) {
    const palette = SCHOOL_PALETTE[schoolId];
    const primary = new THREE.Color(palette.primary);
    const secondary = new THREE.Color(palette.secondary);
    const emissive = new THREE.Color(palette.emissive);
    const colorChoices = [primary, secondary, emissive];

    this.maxRadius = radius;
    const particleCount = Math.round(
      THREE.MathUtils.clamp(24 + radius * 9, MIN_PARTICLE_COUNT, MAX_PARTICLE_COUNT)
    );
    this.duration = THREE.MathUtils.clamp(0.5 + radius * 0.03, MIN_DURATION, MAX_DURATION);

    this.object3D = new THREE.Group();
    this.object3D.name = "ChargeBurst";

    // Radial particle burst.
    this.system = new ParticlePoints({ count: particleCount, texture: getSoftCircleTexture() });
    const baseSize = ParticlePoints.toDeviceSize(12);
    for (let i = 0; i < particleCount; i++) {
      const direction = randomUnitVector();
      direction.y = Math.abs(direction.y) * 0.6 + 0.2;
      const speed = THREE.MathUtils.randFloat(radius * 1.3, radius * 2.6 + 1.5);
      this.particles.push({
        position: new THREE.Vector3(0, 0, 0),
        velocity: direction.multiplyScalar(speed),
        size: baseSize * THREE.MathUtils.randFloat(0.7, 1.6),
        color: colorChoices[Math.floor(Math.random() * colorChoices.length)] ?? primary,
      });
    }
    this.object3D.add(this.system.points);

    // Ground shockwave ring, uniformly scaled from ~0 up to `radius`.
    const ringGeometry = new THREE.RingGeometry(RING_INNER_RATIO, 1, RING_SEGMENTS);
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: emissive,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(ringGeometry, this.ringMaterial);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.scale.setScalar(0.0001);
    this.object3D.add(this.ring);

    // Bright central flash pop, scaled with radius.
    this.flashMaterial = new THREE.SpriteMaterial({
      map: getSoftCircleTexture(),
      color: emissive,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flash = new THREE.Sprite(this.flashMaterial);
    this.flash.scale.setScalar(0.0001);
    this.object3D.add(this.flash);

    this.writeParticles(1);
    this.system.commit();
  }

  update(dt: number): void {
    this.elapsed += dt;
    const t = THREE.MathUtils.clamp(this.elapsed / this.duration, 0, 1);
    const easedOutRadius = this.maxRadius * (1 - Math.pow(1 - t, 3));

    this.particles.forEach((particle) => {
      particle.velocity.y -= PARTICLE_GRAVITY * dt;
      particle.position.addScaledVector(particle.velocity, dt);
    });
    const particleFade = 1 - THREE.MathUtils.smoothstep(t, 0.4, 1);
    this.writeParticles(particleFade);
    this.system.commit();

    this.ring.scale.setScalar(Math.max(easedOutRadius, 0.0001));
    this.ringMaterial.opacity = 1 - THREE.MathUtils.smoothstep(t, 0.15, 1);

    const flashT = Math.min(this.elapsed / (this.duration * 0.3), 1);
    const flashScale = this.maxRadius * 0.9 * Math.sin(Math.PI * flashT);
    this.flash.scale.setScalar(Math.max(flashScale, 0.0001));
    this.flashMaterial.opacity = 1 - THREE.MathUtils.smoothstep(flashT, 0.5, 1);
  }

  private writeParticles(alpha: number): void {
    this.particles.forEach((particle, i) => {
      this.system.setPosition(i, particle.position.x, particle.position.y, particle.position.z);
      this.system.setColor(i, particle.color);
      this.system.sizes[i] = particle.size;
      this.system.alphas[i] = alpha;
    });
  }

  get isFinished(): boolean {
    return this.elapsed >= this.duration;
  }

  dispose(): void {
    this.system.dispose();
    this.ring.geometry.dispose();
    this.ringMaterial.dispose();
    this.flashMaterial.dispose();
  }
}
