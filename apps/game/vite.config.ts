import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

import { audioAdminPlugin } from "./vite-plugins/audioAdminPlugin";

// Monorepo root (parent of apps/ and packages/) — used by audioAdminPlugin
// to find assets/audio/ regardless of where `vite dev` is invoked from.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export default defineConfig({
  // Serves (and bundles into production builds) everything under the
  // repo-root assets/ directory at the URL root — assets/models/foo.glb
  // becomes fetchable at /models/foo.glb, with no duplication into
  // apps/game/public/. assets/audio/generated/ also becomes reachable this
  // way, though audioAdminPlugin's own dev-only static serving (a
  // different URL prefix, /audio-admin-files/) still works in parallel.
  publicDir: resolve(repoRoot, "assets"),
  server: {
    host: true,
  },
  plugins: [audioAdminPlugin(repoRoot)],
});
