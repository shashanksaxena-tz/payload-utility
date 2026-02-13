import { LedgerManager } from '../../../src/ledger/ledger-manager';
import { Session } from '../../../src/core/session';
import { Ledger } from '../../../src/spec02/ledger';
import { clearObjectCache } from '../../../src/core/model';

// Create a minimal mock session (LedgerManager no longer calls session.Ledger)
function createMockSession(): Session {
  return {} as unknown as Session;
}

beforeEach(() => {
  clearObjectCache();
});

describe('LedgerManager', () => {
  let session: Session;
  let manager: LedgerManager;

  beforeEach(() => {
    session = createMockSession();
    manager = new LedgerManager(session);
  });

  describe('createBalancedEntry', () => {
    it('should create matching debit and credit entries', async () => {
      const result = await manager.createBalancedEntry({
        debit: {
          accountId: 'acct_1',
          amount: 100,
          entryType: 'debit',
          description: 'Revenue received',
        },
        credit: {
          accountId: 'acct_2',
          amount: 100,
          entryType: 'credit',
          description: 'Accounts receivable',
        },
      });

      expect(result.debit).toBeInstanceOf(Ledger);
      expect(result.credit).toBeInstanceOf(Ledger);
      expect(result.debit.amount).toBe(100);
      expect(result.credit.amount).toBe(100);
      expect(result.debit.entryType).toBe('debit');
      expect(result.credit.entryType).toBe('credit');
    });

    it('should reject imbalanced entries', async () => {
      await expect(
        manager.createBalancedEntry({
          debit: { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'test' },
          credit: { accountId: 'acct_2', amount: 50, entryType: 'credit', description: 'test' },
        })
      ).rejects.toThrow('Ledger imbalance');
    });

    it('should reject negative amounts', async () => {
      await expect(
        manager.createBalancedEntry({
          debit: { accountId: 'acct_1', amount: -100, entryType: 'debit', description: 'test' },
          credit: { accountId: 'acct_2', amount: -100, entryType: 'credit', description: 'test' },
        })
      ).rejects.toThrow('amounts must be positive');
    });

    it('should reject same account for debit and credit', async () => {
      await expect(
        manager.createBalancedEntry({
          debit: { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'test' },
          credit: { accountId: 'acct_1', amount: 100, entryType: 'credit', description: 'test' },
        })
      ).rejects.toThrow('must be different');
    });
  });

  describe('createMultiLegEntry', () => {
    it('should create multiple balanced entries', async () => {
      const entries = await manager.createMultiLegEntry([
        { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'Debit 1' },
        { accountId: 'acct_2', amount: 60, entryType: 'credit', description: 'Credit 1' },
        { accountId: 'acct_3', amount: 40, entryType: 'credit', description: 'Credit 2' },
      ]);

      expect(entries).toHaveLength(3);
      expect(entries[0]).toBeInstanceOf(Ledger);
    });

    it('should reject imbalanced multi-leg entries', async () => {
      await expect(
        manager.createMultiLegEntry([
          { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'Debit' },
          { accountId: 'acct_2', amount: 50, entryType: 'credit', description: 'Credit' },
        ])
      ).rejects.toThrow('Multi-leg imbalance');
    });

    it('should reject fewer than 2 entries', async () => {
      await expect(
        manager.createMultiLegEntry([
          { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'Single' },
        ])
      ).rejects.toThrow('at least 2 entries');
    });
  });

  describe('getAccountBalance', () => {
    it('should compute correct balance from entries', async () => {
      await manager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'D1' },
        credit: { accountId: 'acct_2', amount: 100, entryType: 'credit', description: 'C1' },
      });
      await manager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 50, entryType: 'debit', description: 'D2' },
        credit: { accountId: 'acct_2', amount: 50, entryType: 'credit', description: 'C2' },
      });

      const balance = await manager.getAccountBalance('acct_1');
      expect(balance.accountId).toBe('acct_1');
      expect(balance.totalDebits).toBe(150);
      expect(balance.totalCredits).toBe(0);
      expect(balance.netBalance).toBe(150);
      expect(balance.entryCount).toBe(2);
    });
  });

  describe('reconcile', () => {
    it('should report balanced system', async () => {
      await manager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'D' },
        credit: { accountId: 'acct_2', amount: 100, entryType: 'credit', description: 'C' },
      });

      const result = await manager.reconcile(['acct_1', 'acct_2']);
      expect(result.balanced).toBe(true);
      expect(result.totalDebits).toBe(100);
      expect(result.totalCredits).toBe(100);
      expect(result.difference).toBeLessThan(0.001);
    });
  });

  describe('createReversalEntry', () => {
    it('should create reversed entries', async () => {
      const result = await manager.createReversalEntry('acct_1', 'acct_2', 100, 'Error correction');

      expect(result.debit).toBeInstanceOf(Ledger);
      expect(result.credit).toBeInstanceOf(Ledger);
      // Reversal: original credit account gets debited
      expect(result.debit.getStr('account_id')).toBe('acct_2');
      // Reversal: original debit account gets credited
      expect(result.credit.getStr('account_id')).toBe('acct_1');
    });

    it('should pass metadata through on reversals', async () => {
      const meta = { ticket: 'SUP-1234', reason_code: 'customer_request' };
      const result = await manager.createReversalEntry('acct_1', 'acct_2', 50, 'Refund', meta);

      expect(result.debit.metadata).toEqual(meta);
      expect(result.credit.metadata).toEqual(meta);
    });
  });

  describe('metadata support', () => {
    it('should store metadata on balanced entries', async () => {
      const meta = { project: 'alpha', cost_center: 'eng' };
      const result = await manager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 200, entryType: 'debit', description: 'D', metadata: meta },
        credit: { accountId: 'acct_2', amount: 200, entryType: 'credit', description: 'C', metadata: meta },
      });

      expect(result.debit.metadata).toEqual(meta);
      expect(result.credit.metadata).toEqual(meta);
    });

    it('should store metadata on multi-leg entries', async () => {
      const meta = { batch: 'weekly-payout-42' };
      const entries = await manager.createMultiLegEntry([
        { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'D', metadata: meta },
        { accountId: 'acct_2', amount: 60, entryType: 'credit', description: 'C1', metadata: meta },
        { accountId: 'acct_3', amount: 40, entryType: 'credit', description: 'C2', metadata: meta },
      ]);

      entries.forEach(e => expect(e.metadata).toEqual(meta));
    });

    it('should allow entries without metadata (backward compatible)', async () => {
      const result = await manager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 50, entryType: 'debit', description: 'D' },
        credit: { accountId: 'acct_2', amount: 50, entryType: 'credit', description: 'C' },
      });

      expect(result.debit.metadata).toBeNull();
      expect(result.credit.metadata).toBeNull();
    });

    it('should include metadata in activity summary', async () => {
      const meta = { department: 'sales' };
      await manager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 75, entryType: 'debit', description: 'Sale', metadata: meta },
        credit: { accountId: 'acct_2', amount: 75, entryType: 'credit', description: 'Receivable', metadata: meta },
      });

      const activity = await manager.getActivitySummary('acct_1');
      expect(activity.debits[0].metadata).toEqual(meta);
    });
  });

  describe('getDailyBalances', () => {
    it('should aggregate entries by day with running balance', async () => {
      // Manually add entries with specific dates using createTransactionEntry-like approach
      // We use the internal method through the public API by creating entries that have specific timestamps
      // Since createLocalEntry uses current time, we need to use importEntries
      const data = JSON.stringify([
        { account_id: 'acct_1', amount: 100, entry_type: 'debit', description: 'D1', created_at: '2026-01-15T10:00:00Z' },
        { account_id: 'acct_1', amount: 50, entry_type: 'debit', description: 'D2', created_at: '2026-01-15T14:00:00Z' },
        { account_id: 'acct_1', amount: 30, entry_type: 'credit', description: 'C1', created_at: '2026-01-16T09:00:00Z' },
        { account_id: 'acct_1', amount: 200, entry_type: 'debit', description: 'D3', created_at: '2026-01-17T12:00:00Z' },
      ]);
      manager.importEntries(data);

      const days = await manager.getDailyBalances('acct_1', '2026-01-15', '2026-01-17T23:59:59Z');
      expect(days).toHaveLength(3);
      // Day 1: 100+50 debits = 150, 0 credits, running = 150
      expect(days[0].date).toBe('2026-01-15');
      expect(days[0].debits).toBe(150);
      expect(days[0].credits).toBe(0);
      expect(days[0].runningBalance).toBe(150);
      expect(days[0].entryCount).toBe(2);
      // Day 2: 0 debits, 30 credits, running = 150 - 30 = 120
      expect(days[1].date).toBe('2026-01-16');
      expect(days[1].credits).toBe(30);
      expect(days[1].runningBalance).toBe(120);
      // Day 3: 200 debits, running = 120 + 200 = 320
      expect(days[2].date).toBe('2026-01-17');
      expect(days[2].debits).toBe(200);
      expect(days[2].runningBalance).toBe(320);
    });

    it('should return empty array for no entries', async () => {
      const days = await manager.getDailyBalances('acct_nonexistent', '2026-01-01', '2026-12-31');
      expect(days).toHaveLength(0);
    });
  });

  describe('getMonthlyBalances', () => {
    it('should aggregate entries by month with running balance', async () => {
      const data = JSON.stringify([
        { account_id: 'acct_1', amount: 500, entry_type: 'debit', description: 'Jan sale', created_at: '2026-01-15T10:00:00Z' },
        { account_id: 'acct_1', amount: 100, entry_type: 'credit', description: 'Jan refund', created_at: '2026-01-20T10:00:00Z' },
        { account_id: 'acct_1', amount: 700, entry_type: 'debit', description: 'Feb sale', created_at: '2026-02-10T10:00:00Z' },
        { account_id: 'acct_1', amount: 300, entry_type: 'debit', description: 'Mar sale', created_at: '2026-03-05T10:00:00Z' },
      ]);
      manager.importEntries(data);

      const months = await manager.getMonthlyBalances('acct_1', '2026-01-01', '2026-03-31T23:59:59Z');
      expect(months).toHaveLength(3);
      // Jan: 500 debit, 100 credit, net=400, running=400
      expect(months[0].month).toBe('2026-01');
      expect(months[0].debits).toBe(500);
      expect(months[0].credits).toBe(100);
      expect(months[0].net).toBe(400);
      expect(months[0].runningBalance).toBe(400);
      // Feb: 700 debit, 0 credit, net=700, running=1100
      expect(months[1].month).toBe('2026-02');
      expect(months[1].runningBalance).toBe(1100);
      // Mar: 300 debit, net=300, running=1400
      expect(months[2].month).toBe('2026-03');
      expect(months[2].runningBalance).toBe(1400);
    });
  });

  describe('getAccountStatement', () => {
    it('should compute opening/closing balance and per-entry running balance', async () => {
      const data = JSON.stringify([
        // Pre-range entry (counts toward opening balance)
        { account_id: 'acct_1', amount: 200, entry_type: 'debit', description: 'Prior', created_at: '2025-12-15T10:00:00Z', reference: '' },
        // In-range entries
        { account_id: 'acct_1', amount: 100, entry_type: 'debit', description: 'Sale', created_at: '2026-01-10T10:00:00Z', reference: 'ref1' },
        { account_id: 'acct_1', amount: 50, entry_type: 'credit', description: 'Refund', created_at: '2026-01-15T10:00:00Z', reference: 'ref2' },
        { account_id: 'acct_1', amount: 75, entry_type: 'debit', description: 'Fee', created_at: '2026-01-20T10:00:00Z', reference: '' },
      ]);
      manager.importEntries(data);

      const stmt = await manager.getAccountStatement('acct_1', '2026-01-01', '2026-01-31T23:59:59Z');
      expect(stmt.accountId).toBe('acct_1');
      expect(stmt.openingBalance).toBe(200); // Pre-range debit
      expect(stmt.totalDebits).toBe(175); // 100 + 75
      expect(stmt.totalCredits).toBe(50);
      expect(stmt.closingBalance).toBe(325); // 200 + 175 - 50
      expect(stmt.entries).toHaveLength(3);
      // Entry 1: running = 200 + 100 = 300
      expect(stmt.entries[0].runningBalance).toBe(300);
      expect(stmt.entries[0].entryType).toBe('debit');
      // Entry 2: running = 300 - 50 = 250
      expect(stmt.entries[1].runningBalance).toBe(250);
      expect(stmt.entries[1].entryType).toBe('credit');
      // Entry 3: running = 250 + 75 = 325
      expect(stmt.entries[2].runningBalance).toBe(325);
    });

    it('should return zero opening balance when no prior entries', async () => {
      const data = JSON.stringify([
        { account_id: 'acct_1', amount: 100, entry_type: 'debit', description: 'D', created_at: '2026-01-10T10:00:00Z', reference: '' },
      ]);
      manager.importEntries(data);

      const stmt = await manager.getAccountStatement('acct_1', '2026-01-01', '2026-01-31T23:59:59Z');
      expect(stmt.openingBalance).toBe(0);
      expect(stmt.closingBalance).toBe(100);
    });
  });

  describe('getTrialBalance', () => {
    it('should compute trial balance across accounts', async () => {
      // acct_1: 300 debits, 0 credits -> debit balance of 300
      // acct_2: 0 debits, 300 credits -> credit balance of 300
      await manager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 200, entryType: 'debit', description: 'D1' },
        credit: { accountId: 'acct_2', amount: 200, entryType: 'credit', description: 'C1' },
      });
      await manager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'D2' },
        credit: { accountId: 'acct_2', amount: 100, entryType: 'credit', description: 'C2' },
      });

      const tb = await manager.getTrialBalance(['acct_1', 'acct_2']);
      expect(tb.balanced).toBe(true);
      expect(tb.totalDebits).toBe(300);
      expect(tb.totalCredits).toBe(300);
      expect(tb.rows).toHaveLength(2);
      expect(tb.rows[0].accountId).toBe('acct_1');
      expect(tb.rows[0].debitBalance).toBe(300);
      expect(tb.rows[0].creditBalance).toBe(0);
      expect(tb.rows[1].accountId).toBe('acct_2');
      expect(tb.rows[1].debitBalance).toBe(0);
      expect(tb.rows[1].creditBalance).toBe(300);
    });

    it('should report balanced as false when imbalanced', async () => {
      // Manually import a single debit entry (no matching credit)
      manager.importEntries(JSON.stringify([
        { account_id: 'acct_1', amount: 100, entry_type: 'debit', description: 'D', created_at: '2026-01-10T10:00:00Z' },
      ]));

      const tb = await manager.getTrialBalance(['acct_1']);
      expect(tb.balanced).toBe(false);
      expect(tb.totalDebits).toBe(100);
      expect(tb.totalCredits).toBe(0);
    });
  });

  describe('exportEntries', () => {
    it('should export entries as JSON', async () => {
      await manager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'D' },
        credit: { accountId: 'acct_2', amount: 100, entryType: 'credit', description: 'C' },
      });

      const result = await manager.exportEntries('acct_1');
      expect(result.format).toBe('json');
      expect(result.count).toBe(1);
      const parsed = JSON.parse(result.data);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].account_id).toBe('acct_1');
      expect(parsed[0].amount).toBe(100);
    });

    it('should export entries as CSV', async () => {
      await manager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 250, entryType: 'debit', description: 'Revenue' },
        credit: { accountId: 'acct_2', amount: 250, entryType: 'credit', description: 'AR' },
      });

      const result = await manager.exportEntries('acct_1', undefined, undefined, 'csv');
      expect(result.format).toBe('csv');
      expect(result.count).toBe(1);
      const lines = result.data.split('\n');
      expect(lines[0]).toContain('id,account_id,entry_type,amount');
      expect(lines[1]).toContain('acct_1');
      expect(lines[1]).toContain('debit');
      expect(lines[1]).toContain('250');
    });

    it('should export empty dataset', async () => {
      const result = await manager.exportEntries('acct_nonexistent');
      expect(result.count).toBe(0);
      expect(result.format).toBe('json');
      expect(JSON.parse(result.data)).toEqual([]);
    });
  });

  describe('transaction linking', () => {
    it('should link entries to a Payload transaction ID', async () => {
      const result = await manager.createTransactionEntry('txn_abc123', {
        debit: { accountId: 'acct_1', amount: 500, entryType: 'debit', description: 'Payment received' },
        credit: { accountId: 'acct_2', amount: 500, entryType: 'credit', description: 'Revenue recorded' },
      });

      expect(result.debit.transactionId).toBe('txn_abc123');
      expect(result.credit.transactionId).toBe('txn_abc123');

      const txEntries = await manager.getTransactionEntries('txn_abc123');
      expect(txEntries).toHaveLength(2);
    });
  });

  describe('clear and import', () => {
    it('should clear all entries', async () => {
      await manager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'D' },
        credit: { accountId: 'acct_2', amount: 100, entryType: 'credit', description: 'C' },
      });

      expect(manager.getAllEntries()).toHaveLength(2);
      manager.clear();
      expect(manager.getAllEntries()).toHaveLength(0);
    });

    it('should import entries from JSON', async () => {
      const data = JSON.stringify([
        { account_id: 'acct_1', amount: 100, entry_type: 'debit', description: 'D', created_at: '2026-01-01T00:00:00Z' },
        { account_id: 'acct_2', amount: 100, entry_type: 'credit', description: 'C', created_at: '2026-01-01T00:00:00Z' },
      ]);

      const count = manager.importEntries(data);
      expect(count).toBe(2);
      expect(manager.getAllEntries()).toHaveLength(2);
    });

    it('should return all account IDs', async () => {
      await manager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'D' },
        credit: { accountId: 'acct_2', amount: 100, entryType: 'credit', description: 'C' },
      });
      await manager.createBalancedEntry({
        debit: { accountId: 'acct_3', amount: 50, entryType: 'debit', description: 'D' },
        credit: { accountId: 'acct_1', amount: 50, entryType: 'credit', description: 'C' },
      });

      const ids = manager.getAccountIds();
      expect(ids).toContain('acct_1');
      expect(ids).toContain('acct_2');
      expect(ids).toContain('acct_3');
      expect(ids).toHaveLength(3);
    });
  });
});
