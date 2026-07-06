import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // happy-dom, not "node": IndexedDbSaveAdapter's tests need a browser-like
    // global environment; the actual IndexedDB implementation itself comes
    // from the fake-indexeddb polyfill loaded in vitest.setup.ts, not from
    // happy-dom (happy-dom doesn't implement IndexedDB).
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
  },
});
