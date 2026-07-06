import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

import { audioAdminPlugin } from "./vite-plugins/audioAdminPlugin";

// Monorepo root (parent of apps/ and packages/) — used by audioAdminPlugin
// to find assets/audio/ regardless of where `vite dev` is invoked from.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export default defineConfig({
  server: {
    host: true,
  },
  plugins: [audioAdminPlugin(repoRoot)],
});
