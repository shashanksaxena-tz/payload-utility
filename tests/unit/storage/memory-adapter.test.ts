import { MemoryAdapter } from '../../../src/storage/memory-adapter';
import { StoredLedgerEntry } from '../../../src/storage/types';

function makeEntry(overrides: Partial<StoredLedgerEntry> = {}): StoredLedgerEntry {
  return {
    id: `entry_${Math.random().toString(36).slice(2, 10)}`,
    tenantId: 'tenant_default',
    accountId: 'acct_default',
    amount: 100,
    entryType: 'debit',
    description: 'Test entry',
    createdAt: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.init();
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('init and close', () => {
    it('should initialize without error', async () => {
      const a = new MemoryAdapter();
      await expect(a.init()).resolves.toBeUndefined();
    });

    it('should clear all data on close', async () => {
      await adapter.saveLedgerEntry(makeEntry());
      await adapter.close();

      // Reinitialize
      await adapter.init();
      const count = await adapter.countLedgerEntries({});
      expect(count).toBe(0);
    });
  });

  describe('saveLedgerEntry', () => {
    it('should save a single entry', async () => {
      const entry = makeEntry({ id: 'e1' });
      await adapter.saveLedgerEntry(entry);

      const results = await adapter.getLedgerEntries({});
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('e1');
    });
  });

  describe('saveLedgerEntries (batch)', () => {
    it('should save multiple entries', async () => {
      const entries = [
        makeEntry({ id: 'e1' }),
        makeEntry({ id: 'e2' }),
        makeEntry({ id: 'e3' }),
      ];
      await adapter.saveLedgerEntries(entries);

      const count = await adapter.countLedgerEntries({});
      expect(count).toBe(3);
    });
  });

  describe('getLedgerEntries', () => {
    it('should return all entries when query is empty', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e1' }),
        makeEntry({ id: 'e2' }),
      ]);

      const results = await adapter.getLedgerEntries({});
      expect(results).toHaveLength(2);
    });

    it('should filter by tenantId', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e1', tenantId: 'tenant_a' }),
        makeEntry({ id: 'e2', tenantId: 'tenant_b' }),
        makeEntry({ id: 'e3', tenantId: 'tenant_a' }),
      ]);

      const results = await adapter.getLedgerEntries({ tenantId: 'tenant_a' });
      expect(results).toHaveLength(2);
      expect(results.every(e => e.tenantId === 'tenant_a')).toBe(true);
    });

    it('should filter by accountId', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e1', accountId: 'acct_rev' }),
        makeEntry({ id: 'e2', accountId: 'acct_exp' }),
        makeEntry({ id: 'e3', accountId: 'acct_rev' }),
      ]);

      const results = await adapter.getLedgerEntries({ accountId: 'acct_rev' });
      expect(results).toHaveLength(2);
    });

    it('should filter by entryType', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e1', entryType: 'debit' }),
        makeEntry({ id: 'e2', entryType: 'credit' }),
        makeEntry({ id: 'e3', entryType: 'debit' }),
      ]);

      const results = await adapter.getLedgerEntries({ entryType: 'credit' });
      expect(results).toHaveLength(1);
      expect(results[0].entryType).toBe('credit');
    });

    it('should filter by transactionId', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e1', transactionId: 'txn_1' }),
        makeEntry({ id: 'e2', transactionId: 'txn_2' }),
        makeEntry({ id: 'e3', transactionId: 'txn_1' }),
      ]);

      const results = await adapter.getLedgerEntries({ transactionId: 'txn_1' });
      expect(results).toHaveLength(2);
    });

    it('should filter by date range (fromDate)', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e1', createdAt: '2026-01-01T00:00:00Z' }),
        makeEntry({ id: 'e2', createdAt: '2026-02-01T00:00:00Z' }),
        makeEntry({ id: 'e3', createdAt: '2026-03-01T00:00:00Z' }),
      ]);

      const results = await adapter.getLedgerEntries({ fromDate: '2026-02-01T00:00:00Z' });
      expect(results).toHaveLength(2);
    });

    it('should filter by date range (toDate)', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e1', createdAt: '2026-01-01T00:00:00Z' }),
        makeEntry({ id: 'e2', createdAt: '2026-02-01T00:00:00Z' }),
        makeEntry({ id: 'e3', createdAt: '2026-03-01T00:00:00Z' }),
      ]);

      const results = await adapter.getLedgerEntries({ toDate: '2026-01-31T23:59:59Z' });
      expect(results).toHaveLength(1);
    });

    it('should filter by combined query fields', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e1', tenantId: 'tenant_a', accountId: 'acct_rev', entryType: 'debit' }),
        makeEntry({ id: 'e2', tenantId: 'tenant_a', accountId: 'acct_rev', entryType: 'credit' }),
        makeEntry({ id: 'e3', tenantId: 'tenant_b', accountId: 'acct_rev', entryType: 'debit' }),
      ]);

      const results = await adapter.getLedgerEntries({
        tenantId: 'tenant_a',
        accountId: 'acct_rev',
        entryType: 'debit',
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('e1');
    });

    it('should apply limit', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e1', createdAt: '2026-01-01T00:00:00Z' }),
        makeEntry({ id: 'e2', createdAt: '2026-01-02T00:00:00Z' }),
        makeEntry({ id: 'e3', createdAt: '2026-01-03T00:00:00Z' }),
      ]);

      const results = await adapter.getLedgerEntries({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should apply offset', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e1', createdAt: '2026-01-01T00:00:00Z' }),
        makeEntry({ id: 'e2', createdAt: '2026-01-02T00:00:00Z' }),
        makeEntry({ id: 'e3', createdAt: '2026-01-03T00:00:00Z' }),
      ]);

      const results = await adapter.getLedgerEntries({ offset: 1 });
      expect(results).toHaveLength(2);
    });

    it('should sort by createdAt ascending', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e3', createdAt: '2026-03-01T00:00:00Z' }),
        makeEntry({ id: 'e1', createdAt: '2026-01-01T00:00:00Z' }),
        makeEntry({ id: 'e2', createdAt: '2026-02-01T00:00:00Z' }),
      ]);

      const results = await adapter.getLedgerEntries({});
      expect(results[0].id).toBe('e1');
      expect(results[1].id).toBe('e2');
      expect(results[2].id).toBe('e3');
    });
  });

  describe('tenant isolation', () => {
    it('should not return entries from other tenants', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'a1', tenantId: 'tenant_a', amount: 100 }),
        makeEntry({ id: 'a2', tenantId: 'tenant_a', amount: 200 }),
        makeEntry({ id: 'b1', tenantId: 'tenant_b', amount: 300 }),
        makeEntry({ id: 'b2', tenantId: 'tenant_b', amount: 400 }),
      ]);

      const tenantAEntries = await adapter.getLedgerEntries({ tenantId: 'tenant_a' });
      expect(tenantAEntries).toHaveLength(2);
      expect(tenantAEntries.every(e => e.tenantId === 'tenant_a')).toBe(true);

      const tenantBEntries = await adapter.getLedgerEntries({ tenantId: 'tenant_b' });
      expect(tenantBEntries).toHaveLength(2);
      expect(tenantBEntries.every(e => e.tenantId === 'tenant_b')).toBe(true);
    });

    it('should count entries per tenant correctly', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ tenantId: 'tenant_a' }),
        makeEntry({ tenantId: 'tenant_a' }),
        makeEntry({ tenantId: 'tenant_b' }),
      ]);

      expect(await adapter.countLedgerEntries({ tenantId: 'tenant_a' })).toBe(2);
      expect(await adapter.countLedgerEntries({ tenantId: 'tenant_b' })).toBe(1);
    });
  });

  describe('deleteLedgerEntries', () => {
    it('should delete matching entries and return count', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e1', tenantId: 'tenant_a' }),
        makeEntry({ id: 'e2', tenantId: 'tenant_a' }),
        makeEntry({ id: 'e3', tenantId: 'tenant_b' }),
      ]);

      const deleted = await adapter.deleteLedgerEntries({ tenantId: 'tenant_a' });
      expect(deleted).toBe(2);

      const remaining = await adapter.getLedgerEntries({});
      expect(remaining).toHaveLength(1);
      expect(remaining[0].tenantId).toBe('tenant_b');
    });

    it('should return 0 when no entries match', async () => {
      await adapter.saveLedgerEntry(makeEntry({ tenantId: 'tenant_a' }));
      const deleted = await adapter.deleteLedgerEntries({ tenantId: 'nonexistent' });
      expect(deleted).toBe(0);
    });
  });

  describe('countLedgerEntries', () => {
    it('should count all entries with empty query', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({}),
        makeEntry({}),
        makeEntry({}),
      ]);

      expect(await adapter.countLedgerEntries({})).toBe(3);
    });

    it('should count entries matching query', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ entryType: 'debit' }),
        makeEntry({ entryType: 'credit' }),
        makeEntry({ entryType: 'debit' }),
      ]);

      expect(await adapter.countLedgerEntries({ entryType: 'debit' })).toBe(2);
    });
  });

  describe('getDistinctAccountIds', () => {
    it('should return all unique account IDs', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ accountId: 'acct_a' }),
        makeEntry({ accountId: 'acct_b' }),
        makeEntry({ accountId: 'acct_a' }),
        makeEntry({ accountId: 'acct_c' }),
      ]);

      const ids = await adapter.getDistinctAccountIds();
      expect(ids).toContain('acct_a');
      expect(ids).toContain('acct_b');
      expect(ids).toContain('acct_c');
      expect(ids).toHaveLength(3);
    });

    it('should filter by tenant when tenantId provided', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ tenantId: 'tenant_a', accountId: 'acct_1' }),
        makeEntry({ tenantId: 'tenant_a', accountId: 'acct_2' }),
        makeEntry({ tenantId: 'tenant_b', accountId: 'acct_3' }),
      ]);

      const idsA = await adapter.getDistinctAccountIds('tenant_a');
      expect(idsA).toContain('acct_1');
      expect(idsA).toContain('acct_2');
      expect(idsA).not.toContain('acct_3');

      const idsB = await adapter.getDistinctAccountIds('tenant_b');
      expect(idsB).toEqual(['acct_3']);
    });

    it('should return empty array for unknown tenant', async () => {
      await adapter.saveLedgerEntry(makeEntry({ tenantId: 'tenant_a' }));
      const ids = await adapter.getDistinctAccountIds('nonexistent');
      expect(ids).toEqual([]);
    });
  });

  describe('maxEntries eviction', () => {
    it('should evict oldest entries when maxEntries is exceeded', async () => {
      const limitedAdapter = new MemoryAdapter({ maxEntries: 3 });
      await limitedAdapter.init();

      await limitedAdapter.saveLedgerEntries([
        makeEntry({ id: 'e1', createdAt: '2026-01-01T00:00:00Z' }),
        makeEntry({ id: 'e2', createdAt: '2026-01-02T00:00:00Z' }),
        makeEntry({ id: 'e3', createdAt: '2026-01-03T00:00:00Z' }),
      ]);

      // Adding a 4th entry should evict the oldest (e1)
      await limitedAdapter.saveLedgerEntry(
        makeEntry({ id: 'e4', createdAt: '2026-01-04T00:00:00Z' })
      );

      const results = await limitedAdapter.getLedgerEntries({});
      expect(results).toHaveLength(3);
      const ids = results.map(e => e.id);
      expect(ids).not.toContain('e1');
      expect(ids).toContain('e4');

      await limitedAdapter.close();
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ tenantId: 'tenant_a', accountId: 'acct_1' }),
        makeEntry({ tenantId: 'tenant_a', accountId: 'acct_2' }),
        makeEntry({ tenantId: 'tenant_b', accountId: 'acct_3' }),
      ]);

      const stats = adapter.getStats();
      expect(stats.entryCount).toBe(3);
      expect(stats.tenantCount).toBe(2);
      expect(stats.accountCount).toBe(3);
      expect(stats.memoryEstimate).toBeGreaterThan(0);
    });
  });
});
