/**
 * TenantReportGenerator - Per-tenant financial report generation.
 *
 * Generates P&L, aging, cash flow, summary, and account breakdown reports
 * for individual tenants. Works with an array of Ledger entries or a query
 * function that returns entries filtered by tenant.
 */

import { Ledger } from '../spec02/ledger';

// ---------------------------------------------------------------------------
// Report interfaces
// ---------------------------------------------------------------------------

export interface ProfitAndLossAccount {
  accountId: string;
  total: number;
  entryCount: number;
}

export interface ProfitAndLossReport {
  tenantId: string;
  startDate: string;
  endDate: string;
  revenue: ProfitAndLossAccount[];
  expenses: ProfitAndLossAccount[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  total: number;
  entryCount: number;
  entries: Array<{ accountId: string; amount: number; description: string; date: string; ageDays: number }>;
}

export interface AgingAccountBreakdown {
  accountId: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
}

export interface AgingReport {
  tenantId: string;
  asOfDate: string;
  buckets: AgingBucket[];
  accountBreakdowns: AgingAccountBreakdown[];
  totalOutstanding: number;
}

export interface CashFlowReport {
  tenantId: string;
  startDate: string;
  endDate: string;
  inflows: number;
  outflows: number;
  netCashFlow: number;
  inflowEntries: Array<{ accountId: string; amount: number; description: string; date: string }>;
  outflowEntries: Array<{ accountId: string; amount: number; description: string; date: string }>;
  periodComparison: {
    currentPeriod: { inflows: number; outflows: number; net: number };
    previousPeriod: { inflows: number; outflows: number; net: number } | null;
    inflowChange: number | null;
    outflowChange: number | null;
    netChange: number | null;
  };
}

export interface TopAccount {
  accountId: string;
  totalVolume: number;
  entryCount: number;
}

export interface TenantSummary {
  tenantId: string;
  totalAccounts: number;
  totalEntries: number;
  totalVolume: number;
  firstEntryDate: string | null;
  latestEntryDate: string | null;
  topAccountsByVolume: TopAccount[];
  balanceStatus: 'balanced' | 'imbalanced';
  totalDebits: number;
  totalCredits: number;
}

export interface AccountBreakdown {
  tenantId: string;
  accountId: string;
  startDate: string | null;
  endDate: string | null;
  totalDebits: number;
  totalCredits: number;
  netBalance: number;
  entryCount: number;
  averageTransactionSize: number;
  averageDebitSize: number;
  averageCreditSize: number;
  transactionFrequency: {
    totalDays: number;
    entriesPerDay: number;
  };
  monthlyTrends: Array<{
    month: string;
    debits: number;
    credits: number;
    net: number;
    entryCount: number;
  }>;
}

// ---------------------------------------------------------------------------
// Data source type
// ---------------------------------------------------------------------------

/**
 * A function that returns Ledger entries for a given tenant.
 * The TenantReportGenerator will call this to retrieve data.
 */
export type TenantEntryQuery = (tenantId: string) => Ledger[];

// ---------------------------------------------------------------------------
// TenantReportGenerator
// ---------------------------------------------------------------------------

export class TenantReportGenerator {
  private readonly queryFn: TenantEntryQuery;

  /**
   * @param source - Either an array of Ledger entries (filtered by tenant via
   *   metadata.tenantId) or a function that returns entries for a given tenant.
   */
  constructor(source: Ledger[] | TenantEntryQuery) {
    if (typeof source === 'function') {
      this.queryFn = source;
    } else {
      const entries = source;
      this.queryFn = (tenantId: string) =>
        entries.filter(e => {
          const meta = e.metadata;
          return meta && meta.tenantId === tenantId;
        });
    }
  }

  private getEntries(tenantId: string): Ledger[] {
    return this.queryFn(tenantId);
  }

  private filterByDateRange(entries: Ledger[], startDate?: string, endDate?: string): Ledger[] {
    return entries.filter(e => {
      const d = e.createdAt || '';
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }

  // -------------------------------------------------------------------------
  // 1. Profit & Loss
  // -------------------------------------------------------------------------

  /**
   * Generate a Profit & Loss report for a tenant.
   *
   * Revenue is identified by credit entries; expenses by debit entries.
   * Grouped by account.
   */
  getProfitAndLoss(tenantId: string, startDate: string, endDate: string): ProfitAndLossReport {
    const entries = this.filterByDateRange(this.getEntries(tenantId), startDate, endDate);

    const revenueMap = new Map<string, { total: number; count: number }>();
    const expenseMap = new Map<string, { total: number; count: number }>();

    for (const entry of entries) {
      if (entry.entryType === 'credit') {
        const bucket = revenueMap.get(entry.accountId) || { total: 0, count: 0 };
        bucket.total += entry.amount;
        bucket.count++;
        revenueMap.set(entry.accountId, bucket);
      } else if (entry.entryType === 'debit') {
        const bucket = expenseMap.get(entry.accountId) || { total: 0, count: 0 };
        bucket.total += entry.amount;
        bucket.count++;
        expenseMap.set(entry.accountId, bucket);
      }
    }

    const revenue: ProfitAndLossAccount[] = Array.from(revenueMap.entries())
      .map(([accountId, b]) => ({ accountId, total: b.total, entryCount: b.count }))
      .sort((a, b) => b.total - a.total);

    const expenses: ProfitAndLossAccount[] = Array.from(expenseMap.entries())
      .map(([accountId, b]) => ({ accountId, total: b.total, entryCount: b.count }))
      .sort((a, b) => b.total - a.total);

    const totalRevenue = revenue.reduce((s, r) => s + r.total, 0);
    const totalExpenses = expenses.reduce((s, r) => s + r.total, 0);

    return {
      tenantId,
      startDate,
      endDate,
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
    };
  }

  // -------------------------------------------------------------------------
  // 2. Aging Report
  // -------------------------------------------------------------------------

  /**
   * Generate an aging report for outstanding entries as of a given date.
   *
   * Buckets: Current (0 days), 1-30 days, 31-60, 61-90, 90+.
   * Age is calculated as difference between asOfDate and the entry's created date.
   */
  getAgingReport(tenantId: string, asOfDate: string): AgingReport {
    const entries = this.getEntries(tenantId).filter(e => (e.createdAt || '') <= asOfDate);
    const asOf = new Date(asOfDate);

    const bucketDefs: Array<{ label: string; min: number; max: number | null }> = [
      { label: 'Current', min: 0, max: 0 },
      { label: '1-30 days', min: 1, max: 30 },
      { label: '31-60 days', min: 31, max: 60 },
      { label: '61-90 days', min: 61, max: 90 },
      { label: '90+ days', min: 91, max: null },
    ];

    const buckets: AgingBucket[] = bucketDefs.map(def => ({
      label: def.label,
      minDays: def.min,
      maxDays: def.max,
      total: 0,
      entryCount: 0,
      entries: [],
    }));

    const accountMap = new Map<string, { current: number; d1to30: number; d31to60: number; d61to90: number; d90plus: number; total: number }>();

    for (const entry of entries) {
      const entryDate = new Date(entry.createdAt);
      const ageDays = Math.max(0, Math.floor((asOf.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)));

      let bucketIdx: number;
      if (ageDays === 0) bucketIdx = 0;
      else if (ageDays <= 30) bucketIdx = 1;
      else if (ageDays <= 60) bucketIdx = 2;
      else if (ageDays <= 90) bucketIdx = 3;
      else bucketIdx = 4;

      const bucket = buckets[bucketIdx];
      bucket.total += entry.amount;
      bucket.entryCount++;
      bucket.entries.push({
        accountId: entry.accountId,
        amount: entry.amount,
        description: entry.description,
        date: entry.createdAt,
        ageDays,
      });

      // Per-account breakdown
      const acct = accountMap.get(entry.accountId) || { current: 0, d1to30: 0, d31to60: 0, d61to90: 0, d90plus: 0, total: 0 };
      acct.total += entry.amount;
      if (bucketIdx === 0) acct.current += entry.amount;
      else if (bucketIdx === 1) acct.d1to30 += entry.amount;
      else if (bucketIdx === 2) acct.d31to60 += entry.amount;
      else if (bucketIdx === 3) acct.d61to90 += entry.amount;
      else acct.d90plus += entry.amount;
      accountMap.set(entry.accountId, acct);
    }

    const accountBreakdowns: AgingAccountBreakdown[] = Array.from(accountMap.entries())
      .map(([accountId, a]) => ({
        accountId,
        current: a.current,
        days1to30: a.d1to30,
        days31to60: a.d31to60,
        days61to90: a.d61to90,
        days90plus: a.d90plus,
        total: a.total,
      }))
      .sort((a, b) => b.total - a.total);

    const totalOutstanding = buckets.reduce((s, b) => s + b.total, 0);

    return {
      tenantId,
      asOfDate,
      buckets,
      accountBreakdowns,
      totalOutstanding,
    };
  }

  // -------------------------------------------------------------------------
  // 3. Cash Flow Summary
  // -------------------------------------------------------------------------

  /**
   * Generate a cash flow summary for a tenant.
   *
   * Inflows = credit entries to cash/bank accounts.
   * Outflows = debit entries from cash/bank accounts.
   * Includes period-over-period comparison when the date range allows.
   */
  getCashFlowSummary(tenantId: string, startDate: string, endDate: string): CashFlowReport {
    const allEntries = this.getEntries(tenantId);
    const periodEntries = this.filterByDateRange(allEntries, startDate, endDate);

    const inflowEntries: CashFlowReport['inflowEntries'] = [];
    const outflowEntries: CashFlowReport['outflowEntries'] = [];

    for (const entry of periodEntries) {
      const item = {
        accountId: entry.accountId,
        amount: entry.amount,
        description: entry.description,
        date: entry.createdAt,
      };
      if (entry.entryType === 'credit') {
        inflowEntries.push(item);
      } else {
        outflowEntries.push(item);
      }
    }

    const inflows = inflowEntries.reduce((s, e) => s + e.amount, 0);
    const outflows = outflowEntries.reduce((s, e) => s + e.amount, 0);
    const netCashFlow = inflows - outflows;

    // Period-over-period comparison
    const start = new Date(startDate);
    const end = new Date(endDate);
    const periodMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodMs);
    const prevEnd = new Date(start.getTime() - 1); // day before current start

    const prevStartStr = prevStart.toISOString().slice(0, 10);
    const prevEndStr = prevEnd.toISOString().slice(0, 10);
    const prevEntries = this.filterByDateRange(allEntries, prevStartStr, prevEndStr);

    let previousPeriod: CashFlowReport['periodComparison']['previousPeriod'] = null;
    let inflowChange: number | null = null;
    let outflowChange: number | null = null;
    let netChange: number | null = null;

    if (prevEntries.length > 0) {
      let prevInflows = 0;
      let prevOutflows = 0;
      for (const entry of prevEntries) {
        if (entry.entryType === 'credit') {
          prevInflows += entry.amount;
        } else {
          prevOutflows += entry.amount;
        }
      }
      previousPeriod = { inflows: prevInflows, outflows: prevOutflows, net: prevInflows - prevOutflows };
      inflowChange = inflows - prevInflows;
      outflowChange = outflows - prevOutflows;
      netChange = netCashFlow - previousPeriod.net;
    }

    return {
      tenantId,
      startDate,
      endDate,
      inflows,
      outflows,
      netCashFlow,
      inflowEntries,
      outflowEntries,
      periodComparison: {
        currentPeriod: { inflows, outflows, net: netCashFlow },
        previousPeriod,
        inflowChange,
        outflowChange,
        netChange,
      },
    };
  }

  // -------------------------------------------------------------------------
  // 4. Tenant Summary
  // -------------------------------------------------------------------------

  getTenantSummary(tenantId: string): TenantSummary {
    const entries = this.getEntries(tenantId);

    const accountVolumes = new Map<string, { volume: number; count: number }>();
    let totalDebits = 0;
    let totalCredits = 0;
    let firstDate: string | null = null;
    let latestDate: string | null = null;

    for (const entry of entries) {
      const vol = accountVolumes.get(entry.accountId) || { volume: 0, count: 0 };
      vol.volume += entry.amount;
      vol.count++;
      accountVolumes.set(entry.accountId, vol);

      if (entry.entryType === 'debit') totalDebits += entry.amount;
      else totalCredits += entry.amount;

      const d = entry.createdAt || '';
      if (d) {
        if (!firstDate || d < firstDate) firstDate = d;
        if (!latestDate || d > latestDate) latestDate = d;
      }
    }

    const topAccountsByVolume: TopAccount[] = Array.from(accountVolumes.entries())
      .map(([accountId, v]) => ({ accountId, totalVolume: v.volume, entryCount: v.count }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10);

    const totalVolume = entries.reduce((s, e) => s + e.amount, 0);
    const balanced = Math.abs(totalDebits - totalCredits) < 0.001;

    return {
      tenantId,
      totalAccounts: accountVolumes.size,
      totalEntries: entries.length,
      totalVolume,
      firstEntryDate: firstDate,
      latestEntryDate: latestDate,
      topAccountsByVolume,
      balanceStatus: balanced ? 'balanced' : 'imbalanced',
      totalDebits,
      totalCredits,
    };
  }

  // -------------------------------------------------------------------------
  // 5. Account Breakdown
  // -------------------------------------------------------------------------

  getAccountBreakdown(
    tenantId: string,
    accountId: string,
    startDate?: string,
    endDate?: string
  ): AccountBreakdown {
    const allEntries = this.getEntries(tenantId).filter(e => e.accountId === accountId);
    const entries = this.filterByDateRange(allEntries, startDate, endDate);

    let totalDebits = 0;
    let totalCredits = 0;
    let debitCount = 0;
    let creditCount = 0;

    const monthlyMap = new Map<string, { debits: number; credits: number; count: number }>();

    for (const entry of entries) {
      if (entry.entryType === 'debit') {
        totalDebits += entry.amount;
        debitCount++;
      } else {
        totalCredits += entry.amount;
        creditCount++;
      }

      const month = (entry.createdAt || '').slice(0, 7);
      if (month) {
        const bucket = monthlyMap.get(month) || { debits: 0, credits: 0, count: 0 };
        if (entry.entryType === 'debit') bucket.debits += entry.amount;
        else bucket.credits += entry.amount;
        bucket.count++;
        monthlyMap.set(month, bucket);
      }
    }

    const entryCount = entries.length;
    const averageTransactionSize = entryCount > 0 ? (totalDebits + totalCredits) / entryCount : 0;
    const averageDebitSize = debitCount > 0 ? totalDebits / debitCount : 0;
    const averageCreditSize = creditCount > 0 ? totalCredits / creditCount : 0;

    // Frequency calculation
    let totalDays = 0;
    if (entries.length >= 2) {
      const dates = entries
        .map(e => e.createdAt || '')
        .filter(d => d.length > 0)
        .sort();
      if (dates.length >= 2) {
        const first = new Date(dates[0]);
        const last = new Date(dates[dates.length - 1]);
        totalDays = Math.max(1, Math.floor((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }

    const monthlyTrends = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, b]) => ({
        month,
        debits: b.debits,
        credits: b.credits,
        net: b.debits - b.credits,
        entryCount: b.count,
      }));

    return {
      tenantId,
      accountId,
      startDate: startDate || null,
      endDate: endDate || null,
      totalDebits,
      totalCredits,
      netBalance: totalDebits - totalCredits,
      entryCount,
      averageTransactionSize,
      averageDebitSize,
      averageCreditSize,
      transactionFrequency: {
        totalDays,
        entriesPerDay: totalDays > 0 ? entryCount / totalDays : entryCount,
      },
      monthlyTrends,
    };
  }

  // -------------------------------------------------------------------------
  // 6. Export
  // -------------------------------------------------------------------------

  /**
   * Export any report type to JSON or CSV format.
   */
  exportTenantReport(
    tenantId: string,
    reportType: 'pnl' | 'aging' | 'cashflow' | 'summary' | 'breakdown',
    format: 'json' | 'csv',
    options?: {
      startDate?: string;
      endDate?: string;
      asOfDate?: string;
      accountId?: string;
    }
  ): string {
    const opts = options || {};

    let reportData: unknown;

    switch (reportType) {
      case 'pnl':
        reportData = this.getProfitAndLoss(
          tenantId,
          opts.startDate || '1970-01-01',
          opts.endDate || '2099-12-31'
        );
        break;
      case 'aging':
        reportData = this.getAgingReport(
          tenantId,
          opts.asOfDate || new Date().toISOString().slice(0, 10)
        );
        break;
      case 'cashflow':
        reportData = this.getCashFlowSummary(
          tenantId,
          opts.startDate || '1970-01-01',
          opts.endDate || '2099-12-31'
        );
        break;
      case 'summary':
        reportData = this.getTenantSummary(tenantId);
        break;
      case 'breakdown':
        if (!opts.accountId) {
          throw new Error('accountId is required for breakdown report');
        }
        reportData = this.getAccountBreakdown(
          tenantId,
          opts.accountId,
          opts.startDate,
          opts.endDate
        );
        break;
    }

    if (format === 'json') {
      return JSON.stringify(reportData, null, 2);
    }

    // CSV export
    return this.toCsv(reportType, reportData);
  }

  private toCsv(reportType: string, data: unknown): string {
    const rows: string[] = [];

    switch (reportType) {
      case 'pnl': {
        const report = data as ProfitAndLossReport;
        rows.push('type,account_id,total,entry_count');
        for (const r of report.revenue) {
          rows.push(`revenue,${this.csvEscape(r.accountId)},${r.total},${r.entryCount}`);
        }
        for (const e of report.expenses) {
          rows.push(`expense,${this.csvEscape(e.accountId)},${e.total},${e.entryCount}`);
        }
        rows.push(`summary,total_revenue,${report.totalRevenue},`);
        rows.push(`summary,total_expenses,${report.totalExpenses},`);
        rows.push(`summary,net_income,${report.netIncome},`);
        break;
      }
      case 'aging': {
        const report = data as AgingReport;
        rows.push('bucket,total,entry_count');
        for (const b of report.buckets) {
          rows.push(`${this.csvEscape(b.label)},${b.total},${b.entryCount}`);
        }
        rows.push('');
        rows.push('account_id,current,1_30_days,31_60_days,61_90_days,90_plus_days,total');
        for (const a of report.accountBreakdowns) {
          rows.push(`${this.csvEscape(a.accountId)},${a.current},${a.days1to30},${a.days31to60},${a.days61to90},${a.days90plus},${a.total}`);
        }
        break;
      }
      case 'cashflow': {
        const report = data as CashFlowReport;
        rows.push('metric,value');
        rows.push(`inflows,${report.inflows}`);
        rows.push(`outflows,${report.outflows}`);
        rows.push(`net_cash_flow,${report.netCashFlow}`);
        if (report.periodComparison.previousPeriod) {
          rows.push(`prev_inflows,${report.periodComparison.previousPeriod.inflows}`);
          rows.push(`prev_outflows,${report.periodComparison.previousPeriod.outflows}`);
          rows.push(`prev_net,${report.periodComparison.previousPeriod.net}`);
          rows.push(`inflow_change,${report.periodComparison.inflowChange}`);
          rows.push(`outflow_change,${report.periodComparison.outflowChange}`);
          rows.push(`net_change,${report.periodComparison.netChange}`);
        }
        break;
      }
      case 'summary': {
        const report = data as TenantSummary;
        rows.push('metric,value');
        rows.push(`total_accounts,${report.totalAccounts}`);
        rows.push(`total_entries,${report.totalEntries}`);
        rows.push(`total_volume,${report.totalVolume}`);
        rows.push(`first_entry_date,${report.firstEntryDate || ''}`);
        rows.push(`latest_entry_date,${report.latestEntryDate || ''}`);
        rows.push(`balance_status,${report.balanceStatus}`);
        rows.push(`total_debits,${report.totalDebits}`);
        rows.push(`total_credits,${report.totalCredits}`);
        rows.push('');
        rows.push('top_account_id,total_volume,entry_count');
        for (const a of report.topAccountsByVolume) {
          rows.push(`${this.csvEscape(a.accountId)},${a.totalVolume},${a.entryCount}`);
        }
        break;
      }
      case 'breakdown': {
        const report = data as AccountBreakdown;
        rows.push('metric,value');
        rows.push(`account_id,${this.csvEscape(report.accountId)}`);
        rows.push(`total_debits,${report.totalDebits}`);
        rows.push(`total_credits,${report.totalCredits}`);
        rows.push(`net_balance,${report.netBalance}`);
        rows.push(`entry_count,${report.entryCount}`);
        rows.push(`avg_transaction_size,${report.averageTransactionSize}`);
        rows.push(`avg_debit_size,${report.averageDebitSize}`);
        rows.push(`avg_credit_size,${report.averageCreditSize}`);
        rows.push(`total_days,${report.transactionFrequency.totalDays}`);
        rows.push(`entries_per_day,${report.transactionFrequency.entriesPerDay}`);
        rows.push('');
        rows.push('month,debits,credits,net,entry_count');
        for (const m of report.monthlyTrends) {
          rows.push(`${m.month},${m.debits},${m.credits},${m.net},${m.entryCount}`);
        }
        break;
      }
    }

    return rows.join('\n');
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
