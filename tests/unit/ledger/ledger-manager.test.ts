import { LedgerManager } from '../../../src/ledger/ledger-manager';
import { Session } from '../../../src/core/session';
import { Ledger } from '../../../src/spec02/ledger';
import { clearObjectCache } from '../../../src/core/model';

// Mock the Session's Ledger operations
function createMockSession(): Session & { _ledgerStore: Array<Record<string, unknown>> } {
  const ledgerStore: Array<Record<string, unknown>> = [];
  let idCounter = 0;

  const mockSession = {
    _ledgerStore: ledgerStore,
    Ledger: {
      create: jest.fn(async (data: Record<string, unknown>) => {
        const entry = {
          ...data,
          id: `ledger_${++idCounter}`,
          created_at: new Date().toISOString(),
        };
        ledgerStore.push(entry);
        return new Ledger(entry);
      }),
      filterBy: jest.fn((...filters: any[]) => ({
        all: jest.fn(async () => {
          let results = [...ledgerStore];
          for (const filter of filters) {
            if (typeof filter === 'object' && !('key' in filter)) {
              for (const [key, value] of Object.entries(filter)) {
                results = results.filter(item => item[key] === value);
              }
            }
          }
          return results.map(entry => new Ledger(entry));
        }),
      })),
    },
  } as unknown as Session & { _ledgerStore: Array<Record<string, unknown>> };

  return mockSession;
}

beforeEach(() => {
  clearObjectCache();
});

describe('LedgerManager', () => {
  let session: ReturnType<typeof createMockSession>;
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
      expect(session.Ledger.create).toHaveBeenCalledTimes(2);
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
      expect(session.Ledger.create).toHaveBeenCalledTimes(3);
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
      // Create some entries
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
});
