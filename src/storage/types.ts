/**
 * Storage adapter interface and related types for the persistent ledger system.
 *
 * The StorageAdapter abstraction allows the ledger to be backed by different
 * storage engines (in-memory, SQLite, PostgreSQL, etc.) while keeping the
 * business logic decoupled from persistence details.
 */

// ---------------------------------------------------------------------------
// Stored data types
// ---------------------------------------------------------------------------

export interface StoredLedgerEntry {
  id: string;
  /** Tenant identifier for multi-tenant isolation. */
  tenantId: string;
  accountId: string;
  amount: number;
  entryType: 'debit' | 'credit';
  description: string;
  /** Optional external reference (e.g. invoice number). */
  reference?: string;
  /** Link back to a Payload transaction id. */
  transactionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Query types
// ---------------------------------------------------------------------------

export interface LedgerQuery {
  tenantId?: string;
  accountId?: string;
  entryType?: 'debit' | 'credit';
  fromDate?: string;
  toDate?: string;
  transactionId?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Storage configuration (discriminated union)
// ---------------------------------------------------------------------------

export interface MemoryStorageConfig {
  type: 'memory';
}

export interface SqliteStorageConfig {
  type: 'sqlite';
  /** Path to the SQLite database file. Use ":memory:" for in-memory SQLite. */
  filepath: string;
}

export interface PostgresStorageConfig {
  type: 'postgres';
  connectionString: string;
  /** Maximum number of connections in the pool. */
  poolSize?: number;
}

export type StorageConfig =
  | MemoryStorageConfig
  | SqliteStorageConfig
  | PostgresStorageConfig;

// ---------------------------------------------------------------------------
// Storage adapter interface
// ---------------------------------------------------------------------------

export interface StorageAdapter {
  /** Initialize storage (create tables, run migrations, etc.). */
  init(): Promise<void>;

  /** Gracefully close the storage connection / release resources. */
  close(): Promise<void>;

  /** Persist a single ledger entry. */
  saveLedgerEntry(entry: StoredLedgerEntry): Promise<void>;

  /** Persist multiple ledger entries in a single batch. */
  saveLedgerEntries(entries: StoredLedgerEntry[]): Promise<void>;

  /** Retrieve ledger entries matching the given query. */
  getLedgerEntries(query: LedgerQuery): Promise<StoredLedgerEntry[]>;

  /** Delete ledger entries matching the given query. Returns the count of deleted entries. */
  deleteLedgerEntries(query: LedgerQuery): Promise<number>;

  /** Count ledger entries matching the given query. */
  countLedgerEntries(query: LedgerQuery): Promise<number>;

  /** Return all distinct account IDs, optionally scoped to a tenant. */
  getDistinctAccountIds(tenantId?: string): Promise<string[]>;
}
