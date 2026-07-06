export { createScene } from "./scene";
export { createIsometricCamera, resizeIsometricCamera } from "./camera";
export { createBlockoutRoom } from "./blockout";
export { createPlayerPlaceholder } from "./placeholder";

export { loadGltfModel, clearGltfModelCache } from "./loaders/GltfAssetLoader.js";

export type { VfxEffect, SchoolColors, ProjectileTrailEffect } from "./vfx/index.js";
export {
  SCHOOL_PALETTE,
  createHitImpact,
  createFormCastEffect,
  createChargeBurstEffect,
  createAmbientBiomeParticles,
  createProjectileTrail,
} from "./vfx/index.js";
