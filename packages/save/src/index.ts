export {
  CURRENT_META_SCHEMA_VERSION,
  CURRENT_RUN_SCHEMA_VERSION,
  createDefaultMetaSaveData,
  createDefaultRunState,
  LOADOUT_SLOT_IDS,
  type LoadoutSlotId,
  type MetaSaveData,
  type RunState,
} from "./schema.js";

export {
  migrateMetaSaveData,
  migrateRunState,
  runMigrationChain,
  type Migration,
} from "./migrations.js";

export type { SaveAdapter } from "./SaveAdapter.js";

export { IndexedDbSaveAdapter } from "./IndexedDbSaveAdapter.js";
