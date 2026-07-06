// Polyfills `indexedDB`/`IDBKeyRange`/etc as globals so `idb` (and
// IndexedDbSaveAdapter, which uses it) work under Vitest, where no real
// browser IndexedDB implementation exists. Individual tests that need
// isolation between cases reset `globalThis.indexedDB` to a fresh
// `IDBFactory` themselves (see IndexedDbSaveAdapter.test.ts).
import "fake-indexeddb/auto";
