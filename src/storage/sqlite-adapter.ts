/**
 * SQLite storage adapter for the persistent ledger system.
 *
 * Uses the `better-sqlite3` npm package (synchronous SQLite3 bindings for
 * Node.js). This adapter is optional — users only need it if they install
 * `better-sqlite3` as a dependency.
 *
 * Usage:
 * ```ts
 * import { SQLiteAdapter } from 'payload-utility';
 * const adapter = new SQLiteAdapter({ filepath: './ledger.db' });
 * await adapter.init();
 * ```
 */

import type {
  StorageAdapter,
  StoredLedgerEntry,
  LedgerQuery,
} from './types';

// ---------------------------------------------------------------------------
// Minimal type declarations for the better-sqlite3 API surface we use.
// This avoids a compile-time dependency on @types/better-sqlite3.
// ---------------------------------------------------------------------------

/** Subset of the better-sqlite3 Statement interface. */
interface BetterSqliteStatement {
  run(params?: Record<string, unknown>): { changes: number; lastInsertRowid: number | bigint };
  get(params?: Record<string, unknown>): unknown;
  all(params?: Record<string, unknown>): unknown[];
}

/** Subset of the better-sqlite3 Database interface. */
interface BetterSqliteDatabase {
  pragma(pragma: string): unknown;
  exec(sql: string): void;
  prepare(sql: string): BetterSqliteStatement;
  transaction<T extends (...args: unknown[]) => unknown>(fn: T): T;
  close(): void;
}

/** Constructor for a better-sqlite3 database. */
type BetterSqliteConstructor = new (filename: string) => BetterSqliteDatabase;

// ---------------------------------------------------------------------------
// Lazy / graceful import of better-sqlite3
// ---------------------------------------------------------------------------

let DatabaseCtor: BetterSqliteConstructor | undefined;

function loadBetterSqlite3(): BetterSqliteConstructor {
  if (!DatabaseCtor) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      DatabaseCtor = require('better-sqlite3') as BetterSqliteConstructor;
    } catch {
      throw new Error(
        'The "better-sqlite3" package is required for SQLiteAdapter. ' +
          'Install it with: npm install better-sqlite3'
      );
    }
  }
  return DatabaseCtor;
}

// ---------------------------------------------------------------------------
// SQLiteAdapter
// ---------------------------------------------------------------------------

export interface SQLiteAdapterOptions {
  /** Path to the SQLite database file. Use ":memory:" for in-memory SQLite. */
  filepath: string;
}

export class SQLiteAdapter implements StorageAdapter {
  private readonly filepath: string;
  private db: BetterSqliteDatabase | null = null;

  constructor(options: SQLiteAdapterOptions) {
    this.filepath = options.filepath;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async init(): Promise<void> {
    const Ctor = loadBetterSqlite3();
    this.db = new Ctor(this.filepath);

    // Enable WAL mode for better concurrent read performance.
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        amount REAL NOT NULL,
        entry_type TEXT NOT NULL CHECK(entry_type IN ('debit','credit')),
        description TEXT,
        reference TEXT,
        transaction_id TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tenant ON ledger_entries(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_account ON ledger_entries(tenant_id, account_id);
      CREATE INDEX IF NOT EXISTS idx_txn ON ledger_entries(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_date ON ledger_entries(tenant_id, created_at);
    `);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // -----------------------------------------------------------------------
  // Write operations
  // -----------------------------------------------------------------------

  async saveLedgerEntry(entry: StoredLedgerEntry): Promise<void> {
    const db = this.requireDb();
    const stmt = db.prepare(`
      INSERT INTO ledger_entries
        (id, tenant_id, account_id, amount, entry_type, description, reference, transaction_id, metadata, created_at)
      VALUES
        (@id, @tenantId, @accountId, @amount, @entryType, @description, @reference, @transactionId, @metadata, @createdAt)
    `);
    stmt.run(this.toRow(entry));
  }

  async saveLedgerEntries(entries: StoredLedgerEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const db = this.requireDb();
    const stmt = db.prepare(`
      INSERT INTO ledger_entries
        (id, tenant_id, account_id, amount, entry_type, description, reference, transaction_id, metadata, created_at)
      VALUES
        (@id, @tenantId, @accountId, @amount, @entryType, @description, @reference, @transactionId, @metadata, @createdAt)
    `);

    const insertMany = db.transaction((rows: unknown) => {
      for (const row of rows as Record<string, unknown>[]) {
        stmt.run(row);
      }
    });

    insertMany(entries.map((e) => this.toRow(e)));
  }

  // -----------------------------------------------------------------------
  // Read operations
  // -----------------------------------------------------------------------

  async getLedgerEntries(query: LedgerQuery): Promise<StoredLedgerEntry[]> {
    const db = this.requireDb();
    const { whereClause, params } = this.buildWhere(query);

    let sql = `SELECT * FROM ledger_entries${whereClause} ORDER BY created_at ASC`;

    if (query.limit !== undefined) {
      sql += ` LIMIT ${Number(query.limit)}`;
    }
    if (query.offset !== undefined) {
      sql += ` OFFSET ${Number(query.offset)}`;
    }

    const rows = db.prepare(sql).all(params) as RawRow[];
    return rows.map((row) => this.fromRow(row));
  }

  async countLedgerEntries(query: LedgerQuery): Promise<number> {
    const db = this.requireDb();
    const { whereClause, params } = this.buildWhere(query);
    const sql = `SELECT COUNT(*) AS cnt FROM ledger_entries${whereClause}`;
    const row = db.prepare(sql).get(params) as { cnt: number };
    return row.cnt;
  }

  async deleteLedgerEntries(query: LedgerQuery): Promise<number> {
    const db = this.requireDb();
    const { whereClause, params } = this.buildWhere(query);
    const sql = `DELETE FROM ledger_entries${whereClause}`;
    const result = db.prepare(sql).run(params);
    return result.changes;
  }

  async getDistinctAccountIds(tenantId?: string): Promise<string[]> {
    const db = this.requireDb();
    if (tenantId) {
      const rows = db
        .prepare('SELECT DISTINCT account_id FROM ledger_entries WHERE tenant_id = @tenantId ORDER BY account_id')
        .all({ tenantId }) as Array<{ account_id: string }>;
      return rows.map((r) => r.account_id);
    }
    const rows = db
      .prepare('SELECT DISTINCT account_id FROM ledger_entries ORDER BY account_id')
      .all() as Array<{ account_id: string }>;
    return rows.map((r) => r.account_id);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private requireDb(): BetterSqliteDatabase {
    if (!this.db) {
      throw new Error(
        'SQLiteAdapter is not initialized. Call init() before using the adapter.'
      );
    }
    return this.db;
  }

  /**
   * Convert a StoredLedgerEntry to a flat row object suitable for
   * better-sqlite3 named parameter binding.
   */
  private toRow(entry: StoredLedgerEntry): Record<string, unknown> {
    return {
      id: entry.id,
      tenantId: entry.tenantId,
      accountId: entry.accountId,
      amount: entry.amount,
      entryType: entry.entryType,
      description: entry.description ?? null,
      reference: entry.reference ?? null,
      transactionId: entry.transactionId ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      createdAt: entry.createdAt,
    };
  }

  /**
   * Convert a raw database row back into a StoredLedgerEntry.
   */
  private fromRow(row: RawRow): StoredLedgerEntry {
    const entry: StoredLedgerEntry = {
      id: row.id,
      tenantId: row.tenant_id,
      accountId: row.account_id,
      amount: row.amount,
      entryType: row.entry_type as 'debit' | 'credit',
      description: row.description ?? '',
      createdAt: row.created_at,
    };

    if (row.reference != null) {
      entry.reference = row.reference;
    }
    if (row.transaction_id != null) {
      entry.transactionId = row.transaction_id;
    }
    if (row.metadata != null) {
      try {
        entry.metadata = JSON.parse(row.metadata);
      } catch {
        // If metadata is not valid JSON, ignore it.
      }
    }

    return entry;
  }

  /**
   * Build a WHERE clause from a LedgerQuery, returning both the SQL fragment
   * and a parameter object for named binding.
   */
  private buildWhere(query: LedgerQuery): {
    whereClause: string;
    params: Record<string, string | number>;
  } {
    const conditions: string[] = [];
    const params: Record<string, string | number> = {};

    if (query.tenantId !== undefined) {
      conditions.push('tenant_id = @tenantId');
      params.tenantId = query.tenantId;
    }

    if (query.accountId !== undefined) {
      conditions.push('account_id = @accountId');
      params.accountId = query.accountId;
    }

    if (query.entryType !== undefined) {
      conditions.push('entry_type = @entryType');
      params.entryType = query.entryType;
    }

    if (query.transactionId !== undefined) {
      conditions.push('transaction_id = @transactionId');
      params.transactionId = query.transactionId;
    }

    if (query.fromDate !== undefined) {
      conditions.push('created_at >= @fromDate');
      params.fromDate = query.fromDate;
    }

    if (query.toDate !== undefined) {
      conditions.push('created_at <= @toDate');
      params.toDate = query.toDate;
    }

    const whereClause =
      conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    return { whereClause, params };
  }
}

// ---------------------------------------------------------------------------
// Internal raw row type matching the SQLite table columns
// ---------------------------------------------------------------------------

interface RawRow {
  id: string;
  tenant_id: string;
  account_id: string;
  amount: number;
  entry_type: string;
  description: string | null;
  reference: string | null;
  transaction_id: string | null;
  metadata: string | null;
  created_at: string;
}
