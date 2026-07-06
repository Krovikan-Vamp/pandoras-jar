import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinnedScene } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Thin wrapper around three.js's GLTFLoader for loading the .gltf/.glb model
 * assets checked into assets/models/ (see assets/models/SOURCES.md for what's
 * available and how each file is licensed).
 *
 * A single GLTFLoader instance is reused for every call; three's loaders are
 * stateless per-call aside from configuration (DRACOLoader/KTX2Loader, which
 * none of our current assets need), so sharing one is safe.
 */
const loader = new GLTFLoader();

/**
 * Cache of in-flight/completed loads, keyed by the exact path passed to
 * `loadGltfModel`. This is what makes loading the same model twice not
 * re-fetch or re-parse: the second call reuses the first call's promise
 * instead of issuing a new network request.
 *
 * A failed load is removed from the cache (see `loadGltfModel` below) so a
 * transient failure (e.g. a flaky network) doesn't permanently poison the
 * cache for that path.
 */
const gltfCache = new Map<string, Promise<GLTF>>();

/**
 * Loads a glTF/GLB model and resolves with a ready-to-add `THREE.Group`.
 *
 * Every call resolves with a fresh, independent clone of the loaded scene
 * graph (skinned meshes and their skeletons are cloned correctly, via
 * three's `SkeletonUtils.clone`, not the plain `Object3D.clone` which shares
 * skeletons across clones). That means it's safe to call this repeatedly for
 * the same path — e.g. once per enemy instance that reuses `humanoid_base.glb`
 * — without instances fighting over one shared transform or animation state.
 * Only the underlying fetch + glTF parse is cached/deduplicated, not the
 * returned Group itself.
 *
 * Rejects with a clear, path-specific Error if the request 404s (or any
 * other non-OK HTTP response) or if the response can't be parsed as glTF.
 */
export function loadGltfModel(path: string): Promise<THREE.Group> {
  let pending = gltfCache.get(path);

  if (!pending) {
    pending = new Promise<GLTF>((resolve, reject) => {
      loader.load(
        path,
        (gltf) => resolve(gltf),
        undefined,
        (error) => {
          reject(
            new Error(`GltfAssetLoader: failed to load model at "${path}": ${describeLoadError(error)}`),
          );
        },
      );
    });

    // Don't let a failed load permanently occupy the cache slot — a later
    // call for the same path should be free to try again.
    pending.catch(() => {
      gltfCache.delete(path);
    });

    gltfCache.set(path, pending);
  }

  return pending.then((gltf) => cloneSkinnedScene(gltf.scene) as THREE.Group);
}

/** Removes every cached load result. Mainly useful for tests. */
export function clearGltfModelCache(): void {
  gltfCache.clear();
}

function describeLoadError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown error";
}
