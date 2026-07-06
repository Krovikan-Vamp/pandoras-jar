import * as THREE from "three";

/**
 * Shared, lazily-created sprite textures used by every particle effect in
 * this directory. They are pure white-on-transparent alpha masks — each
 * effect tints them per-particle via a vertex color, so one texture can be
 * reused for every School/Form combination.
 *
 * These are cached as module-level singletons rather than created per
 * effect instance: `HitImpact` in particular fires on every successful
 * attack landing, so re-rasterizing a canvas per hit would be wasteful.
 * Because the textures are shared across many concurrently-live effects, an
 * individual effect's `dispose()` intentionally does NOT dispose these —
 * only the geometry/material it owns exclusively. The textures live for the
 * lifetime of the page, which is fine for a couple of tiny (64x32px) canvases.
 */

let softCircleTexture: THREE.Texture | undefined;
let streakTexture: THREE.Texture | undefined;

function createCanvas(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("vfx: 2D canvas context unavailable while building a sprite texture");
  }
  return ctx;
}

/**
 * A soft radial-falloff circle: the general-purpose particle sprite used by
 * embers, dust, bubbles, sparkles, spark bursts, and shockwave particles.
 */
export function getSoftCircleTexture(): THREE.Texture {
  if (softCircleTexture) {
    return softCircleTexture;
  }

  const size = 64;
  const ctx = createCanvas(size, size);
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.85)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  softCircleTexture = new THREE.CanvasTexture(ctx.canvas);
  return softCircleTexture;
}

/**
 * A horizontally-elongated soft streak: used for flowing/liquid particles,
 * wind streaks, and projectile trails, oriented per-particle via the
 * `ParticlePoints` `angle` attribute.
 */
export function getStreakTexture(): THREE.Texture {
  if (streakTexture) {
    return streakTexture;
  }

  const width = 64;
  const height = 24;
  const ctx = createCanvas(width, height);
  const cx = width / 2;
  const cy = height / 2;

  // Elongated falloff: wide along X, tight along Y — approximated by
  // stretching a radial gradient onto a wide rectangle via scale.
  ctx.translate(cx, cy);
  ctx.scale(width / height, 1);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, height / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(-height / 2, -height / 2, height, height);

  streakTexture = new THREE.CanvasTexture(ctx.canvas);
  return streakTexture;
}
