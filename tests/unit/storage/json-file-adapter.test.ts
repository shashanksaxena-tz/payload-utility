import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { JsonFileAdapter } from '../../../src/storage/json-file-adapter';
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

describe('JsonFileAdapter', () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-adapter-test-'));
    filePath = path.join(tmpDir, 'ledger.json');
  });

  afterEach(() => {
    // Clean up temp files
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (fs.existsSync(filePath + '.lock')) fs.unlinkSync(filePath + '.lock');
      if (fs.existsSync(filePath + '.tmp')) fs.unlinkSync(filePath + '.tmp');
      fs.rmdirSync(tmpDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('init', () => {
    it('should create file if it does not exist', async () => {
      const adapter = new JsonFileAdapter({ filePath, autoSave: false });
      await adapter.init();

      expect(fs.existsSync(filePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.version).toBe(1);
      expect(content.entries).toEqual([]);

      await adapter.close();
    });

    it('should load existing entries from file', async () => {
      // Pre-populate the file
      const data = {
        version: 1,
        entries: [makeEntry({ id: 'existing_1' })],
      };
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');

      const adapter = new JsonFileAdapter({ filePath, autoSave: false });
      await adapter.init();

      const results = await adapter.getLedgerEntries({});
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('existing_1');

      await adapter.close();
    });

    it('should create parent directory if it does not exist', async () => {
      const nestedPath = path.join(tmpDir, 'subdir', 'deep', 'ledger.json');
      const adapter = new JsonFileAdapter({ filePath: nestedPath, autoSave: false });
      await adapter.init();

      expect(fs.existsSync(nestedPath)).toBe(true);

      await adapter.close();
      // Cleanup nested files
      fs.unlinkSync(nestedPath);
      fs.rmdirSync(path.join(tmpDir, 'subdir', 'deep'));
      fs.rmdirSync(path.join(tmpDir, 'subdir'));
    });
  });

  describe('persistence across close/reopen', () => {
    it('should persist entries after close and reload on init', async () => {
      const adapter1 = new JsonFileAdapter({ filePath, autoSave: false });
      await adapter1.init();

      await adapter1.saveLedgerEntry(makeEntry({ id: 'persist_1', amount: 500 }));
      await adapter1.saveLedgerEntry(makeEntry({ id: 'persist_2', amount: 250 }));
      await adapter1.close();

      // Reopen
      const adapter2 = new JsonFileAdapter({ filePath, autoSave: false });
      await adapter2.init();

      const results = await adapter2.getLedgerEntries({});
      expect(results).toHaveLength(2);
      expect(results.map(e => e.id).sort()).toEqual(['persist_1', 'persist_2']);

      await adapter2.close();
    });
  });

  describe('CRUD operations', () => {
    let adapter: JsonFileAdapter;

    beforeEach(async () => {
      adapter = new JsonFileAdapter({ filePath, autoSave: false });
      await adapter.init();
    });

    afterEach(async () => {
      await adapter.close();
    });

    it('should save and retrieve a single entry', async () => {
      const entry = makeEntry({ id: 'crud_1', amount: 42 });
      await adapter.saveLedgerEntry(entry);

      const results = await adapter.getLedgerEntries({});
      expect(results).toHaveLength(1);
      expect(results[0].amount).toBe(42);
    });

    it('should save and retrieve batch entries', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'b1' }),
        makeEntry({ id: 'b2' }),
        makeEntry({ id: 'b3' }),
      ]);

      const count = await adapter.countLedgerEntries({});
      expect(count).toBe(3);
    });

    it('should delete matching entries', async () => {
      await adapter.saveLedgerEntries([
        makeEntry({ id: 'del1', tenantId: 'tenant_a' }),
        makeEntry({ id: 'del2', tenantId: 'tenant_a' }),
        makeEntry({ id: 'keep1', tenantId: 'tenant_b' }),
      ]);

      const deleted = await adapter.deleteLedgerEntries({ tenantId: 'tenant_a' });
      expect(deleted).toBe(2);

      const remaining = await adapter.getLedgerEntries({});
      expect(remaining).toHaveLength(1);
      expect(remaining[0].tenantId).toBe('tenant_b');
    });
  });

  describe('query filtering', () => {
    let adapter: JsonFileAdapter;

    beforeEach(async () => {
      adapter = new JsonFileAdapter({ filePath, autoSave: false });
      await adapter.init();

      await adapter.saveLedgerEntries([
        makeEntry({ id: 'e1', tenantId: 'tenant_a', accountId: 'acct_rev', entryType: 'debit', createdAt: '2026-01-01T00:00:00Z' }),
        makeEntry({ id: 'e2', tenantId: 'tenant_a', accountId: 'acct_exp', entryType: 'credit', createdAt: '2026-02-01T00:00:00Z' }),
        makeEntry({ id: 'e3', tenantId: 'tenant_b', accountId: 'acct_rev', entryType: 'debit', createdAt: '2026-03-01T00:00:00Z' }),
        makeEntry({ id: 'e4', tenantId: 'tenant_b', accountId: 'acct_exp', entryType: 'credit', createdAt: '2026-04-01T00:00:00Z', transactionId: 'txn_1' }),
      ]);
    });

    afterEach(async () => {
      await adapter.close();
    });

    it('should filter by tenantId', async () => {
      const results = await adapter.getLedgerEntries({ tenantId: 'tenant_a' });
      expect(results).toHaveLength(2);
    });

    it('should filter by accountId', async () => {
      const results = await adapter.getLedgerEntries({ accountId: 'acct_rev' });
      expect(results).toHaveLength(2);
    });

    it('should filter by entryType', async () => {
      const results = await adapter.getLedgerEntries({ entryType: 'credit' });
      expect(results).toHaveLength(2);
    });

    it('should filter by transactionId', async () => {
      const results = await adapter.getLedgerEntries({ transactionId: 'txn_1' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('e4');
    });

    it('should filter by fromDate', async () => {
      const results = await adapter.getLedgerEntries({ fromDate: '2026-02-15T00:00:00Z' });
      expect(results).toHaveLength(2);
    });

    it('should filter by toDate', async () => {
      const results = await adapter.getLedgerEntries({ toDate: '2026-02-15T00:00:00Z' });
      expect(results).toHaveLength(2);
    });

    it('should apply limit and offset', async () => {
      const results = await adapter.getLedgerEntries({ limit: 2, offset: 1 });
      expect(results).toHaveLength(2);
    });

    it('should sort by createdAt ascending', async () => {
      const results = await adapter.getLedgerEntries({});
      expect(results[0].id).toBe('e1');
      expect(results[3].id).toBe('e4');
    });
  });

  describe('getDistinctAccountIds', () => {
    it('should return distinct account IDs', async () => {
      const adapter = new JsonFileAdapter({ filePath, autoSave: false });
      await adapter.init();

      await adapter.saveLedgerEntries([
        makeEntry({ accountId: 'acct_1' }),
        makeEntry({ accountId: 'acct_2' }),
        makeEntry({ accountId: 'acct_1' }),
      ]);

      const ids = await adapter.getDistinctAccountIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain('acct_1');
      expect(ids).toContain('acct_2');

      await adapter.close();
    });

    it('should filter by tenantId', async () => {
      const adapter = new JsonFileAdapter({ filePath, autoSave: false });
      await adapter.init();

      await adapter.saveLedgerEntries([
        makeEntry({ tenantId: 'tenant_a', accountId: 'acct_1' }),
        makeEntry({ tenantId: 'tenant_a', accountId: 'acct_2' }),
        makeEntry({ tenantId: 'tenant_b', accountId: 'acct_3' }),
      ]);

      const ids = await adapter.getDistinctAccountIds('tenant_a');
      expect(ids).toHaveLength(2);
      expect(ids).toContain('acct_1');
      expect(ids).toContain('acct_2');
      expect(ids).not.toContain('acct_3');

      await adapter.close();
    });
  });

  describe('error handling', () => {
    it('should throw when operations called before init', async () => {
      const adapter = new JsonFileAdapter({ filePath, autoSave: false });

      await expect(adapter.getLedgerEntries({})).rejects.toThrow('not been initialized');
      await expect(adapter.saveLedgerEntry(makeEntry())).rejects.toThrow('not been initialized');
      await expect(adapter.countLedgerEntries({})).rejects.toThrow('not been initialized');
    });
  });
});
