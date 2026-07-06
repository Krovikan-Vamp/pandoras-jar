import * as THREE from "three";
import type { SchoolId } from "@pithos/sim";

import { ParticlePoints } from "./ParticlePoints.js";
import { randomHorizontalAngle, randomPointInSphere } from "./random.js";
import { SCHOOL_PALETTE } from "./SchoolPalette.js";
import { getSoftCircleTexture, getStreakTexture } from "./spriteTextures.js";
import type { VfxEffect } from "./types.js";

interface AmbientParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: number;
  color: THREE.Color;
  /** Free-running per-particle phase used for sway/twinkle sine waves. */
  phase: number;
  /** Sprite rotation in radians; only meaningful for streak-shaped particles. */
  angle: number;
}

interface AmbientProfile {
  readonly count: number;
  readonly texture: THREE.Texture;
  readonly blending: THREE.Blending;
  spawn(): AmbientParticle;
  /** Advances one particle in place by `dt` seconds and returns its alpha for this frame. */
  step(particle: AmbientParticle, dt: number, elapsed: number): number;
}

/**
 * A continuous, looping ambient particle field filling `bounds`, themed per
 * School (docs/GDD.md §13): Earth is slow dust motes, Fire is rising embers,
 * Water is drifting bubbles/mist, Air is horizontal wind streaks, and Aether
 * is twinkling starlight. Meant to run for the lifetime of a combat
 * room/hub zone — `isFinished` is always false; the caller disposes it
 * explicitly when the zone unloads.
 */
export function createAmbientBiomeParticles(
  schoolId: SchoolId,
  bounds: { center: THREE.Vector3; radius: number }
): VfxEffect {
  const effect = new AmbientBiomeParticlesEffect(schoolId, bounds.radius);
  effect.object3D.position.copy(bounds.center);
  return effect;
}

class AmbientBiomeParticlesEffect implements VfxEffect {
  readonly object3D: THREE.Object3D;
  readonly isFinished = false;

  private readonly system: ParticlePoints;
  private readonly profile: AmbientProfile;
  private readonly particles: AmbientParticle[] = [];
  private elapsed = 0;

  constructor(schoolId: SchoolId, radius: number) {
    this.profile = AMBIENT_PROFILE_BUILDERS[schoolId](Math.max(radius, 0.5));
    this.system = new ParticlePoints({
      count: this.profile.count,
      texture: this.profile.texture,
      blending: this.profile.blending,
    });

    for (let i = 0; i < this.profile.count; i++) {
      this.particles.push(this.profile.spawn());
    }

    this.writeAll(1);
    this.system.commit();

    this.object3D = this.system.points;
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.particles.forEach((particle, i) => {
      const alpha = this.profile.step(particle, dt, this.elapsed);
      this.system.setPosition(i, particle.position.x, particle.position.y, particle.position.z);
      this.system.setColor(i, particle.color);
      this.system.sizes[i] = particle.size;
      this.system.alphas[i] = alpha;
      this.system.angles[i] = particle.angle;
    });
    this.system.commit();
  }

  private writeAll(alpha: number): void {
    this.particles.forEach((particle, i) => {
      this.system.setPosition(i, particle.position.x, particle.position.y, particle.position.z);
      this.system.setColor(i, particle.color);
      this.system.sizes[i] = particle.size;
      this.system.alphas[i] = alpha;
      this.system.angles[i] = particle.angle;
    });
  }

  dispose(): void {
    this.system.dispose();
  }
}

const AMBIENT_PROFILE_BUILDERS: Record<SchoolId, (radius: number) => AmbientProfile> = {
  earth: buildDustProfile,
  fire: buildEmberProfile,
  water: buildBubbleProfile,
  air: buildWindProfile,
  aether: buildSparkleProfile,
};

/** Earth — slow-drifting dust motes. */
function buildDustProfile(radius: number): AmbientProfile {
  const palette = SCHOOL_PALETTE.earth;
  const primary = new THREE.Color(palette.primary);
  const secondary = new THREE.Color(palette.secondary);
  const count = Math.round(THREE.MathUtils.clamp(radius * 3, 20, 70));
  const baseSize = ParticlePoints.toDeviceSize(3.5);

  const spawn = (): AmbientParticle => ({
    position: randomPointInSphere(radius),
    velocity: new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(0.15),
      THREE.MathUtils.randFloatSpread(0.05) + 0.02,
      THREE.MathUtils.randFloatSpread(0.15)
    ),
    size: baseSize * THREE.MathUtils.randFloat(0.7, 1.4),
    color: Math.random() < 0.5 ? primary : secondary,
    phase: Math.random() * Math.PI * 2,
    angle: 0,
  });

  return {
    count,
    texture: getSoftCircleTexture(),
    blending: THREE.NormalBlending,
    spawn,
    step: (particle, dt) => {
      particle.position.addScaledVector(particle.velocity, dt);
      particle.phase += dt;
      if (particle.position.length() > radius * 1.05) {
        Object.assign(particle, spawn());
      }
      return 0.35 + Math.sin(particle.phase * 0.6) * 0.1;
    },
  };
}

/** Fire — rising embers that drift up from the floor of the bounds and cool as they climb. */
function buildEmberProfile(radius: number): AmbientProfile {
  const palette = SCHOOL_PALETTE.fire;
  const primary = new THREE.Color(palette.primary);
  const emissive = new THREE.Color(palette.emissive);
  const count = Math.round(THREE.MathUtils.clamp(radius * 4, 24, 90));
  const baseSize = ParticlePoints.toDeviceSize(4);

  const spawnAt = (y: number): AmbientParticle => {
    const distance = Math.sqrt(Math.random()) * radius;
    const angle = randomHorizontalAngle();
    return {
      position: new THREE.Vector3(Math.cos(angle) * distance, y, Math.sin(angle) * distance),
      velocity: new THREE.Vector3(0, THREE.MathUtils.randFloat(0.25, 0.6), 0),
      size: baseSize * THREE.MathUtils.randFloat(0.6, 1.3),
      color: Math.random() < 0.4 ? emissive : primary,
      phase: Math.random() * Math.PI * 2,
      angle: 0,
    };
  };

  return {
    count,
    texture: getSoftCircleTexture(),
    blending: THREE.AdditiveBlending,
    spawn: () => spawnAt(THREE.MathUtils.randFloat(-radius, radius)),
    step: (particle, dt) => {
      particle.phase += dt * 2;
      particle.position.y += particle.velocity.y * dt;
      particle.position.x += Math.sin(particle.phase) * 0.25 * dt;
      particle.position.z += Math.cos(particle.phase * 0.7) * 0.25 * dt;
      if (particle.position.y > radius) {
        Object.assign(particle, spawnAt(-radius));
      }
      const heightT = THREE.MathUtils.clamp((particle.position.y + radius) / (radius * 2), 0, 1);
      return (1 - heightT) * 0.8 + 0.1;
    },
  };
}

/** Water — drifting bubbles/mist rising slowly with a gentle wobble. */
function buildBubbleProfile(radius: number): AmbientProfile {
  const palette = SCHOOL_PALETTE.water;
  const primary = new THREE.Color(palette.primary);
  const emissive = new THREE.Color(palette.emissive);
  const count = Math.round(THREE.MathUtils.clamp(radius * 3, 20, 70));
  const baseSize = ParticlePoints.toDeviceSize(3);

  const spawnAt = (y: number): AmbientParticle => {
    const distance = Math.sqrt(Math.random()) * radius;
    const angle = randomHorizontalAngle();
    return {
      position: new THREE.Vector3(Math.cos(angle) * distance, y, Math.sin(angle) * distance),
      velocity: new THREE.Vector3(0, THREE.MathUtils.randFloat(0.12, 0.3), 0),
      size: baseSize * THREE.MathUtils.randFloat(0.6, 1.5),
      color: Math.random() < 0.3 ? emissive : primary,
      phase: Math.random() * Math.PI * 2,
      angle: 0,
    };
  };

  return {
    count,
    texture: getSoftCircleTexture(),
    blending: THREE.NormalBlending,
    spawn: () => spawnAt(THREE.MathUtils.randFloat(-radius, radius)),
    step: (particle, dt) => {
      particle.phase += dt * 1.4;
      particle.position.y += particle.velocity.y * dt;
      particle.position.x += Math.sin(particle.phase) * 0.12 * dt;
      particle.position.z += Math.cos(particle.phase * 0.8) * 0.12 * dt;
      if (particle.position.y > radius) {
        Object.assign(particle, spawnAt(-radius));
      }
      return 0.3 + Math.sin(particle.phase * 0.5) * 0.15;
    },
  };
}

/** Air — horizontal wind streaks blowing across the bounds and wrapping around. */
const WIND_DIRECTION = new THREE.Vector3(1, 0, 0.4).normalize();
const WIND_SPEED = 1.4;

function buildWindProfile(radius: number): AmbientProfile {
  const palette = SCHOOL_PALETTE.air;
  const primary = new THREE.Color(palette.primary);
  const secondary = new THREE.Color(palette.secondary);
  const count = Math.round(THREE.MathUtils.clamp(radius * 2.5, 16, 50));
  const baseSize = ParticlePoints.toDeviceSize(9);

  const respawnAtTail = (): AmbientParticle => {
    const sample = randomPointInSphere(radius);
    const alongWind = sample.dot(WIND_DIRECTION);
    const position = sample.addScaledVector(WIND_DIRECTION, -alongWind - radius);
    return {
      position,
      velocity: WIND_DIRECTION.clone().multiplyScalar(WIND_SPEED * THREE.MathUtils.randFloat(0.7, 1.3)),
      size: baseSize * THREE.MathUtils.randFloat(0.6, 1.2),
      color: Math.random() < 0.5 ? primary : secondary,
      phase: 0,
      // The streak texture's long axis already runs horizontally, matching a
      // purely-horizontal wind velocity, so no per-particle rotation is needed.
      angle: 0,
    };
  };

  const spawn = (): AmbientParticle => {
    const particle = respawnAtTail();
    // Scatter initial particles across the whole travel span so the field
    // looks populated immediately instead of streaming in from one edge.
    particle.position.addScaledVector(WIND_DIRECTION, Math.random() * radius * 2);
    return particle;
  };

  return {
    count,
    texture: getStreakTexture(),
    blending: THREE.NormalBlending,
    spawn,
    step: (particle, dt) => {
      particle.position.addScaledVector(particle.velocity, dt);
      if (particle.position.dot(WIND_DIRECTION) > radius) {
        Object.assign(particle, respawnAtTail());
      }
      return 0.5;
    },
  };
}

/** Aether — twinkling starlight sparkles, mostly stationary with slow drift. */
function buildSparkleProfile(radius: number): AmbientProfile {
  const palette = SCHOOL_PALETTE.aether;
  const primary = new THREE.Color(palette.primary);
  const emissive = new THREE.Color(palette.emissive);
  const count = Math.round(THREE.MathUtils.clamp(radius * 4, 30, 110));
  const baseSize = ParticlePoints.toDeviceSize(3.5);

  const spawn = (): AmbientParticle => ({
    position: randomPointInSphere(radius),
    velocity: new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(0.04),
      THREE.MathUtils.randFloatSpread(0.04),
      THREE.MathUtils.randFloatSpread(0.04)
    ),
    size: baseSize * THREE.MathUtils.randFloat(0.7, 1.8),
    color: Math.random() < 0.35 ? emissive : primary,
    phase: Math.random() * Math.PI * 2,
    angle: 0,
  });

  return {
    count,
    texture: getSoftCircleTexture(),
    blending: THREE.AdditiveBlending,
    spawn,
    step: (particle, dt, elapsed) => {
      particle.position.addScaledVector(particle.velocity, dt);
      if (particle.position.length() > radius * 1.05) {
        Object.assign(particle, spawn());
      }
      return 0.35 + 0.65 * Math.max(0, Math.sin(elapsed * 3 + particle.phase));
    },
  };
}
