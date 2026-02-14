/**
 * Storage module — adapters and types for persistent ledger storage.
 */
export {
  StorageAdapter,
  StoredLedgerEntry,
  LedgerQuery,
  StorageConfig,
  MemoryStorageConfig,
  SqliteStorageConfig,
  PostgresStorageConfig,
} from './types';
export { MemoryAdapter } from './memory-adapter';
export { JsonFileAdapter } from './json-file-adapter';
