import * as THREE from "three";
import type { SchoolId } from "@pithos/sim";

import { ParticlePoints } from "./ParticlePoints.js";
import { SCHOOL_PALETTE } from "./SchoolPalette.js";
import { getStreakTexture } from "./spriteTextures.js";
import type { VfxEffect } from "./types.js";

/** How many recent positions the trail remembers at once. */
const TRAIL_LENGTH = 24;
/** How long a single trail sample stays visible before fully fading, in seconds. */
const SAMPLE_LIFETIME = 0.3;
/** Skip spawning a new sample if the projectile hasn't moved at least this far (world units). */
const MIN_SPAWN_DISTANCE = 0.02;
const BASE_SIZE = ParticlePoints.toDeviceSize(8);
const INACTIVE_AGE = Number.POSITIVE_INFINITY;

export interface ProjectileTrailEffect extends VfxEffect {
  /** Called every frame by the (future) projectile system as the projectile moves. */
  setPosition(position: THREE.Vector3): void;
}

/**
 * A short trailing particle stream that follows a moving point, for a
 * future projectile system to drive by calling `setPosition` each frame.
 * Kept visually light/cheap (a small fixed pool of streak sprites) since it
 * updates every frame for the projectile's whole flight. Like
 * `AmbientBiomeParticles`, this is a continuous effect: `isFinished` stays
 * false for the projectile's entire flight — the caller disposes it once
 * the projectile itself is done (hits something or expires), since this
 * package has no way to know when that happens on its own.
 */
export function createProjectileTrail(schoolId: SchoolId): ProjectileTrailEffect {
  return new ProjectileTrailEffectImpl(schoolId);
}

class ProjectileTrailEffectImpl implements ProjectileTrailEffect {
  readonly object3D: THREE.Object3D;
  readonly isFinished = false;

  private readonly system: ParticlePoints;
  private readonly ages: number[];
  private readonly primary: THREE.Color;
  private readonly emissive: THREE.Color;
  private nextIndex = 0;
  private lastPosition: THREE.Vector3 | undefined;

  constructor(schoolId: SchoolId) {
    const palette = SCHOOL_PALETTE[schoolId];
    this.primary = new THREE.Color(palette.primary);
    this.emissive = new THREE.Color(palette.emissive);

    this.system = new ParticlePoints({ count: TRAIL_LENGTH, texture: getStreakTexture() });
    this.ages = new Array<number>(TRAIL_LENGTH).fill(INACTIVE_AGE);

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      this.system.alphas[i] = 0;
      this.system.sizes[i] = BASE_SIZE;
      this.system.setColor(i, this.primary);
    }
    this.system.commit();

    // Trail samples are absolute world positions (the projectile can be
    // anywhere), so this object never moves — unlike the anchor-point
    // effects in this directory, it stays at the scene origin.
    this.object3D = this.system.points;
  }

  setPosition(position: THREE.Vector3): void {
    if (this.lastPosition && this.lastPosition.distanceTo(position) < MIN_SPAWN_DISTANCE) {
      return;
    }

    const index = this.nextIndex;
    this.nextIndex = (this.nextIndex + 1) % TRAIL_LENGTH;

    this.system.setPosition(index, position.x, position.y, position.z);
    this.system.setColor(index, Math.random() < 0.3 ? this.emissive : this.primary);
    this.system.sizes[index] = BASE_SIZE * THREE.MathUtils.randFloat(0.85, 1.15);
    this.ages[index] = 0;

    if (this.lastPosition) {
      this.lastPosition.copy(position);
    } else {
      this.lastPosition = position.clone();
    }
  }

  update(dt: number): void {
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const age = this.ages[i] ?? INACTIVE_AGE;
      if (age === INACTIVE_AGE) {
        continue;
      }

      const nextAge = age + dt;
      const alpha = Math.max(0, 1 - nextAge / SAMPLE_LIFETIME);
      this.system.alphas[i] = alpha;
      this.ages[i] = alpha > 0 ? nextAge : INACTIVE_AGE;
    }
    this.system.commit();
  }

  dispose(): void {
    this.system.dispose();
  }
}
