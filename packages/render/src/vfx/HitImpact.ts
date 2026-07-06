import * as THREE from "three";
import type { SchoolId } from "@pithos/sim";

import { ParticlePoints } from "./ParticlePoints.js";
import { randomUnitVector } from "./random.js";
import { SCHOOL_PALETTE } from "./SchoolPalette.js";
import { getSoftCircleTexture } from "./spriteTextures.js";
import type { VfxEffect } from "./types.js";

const PARTICLE_COUNT = 16;
const DURATION = 0.3;
const MIN_SPEED = 1.6;
const MAX_SPEED = 3.4;
/** Time in seconds for a particle's velocity to halve — a fast, heavy drag. */
const DRAG_HALF_LIFE = 0.12;
const BASE_SIZE = ParticlePoints.toDeviceSize(9);

interface Particle {
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly size: number;
  readonly color: THREE.Color;
}

/**
 * A quick (~0.3s) radial burst of small particles at an impact point,
 * colored via the landing School's palette. This fires on every successful
 * attack landing, so it is kept intentionally cheap: a handful of particles
 * that pop outward and fade, nothing more.
 */
export function createHitImpact(position: THREE.Vector3, schoolId: SchoolId): VfxEffect {
  return new HitImpactEffect(position, schoolId);
}

class HitImpactEffect implements VfxEffect {
  readonly object3D: THREE.Object3D;

  private readonly system: ParticlePoints;
  private readonly particles: Particle[] = [];
  private elapsed = 0;

  constructor(position: THREE.Vector3, schoolId: SchoolId) {
    const palette = SCHOOL_PALETTE[schoolId];
    const primary = new THREE.Color(palette.primary);
    const emissive = new THREE.Color(palette.emissive);

    this.system = new ParticlePoints({ count: PARTICLE_COUNT, texture: getSoftCircleTexture() });

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const speed = THREE.MathUtils.randFloat(MIN_SPEED, MAX_SPEED);
      this.particles.push({
        position: new THREE.Vector3(0, 0, 0),
        velocity: randomUnitVector().multiplyScalar(speed),
        size: BASE_SIZE * THREE.MathUtils.randFloat(0.6, 1.4),
        color: Math.random() < 0.5 ? primary : emissive,
      });
    }

    this.writeParticles(1);
    this.system.commit();

    this.object3D = this.system.points;
    this.object3D.position.copy(position);
  }

  update(dt: number): void {
    this.elapsed += dt;
    const drag = Math.pow(0.5, dt / DRAG_HALF_LIFE);
    const fade = 1 - THREE.MathUtils.smoothstep(this.elapsed, DURATION * 0.2, DURATION);

    this.particles.forEach((particle) => {
      particle.velocity.multiplyScalar(drag);
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
    });
  }

  get isFinished(): boolean {
    return this.elapsed >= DURATION;
  }

  dispose(): void {
    this.system.dispose();
  }
}
