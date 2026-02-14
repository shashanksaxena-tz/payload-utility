/**
 * JSON file-based storage adapter for the persistent ledger system.
 *
 * Stores ledger entries as a JSON file on disk with an in-memory cache for
 * fast reads. Writes are debounced to avoid excessive I/O on rapid operations.
 * A simple .lock file mechanism prevents corruption from concurrent processes.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  StorageAdapter,
  StoredLedgerEntry,
  LedgerQuery,
} from './types';

// ---------------------------------------------------------------------------
// File format
// ---------------------------------------------------------------------------

interface JsonFileData {
  version: 1;
  entries: StoredLedgerEntry[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface JsonFileAdapterConfig {
  /** Absolute or relative path to the JSON data file. */
  filePath: string;
  /** Pretty-print the JSON output (default: false). */
  prettyPrint?: boolean;
  /** Automatically flush to disk after mutations (default: true). */
  autoSave?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 100;
const LOCK_STALE_MS = 10_000; // consider lock stale after 10 s
const LOCK_RETRY_MS = 50;
const LOCK_MAX_RETRIES = 60; // 60 * 50 ms = 3 s max wait

// ---------------------------------------------------------------------------
// JsonFileAdapter
// ---------------------------------------------------------------------------

export class JsonFileAdapter implements StorageAdapter {
  private readonly filePath: string;
  private readonly lockPath: string;
  private readonly prettyPrint: boolean;
  private readonly autoSave: boolean;

  private entries: StoredLedgerEntry[] = [];
  private dirty = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;

  constructor(config: JsonFileAdapterConfig) {
    this.filePath = path.resolve(config.filePath);
    this.lockPath = this.filePath + '.lock';
    this.prettyPrint = config.prettyPrint ?? false;
    this.autoSave = config.autoSave ?? true;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async init(): Promise<void> {
    if (this.initialized) return;

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      await this.readFromDisk();
    } else {
      this.entries = [];
      await this.writeToDisk();
    }

    this.initialized = true;
  }

  async close(): Promise<void> {
    this.clearDebounce();
    if (this.dirty) {
      await this.writeToDisk();
    }
    this.initialized = false;
  }

  // -------------------------------------------------------------------------
  // Write operations
  // -------------------------------------------------------------------------

  async saveLedgerEntry(entry: StoredLedgerEntry): Promise<void> {
    this.ensureInitialized();
    this.entries.push(entry);
    this.markDirty();
  }

  async saveLedgerEntries(entries: StoredLedgerEntry[]): Promise<void> {
    this.ensureInitialized();
    this.entries.push(...entries);
    this.markDirty();
  }

  async deleteLedgerEntries(query: LedgerQuery): Promise<number> {
    this.ensureInitialized();
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => !this.matchesQuery(e, query));
    const deleted = before - this.entries.length;
    if (deleted > 0) {
      this.markDirty();
    }
    return deleted;
  }

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  async getLedgerEntries(query: LedgerQuery): Promise<StoredLedgerEntry[]> {
    this.ensureInitialized();
    let results = this.entries.filter((e) => this.matchesQuery(e, query));

    // Sort by createdAt ascending (consistent ordering)
    results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    if (query.offset) {
      results = results.slice(query.offset);
    }
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async countLedgerEntries(query: LedgerQuery): Promise<number> {
    this.ensureInitialized();
    return this.entries.filter((e) => this.matchesQuery(e, query)).length;
  }

  async getDistinctAccountIds(tenantId?: string): Promise<string[]> {
    this.ensureInitialized();
    const ids = new Set<string>();
    for (const entry of this.entries) {
      if (tenantId !== undefined && entry.tenantId !== tenantId) continue;
      ids.add(entry.accountId);
    }
    return Array.from(ids).sort();
  }

  // -------------------------------------------------------------------------
  // Query matching
  // -------------------------------------------------------------------------

  private matchesQuery(entry: StoredLedgerEntry, query: LedgerQuery): boolean {
    if (query.tenantId !== undefined && entry.tenantId !== query.tenantId) return false;
    if (query.accountId !== undefined && entry.accountId !== query.accountId) return false;
    if (query.entryType !== undefined && entry.entryType !== query.entryType) return false;
    if (query.transactionId !== undefined && entry.transactionId !== query.transactionId) return false;
    if (query.fromDate !== undefined && entry.createdAt < query.fromDate) return false;
    if (query.toDate !== undefined && entry.createdAt > query.toDate) return false;
    return true;
  }

  // -------------------------------------------------------------------------
  // Dirty tracking & debounced writes
  // -------------------------------------------------------------------------

  private markDirty(): void {
    this.dirty = true;
    if (this.autoSave) {
      this.scheduleDebouncedWrite();
    }
  }

  private scheduleDebouncedWrite(): void {
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.writeToDisk().catch(() => {
        // Silently ignore background write errors — close() will retry.
      });
    }, DEBOUNCE_MS);
  }

  private clearDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Disk I/O with file locking
  // -------------------------------------------------------------------------

  private async readFromDisk(): Promise<void> {
    const raw = fs.readFileSync(this.filePath, 'utf-8');
    const data: JsonFileData = JSON.parse(raw);
    this.entries = data.entries ?? [];
  }

  private async writeToDisk(): Promise<void> {
    await this.acquireLock();
    try {
      const data: JsonFileData = {
        version: 1,
        entries: this.entries,
      };
      const json = this.prettyPrint
        ? JSON.stringify(data, null, 2)
        : JSON.stringify(data);

      // Atomic-ish write: write to temp file then rename
      const tmpPath = this.filePath + '.tmp';
      fs.writeFileSync(tmpPath, json, 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
      this.dirty = false;
    } finally {
      this.releaseLock();
    }
  }

  // -------------------------------------------------------------------------
  // Simple file-based locking
  // -------------------------------------------------------------------------

  private async acquireLock(): Promise<void> {
    for (let attempt = 0; attempt < LOCK_MAX_RETRIES; attempt++) {
      try {
        // O_CREAT | O_EXCL — fails if file already exists
        fs.writeFileSync(this.lockPath, String(Date.now()), { flag: 'wx' });
        return; // Lock acquired
      } catch {
        // Lock file exists — check if it's stale
        if (this.isLockStale()) {
          this.releaseLock();
          continue;
        }
        await this.sleep(LOCK_RETRY_MS);
      }
    }
    // After max retries, force-acquire by removing stale lock
    this.releaseLock();
    fs.writeFileSync(this.lockPath, String(Date.now()), { flag: 'wx' });
  }

  private releaseLock(): void {
    try {
      fs.unlinkSync(this.lockPath);
    } catch {
      // Lock file already removed — ignore
    }
  }

  private isLockStale(): boolean {
    try {
      const content = fs.readFileSync(this.lockPath, 'utf-8');
      const timestamp = parseInt(content, 10);
      if (isNaN(timestamp)) return true;
      return Date.now() - timestamp > LOCK_STALE_MS;
    } catch {
      return true;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('JsonFileAdapter has not been initialized. Call init() first.');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
