import { TenantReportGenerator } from '../../../src/ledger/tenant-reports';
import { Ledger } from '../../../src/spec02/ledger';

function makeLedger(data: Record<string, unknown>): Ledger {
  return new Ledger({
    id: `ledger_${Math.random().toString(36).slice(2, 8)}`,
    account_id: 'acct_default',
    amount: 100,
    entry_type: 'debit',
    description: 'Test',
    reference: '',
    created_at: '2026-01-15T12:00:00Z',
    metadata: null,
    ...data,
  });
}

function makeEntries(): Ledger[] {
  return [
    // Tenant A entries
    makeLedger({ account_id: 'acct_revenue', amount: 500, entry_type: 'credit', created_at: '2026-01-10T00:00:00Z', metadata: { tenantId: 'tenant_a' } }),
    makeLedger({ account_id: 'acct_expenses', amount: 200, entry_type: 'debit', created_at: '2026-01-15T00:00:00Z', metadata: { tenantId: 'tenant_a' } }),
    makeLedger({ account_id: 'acct_revenue', amount: 300, entry_type: 'credit', created_at: '2026-02-01T00:00:00Z', metadata: { tenantId: 'tenant_a' } }),
    makeLedger({ account_id: 'acct_expenses', amount: 100, entry_type: 'debit', created_at: '2026-02-15T00:00:00Z', metadata: { tenantId: 'tenant_a' } }),
    makeLedger({ account_id: 'acct_fees', amount: 50, entry_type: 'debit', created_at: '2026-03-01T00:00:00Z', metadata: { tenantId: 'tenant_a' } }),
    // Tenant B entries
    makeLedger({ account_id: 'acct_revenue', amount: 1000, entry_type: 'credit', created_at: '2026-01-10T00:00:00Z', metadata: { tenantId: 'tenant_b' } }),
    makeLedger({ account_id: 'acct_expenses', amount: 400, entry_type: 'debit', created_at: '2026-01-20T00:00:00Z', metadata: { tenantId: 'tenant_b' } }),
  ];
}

describe('TenantReportGenerator', () => {
  let generator: TenantReportGenerator;
  let entries: Ledger[];

  beforeEach(() => {
    entries = makeEntries();
    generator = new TenantReportGenerator(entries);
  });

  describe('constructor', () => {
    it('should accept an array of entries', () => {
      expect(() => new TenantReportGenerator(entries)).not.toThrow();
    });

    it('should accept a query function', () => {
      const fn = (tenantId: string) => entries.filter(e => e.metadata?.tenantId === tenantId);
      expect(() => new TenantReportGenerator(fn)).not.toThrow();
    });
  });

  describe('getProfitAndLoss', () => {
    it('should compute P&L with revenue and expense accounts', () => {
      const report = generator.getProfitAndLoss('tenant_a', '2026-01-01', '2026-12-31');

      expect(report.tenantId).toBe('tenant_a');
      expect(report.totalRevenue).toBe(800); // 500 + 300
      expect(report.totalExpenses).toBe(350); // 200 + 100 + 50
      expect(report.netIncome).toBe(450); // 800 - 350
    });

    it('should separate revenue (credits) and expenses (debits) by account', () => {
      const report = generator.getProfitAndLoss('tenant_a', '2026-01-01', '2026-12-31');

      expect(report.revenue).toHaveLength(1);
      expect(report.revenue[0].accountId).toBe('acct_revenue');
      expect(report.revenue[0].total).toBe(800);

      expect(report.expenses).toHaveLength(2); // acct_expenses and acct_fees
    });

    it('should filter by date range', () => {
      const report = generator.getProfitAndLoss('tenant_a', '2026-01-01', '2026-01-31');

      expect(report.totalRevenue).toBe(500);
      expect(report.totalExpenses).toBe(200);
    });

    it('should return empty report for non-existent tenant', () => {
      const report = generator.getProfitAndLoss('nonexistent', '2026-01-01', '2026-12-31');
      expect(report.totalRevenue).toBe(0);
      expect(report.totalExpenses).toBe(0);
      expect(report.netIncome).toBe(0);
    });
  });

  describe('getAgingReport', () => {
    it('should place entries into correct aging buckets', () => {
      // Use a date after the latest entry to include all entries
      const report = generator.getAgingReport('tenant_a', '2026-03-02');

      expect(report.tenantId).toBe('tenant_a');
      expect(report.buckets).toHaveLength(5);

      // All 5 tenant_a entries should be distributed across buckets
      const totalEntriesInBuckets = report.buckets.reduce((s, b) => s + b.entryCount, 0);
      expect(totalEntriesInBuckets).toBe(5);

      // The entry created on 2026-01-10 is about 51 days old (31-60 bucket)
      const bucket31to60 = report.buckets.find(b => b.label === '31-60 days');
      expect(bucket31to60!.entryCount).toBeGreaterThanOrEqual(1);
    });

    it('should report totalOutstanding', () => {
      const report = generator.getAgingReport('tenant_a', '2026-03-01');
      expect(report.totalOutstanding).toBeGreaterThan(0);
    });

    it('should include per-account breakdowns', () => {
      const report = generator.getAgingReport('tenant_a', '2026-03-01');
      expect(report.accountBreakdowns.length).toBeGreaterThan(0);

      const revBreakdown = report.accountBreakdowns.find(a => a.accountId === 'acct_revenue');
      expect(revBreakdown).toBeDefined();
      expect(revBreakdown!.total).toBeGreaterThan(0);
    });
  });

  describe('getCashFlowSummary', () => {
    it('should compute inflows (credits) and outflows (debits)', () => {
      const report = generator.getCashFlowSummary('tenant_a', '2026-01-01', '2026-03-31');

      expect(report.inflows).toBe(800); // credits
      expect(report.outflows).toBe(350); // debits
      expect(report.netCashFlow).toBe(450);
    });

    it('should include inflow and outflow entry details', () => {
      const report = generator.getCashFlowSummary('tenant_a', '2026-01-01', '2026-03-31');
      expect(report.inflowEntries.length).toBeGreaterThan(0);
      expect(report.outflowEntries.length).toBeGreaterThan(0);
    });

    it('should include period comparison', () => {
      const report = generator.getCashFlowSummary('tenant_a', '2026-01-01', '2026-03-31');
      expect(report.periodComparison.currentPeriod.inflows).toBe(800);
      expect(report.periodComparison.currentPeriod.outflows).toBe(350);
    });
  });

  describe('getTenantSummary', () => {
    it('should compute tenant summary stats', () => {
      const summary = generator.getTenantSummary('tenant_a');

      expect(summary.tenantId).toBe('tenant_a');
      expect(summary.totalEntries).toBe(5);
      expect(summary.totalAccounts).toBe(3); // acct_revenue, acct_expenses, acct_fees
      expect(summary.totalVolume).toBeGreaterThan(0);
      expect(summary.firstEntryDate).toBe('2026-01-10T00:00:00Z');
      expect(summary.latestEntryDate).toBe('2026-03-01T00:00:00Z');
    });

    it('should include top accounts by volume', () => {
      const summary = generator.getTenantSummary('tenant_a');
      expect(summary.topAccountsByVolume.length).toBeGreaterThan(0);
      // Revenue account should be at the top (800 total)
      expect(summary.topAccountsByVolume[0].accountId).toBe('acct_revenue');
    });

    it('should report balance status', () => {
      const summary = generator.getTenantSummary('tenant_a');
      // Credits: 800, Debits: 350 -- not balanced
      expect(summary.balanceStatus).toBe('imbalanced');
    });

    it('should return empty summary for non-existent tenant', () => {
      const summary = generator.getTenantSummary('nonexistent');
      expect(summary.totalEntries).toBe(0);
      expect(summary.totalAccounts).toBe(0);
      expect(summary.firstEntryDate).toBeNull();
      expect(summary.latestEntryDate).toBeNull();
    });
  });

  describe('multi-tenant isolation', () => {
    it('tenant A report should not include tenant B data', () => {
      const reportA = generator.getProfitAndLoss('tenant_a', '2026-01-01', '2026-12-31');
      const reportB = generator.getProfitAndLoss('tenant_b', '2026-01-01', '2026-12-31');

      expect(reportA.totalRevenue).toBe(800);
      expect(reportB.totalRevenue).toBe(1000);

      expect(reportA.totalExpenses).toBe(350);
      expect(reportB.totalExpenses).toBe(400);
    });

    it('tenant A summary should only count tenant A entries', () => {
      const summaryA = generator.getTenantSummary('tenant_a');
      const summaryB = generator.getTenantSummary('tenant_b');

      expect(summaryA.totalEntries).toBe(5);
      expect(summaryB.totalEntries).toBe(2);
    });

    it('tenant aging reports should be isolated', () => {
      const agingA = generator.getAgingReport('tenant_a', '2026-03-01');
      const agingB = generator.getAgingReport('tenant_b', '2026-03-01');

      expect(agingA.totalOutstanding).not.toBe(agingB.totalOutstanding);
    });
  });

  describe('getAccountBreakdown', () => {
    it('should compute account breakdown', () => {
      const breakdown = generator.getAccountBreakdown('tenant_a', 'acct_revenue');

      expect(breakdown.tenantId).toBe('tenant_a');
      expect(breakdown.accountId).toBe('acct_revenue');
      expect(breakdown.totalCredits).toBe(800);
      expect(breakdown.totalDebits).toBe(0);
      expect(breakdown.netBalance).toBe(-800); // debits - credits
      expect(breakdown.entryCount).toBe(2);
    });

    it('should compute monthly trends', () => {
      const breakdown = generator.getAccountBreakdown('tenant_a', 'acct_revenue');
      expect(breakdown.monthlyTrends.length).toBeGreaterThan(0);
    });

    it('should compute average transaction sizes', () => {
      const breakdown = generator.getAccountBreakdown('tenant_a', 'acct_revenue');
      expect(breakdown.averageCreditSize).toBe(400); // 800 / 2
      expect(breakdown.averageTransactionSize).toBe(400); // 800 total / 2 entries
    });
  });

  describe('exportTenantReport', () => {
    it('should export P&L as JSON', () => {
      const json = generator.exportTenantReport('tenant_a', 'pnl', 'json', {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });

      const parsed = JSON.parse(json);
      expect(parsed.tenantId).toBe('tenant_a');
      expect(parsed.totalRevenue).toBe(800);
    });

    it('should export P&L as CSV', () => {
      const csv = generator.exportTenantReport('tenant_a', 'pnl', 'csv', {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });

      expect(csv).toContain('type,account_id,total,entry_count');
      expect(csv).toContain('revenue');
      expect(csv).toContain('expense');
    });

    it('should export summary as JSON', () => {
      const json = generator.exportTenantReport('tenant_a', 'summary', 'json');
      const parsed = JSON.parse(json);
      expect(parsed.tenantId).toBe('tenant_a');
      expect(parsed.totalEntries).toBe(5);
    });

    it('should throw for breakdown without accountId', () => {
      expect(() =>
        generator.exportTenantReport('tenant_a', 'breakdown', 'json')
      ).toThrow('accountId is required');
    });
  });
});
