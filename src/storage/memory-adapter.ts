/**
 * In-memory storage adapter for the ledger system.
 *
 * This is the DEFAULT adapter used when no persistent storage is configured.
 * All data lives in memory and is lost when the process exits.
 */

import { StorageAdapter, StoredLedgerEntry, LedgerQuery } from './types';

export interface MemoryAdapterOptions {
  /** Maximum number of entries to store. Oldest entries are evicted when exceeded. */
  maxEntries?: number;
}

export class MemoryAdapter implements StorageAdapter {
  private entries: Map<string, StoredLedgerEntry> = new Map();
  /** Secondary index: tenant_id → set of entry IDs. */
  private tenantIndex: Map<string, Set<string>> = new Map();
  /** Secondary index: account_id → set of entry IDs. */
  private accountIndex: Map<string, Set<string>> = new Map();
  /** Insertion-ordered list of IDs (for maxEntries eviction). */
  private insertionOrder: string[] = [];

  private readonly maxEntries: number | undefined;

  constructor(options?: MemoryAdapterOptions) {
    this.maxEntries = options?.maxEntries;
  }

  async init(): Promise<void> {
    // No-op — in-memory adapter is always ready.
  }

  async close(): Promise<void> {
    this.entries.clear();
    this.tenantIndex.clear();
    this.accountIndex.clear();
    this.insertionOrder = [];
  }

  async saveLedgerEntry(entry: StoredLedgerEntry): Promise<void> {
    this.addEntry(entry);
  }

  async saveLedgerEntries(entries: StoredLedgerEntry[]): Promise<void> {
    for (const entry of entries) {
      this.addEntry(entry);
    }
  }

  async getLedgerEntries(query: LedgerQuery): Promise<StoredLedgerEntry[]> {
    let candidates = this.getCandidateIds(query);
    let results = this.filterEntries(candidates, query);

    // Sort by createdAt ascending (stable default)
    results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    // Apply offset
    if (query.offset && query.offset > 0) {
      results = results.slice(query.offset);
    }

    // Apply limit
    if (query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async deleteLedgerEntries(query: LedgerQuery): Promise<number> {
    const candidates = this.getCandidateIds(query);
    const toDelete = this.filterEntries(candidates, query);

    for (const entry of toDelete) {
      this.removeEntry(entry);
    }

    return toDelete.length;
  }

  async countLedgerEntries(query: LedgerQuery): Promise<number> {
    const candidates = this.getCandidateIds(query);
    const filtered = this.filterEntries(candidates, query);
    return filtered.length;
  }

  async getDistinctAccountIds(tenantId?: string): Promise<string[]> {
    if (tenantId) {
      const entryIds = this.tenantIndex.get(tenantId);
      if (!entryIds) return [];
      const accountIds = new Set<string>();
      for (const id of entryIds) {
        const entry = this.entries.get(id);
        if (entry) {
          accountIds.add(entry.accountId);
        }
      }
      return Array.from(accountIds);
    }
    return Array.from(this.accountIndex.keys());
  }

  /**
   * Return storage statistics.
   */
  getStats(): {
    entryCount: number;
    tenantCount: number;
    accountCount: number;
    memoryEstimate: number;
  } {
    // Rough memory estimate: ~200 bytes per entry for the object + index overhead
    const memoryEstimate = this.entries.size * 200;
    return {
      entryCount: this.entries.size,
      tenantCount: this.tenantIndex.size,
      accountCount: this.accountIndex.size,
      memoryEstimate,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private addEntry(entry: StoredLedgerEntry): void {
    // Evict oldest if at capacity
    if (this.maxEntries && this.entries.size >= this.maxEntries) {
      this.evictOldest();
    }

    this.entries.set(entry.id, entry);
    this.insertionOrder.push(entry.id);

    // Update tenant index
    let tenantSet = this.tenantIndex.get(entry.tenantId);
    if (!tenantSet) {
      tenantSet = new Set();
      this.tenantIndex.set(entry.tenantId, tenantSet);
    }
    tenantSet.add(entry.id);

    // Update account index
    let accountSet = this.accountIndex.get(entry.accountId);
    if (!accountSet) {
      accountSet = new Set();
      this.accountIndex.set(entry.accountId, accountSet);
    }
    accountSet.add(entry.id);
  }

  private removeEntry(entry: StoredLedgerEntry): void {
    this.entries.delete(entry.id);

    // Update tenant index
    const tenantSet = this.tenantIndex.get(entry.tenantId);
    if (tenantSet) {
      tenantSet.delete(entry.id);
      if (tenantSet.size === 0) {
        this.tenantIndex.delete(entry.tenantId);
      }
    }

    // Update account index
    const accountSet = this.accountIndex.get(entry.accountId);
    if (accountSet) {
      accountSet.delete(entry.id);
      if (accountSet.size === 0) {
        this.accountIndex.delete(entry.accountId);
      }
    }

    // Remove from insertion order (lazy — cleaned up during eviction)
  }

  private evictOldest(): void {
    // Walk the insertion order to find the first entry that still exists
    while (this.insertionOrder.length > 0) {
      const oldestId = this.insertionOrder.shift()!;
      const entry = this.entries.get(oldestId);
      if (entry) {
        this.removeEntry(entry);
        return;
      }
      // Entry was already removed (by delete); skip and try next
    }
  }

  /**
   * Use secondary indexes to narrow down candidate entry IDs before applying
   * the full filter. Returns null if no index can be used (meaning scan all).
   */
  private getCandidateIds(query: LedgerQuery): Set<string> | null {
    const sets: Set<string>[] = [];

    if (query.tenantId) {
      const tenantSet = this.tenantIndex.get(query.tenantId);
      if (!tenantSet || tenantSet.size === 0) return new Set();
      sets.push(tenantSet);
    }

    if (query.accountId) {
      const accountSet = this.accountIndex.get(query.accountId);
      if (!accountSet || accountSet.size === 0) return new Set();
      sets.push(accountSet);
    }

    if (sets.length === 0) return null; // No index applicable — full scan
    if (sets.length === 1) return sets[0];

    // Intersect the sets: start with the smallest for efficiency
    sets.sort((a, b) => a.size - b.size);
    const result = new Set<string>();
    for (const id of sets[0]) {
      if (sets.every((s) => s.has(id))) {
        result.add(id);
      }
    }
    return result;
  }

  /**
   * Apply remaining query filters to a set of candidate IDs (or all entries
   * if candidates is null).
   */
  private filterEntries(
    candidateIds: Set<string> | null,
    query: LedgerQuery,
  ): StoredLedgerEntry[] {
    const source: Iterable<StoredLedgerEntry> =
      candidateIds === null
        ? this.entries.values()
        : this.resolveIds(candidateIds);

    const results: StoredLedgerEntry[] = [];

    for (const entry of source) {
      if (query.tenantId && entry.tenantId !== query.tenantId) continue;
      if (query.accountId && entry.accountId !== query.accountId) continue;
      if (query.entryType && entry.entryType !== query.entryType) continue;
      if (query.transactionId && entry.transactionId !== query.transactionId) continue;
      if (query.fromDate && entry.createdAt < query.fromDate) continue;
      if (query.toDate && entry.createdAt > query.toDate) continue;
      results.push(entry);
    }

    return results;
  }

  private *resolveIds(ids: Set<string>): Iterable<StoredLedgerEntry> {
    for (const id of ids) {
      const entry = this.entries.get(id);
      if (entry) yield entry;
    }
  }
}
