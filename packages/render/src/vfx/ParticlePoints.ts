import * as THREE from "three";

/**
 * Shared GPU-instanced particle renderer used by every effect in this
 * directory. Wraps a `THREE.Points` + a small custom `ShaderMaterial` so
 * each particle can have its own screen-space size, color, alpha, and
 * (for elongated sprites like streaks) rotation — none of which
 * `THREE.PointsMaterial` supports per-vertex.
 *
 * Sizing is deliberately NOT attenuated by camera distance: PITHOS's game
 * camera (see `camera.ts`) is a fixed-offset isometric orthographic camera,
 * where perspective-style distance falloff would be physically wrong (an
 * orthographic camera has no perspective foreshortening) and, in practice,
 * every VFX instance sits roughly the same distance from the camera anyway.
 * `aSize` is therefore a constant on-screen pixel size (scaled once by
 * device pixel ratio at construction).
 *
 * Callers write directly into `positions`/`colors`/`sizes`/`alphas`/`angles`
 * (plain Float32Arrays, one entry — or three, for positions/colors — per
 * particle) each frame, then call `commit()` once to flag the GPU buffers
 * dirty. This avoids allocating per-particle objects every frame.
 */

const VERTEX_SHADER = `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aAngle;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vAngle = aAngle;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D map;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float s = sin(vAngle);
    float c = cos(vAngle);
    vec2 rotated = vec2(c * centered.x - s * centered.y, s * centered.x + c * centered.y) + 0.5;

    if (rotated.x < 0.0 || rotated.x > 1.0 || rotated.y < 0.0 || rotated.y > 1.0) {
      discard;
    }

    vec4 tex = texture2D(map, rotated);
    float a = tex.a * vAlpha;
    if (a < 0.01) {
      discard;
    }

    gl_FragColor = vec4(vColor, a);
  }
`;

const DEVICE_PIXEL_RATIO = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

export interface ParticlePointsOptions {
  readonly count: number;
  readonly texture: THREE.Texture;
  /** Defaults to `THREE.AdditiveBlending` (fits most glowy elemental VFX). */
  readonly blending?: THREE.Blending;
}

export class ParticlePoints {
  readonly points: THREE.Points;
  readonly count: number;

  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly sizes: Float32Array;
  readonly alphas: Float32Array;
  readonly angles: Float32Array;

  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;

  constructor(options: ParticlePointsOptions) {
    this.count = options.count;

    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.sizes = new Float32Array(this.count);
    this.alphas = new Float32Array(this.count);
    this.angles = new Float32Array(this.count);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("aColor", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute("aAlpha", new THREE.BufferAttribute(this.alphas, 1));
    this.geometry.setAttribute("aAngle", new THREE.BufferAttribute(this.angles, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: options.texture } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: options.blending ?? THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    // Particle bounds move every frame and a stale/undersized default
    // bounding sphere would risk the whole system popping out of view.
    this.points.frustumCulled = false;
  }

  /** Converts a caller-facing pixel size into device-pixel-adjusted `gl_PointSize` units. */
  static toDeviceSize(cssPixels: number): number {
    return cssPixels * DEVICE_PIXEL_RATIO;
  }

  setColor(index: number, color: THREE.Color): void {
    const i = index * 3;
    this.colors[i] = color.r;
    this.colors[i + 1] = color.g;
    this.colors[i + 2] = color.b;
  }

  setPosition(index: number, x: number, y: number, z: number): void {
    const i = index * 3;
    this.positions[i] = x;
    this.positions[i + 1] = y;
    this.positions[i + 2] = z;
  }

  /** Flags every GPU buffer dirty. Call once per frame after writing all particles. */
  commit(): void {
    const attrs = this.geometry.attributes;
    const position = attrs["position"];
    const aColor = attrs["aColor"];
    const aSize = attrs["aSize"];
    const aAlpha = attrs["aAlpha"];
    const aAngle = attrs["aAngle"];
    if (position) position.needsUpdate = true;
    if (aColor) aColor.needsUpdate = true;
    if (aSize) aSize.needsUpdate = true;
    if (aAlpha) aAlpha.needsUpdate = true;
    if (aAngle) aAngle.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
