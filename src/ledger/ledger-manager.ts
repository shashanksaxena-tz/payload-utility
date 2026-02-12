/**
 * LedgerManager - Two-way (double-entry) ledger management system.
 *
 * Implements double-entry bookkeeping principles where every financial
 * transaction creates balanced debit and credit entries across accounts.
 *
 * Key principles:
 * 1. Every transaction has equal debits and credits
 * 2. Assets = Liabilities + Equity (balance sheet equation)
 * 3. Debit entries increase asset/expense accounts
 * 4. Credit entries increase liability/revenue/equity accounts
 * 5. All entries are immutable - corrections are made via reversing entries
 *
 * This manager works with the Payload Ledger (TransactionLedger) API objects
 * and provides higher-level operations for:
 * - Creating balanced ledger entries
 * - Validating entry pairs
 * - Computing account balances
 * - Generating reconciliation reports
 * - Detecting imbalances
 */

import { Session } from '../core/session';
import { Ledger } from '../spec02/ledger';
import { attr, Filter } from '../core/attr';

export interface LedgerEntry {
  accountId: string;
  amount: number;
  entryType: 'debit' | 'credit';
  description: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface LedgerPair {
  debit: LedgerEntry;
  credit: LedgerEntry;
}

export interface AccountBalance {
  accountId: string;
  totalDebits: number;
  totalCredits: number;
  netBalance: number;
  entryCount: number;
}

export interface ReconciliationResult {
  balanced: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
  accountBalances: AccountBalance[];
  imbalancedAccounts: string[];
}

export interface LedgerTransaction {
  transactionId: string;
  entries: LedgerEntry[];
  totalAmount: number;
  description: string;
  createdAt: string;
}

export interface DailyBalance {
  date: string;
  debits: number;
  credits: number;
  net: number;
  runningBalance: number;
  entryCount: number;
}

export interface MonthlyBalance {
  month: string;
  debits: number;
  credits: number;
  net: number;
  runningBalance: number;
  entryCount: number;
}

export interface AccountStatement {
  accountId: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  entries: Array<{
    id: string;
    date: string;
    description: string;
    reference: string;
    entryType: 'debit' | 'credit';
    amount: number;
    runningBalance: number;
    metadata?: Record<string, unknown> | null;
  }>;
  totalDebits: number;
  totalCredits: number;
}

export interface TrialBalanceRow {
  accountId: string;
  debitBalance: number;
  creditBalance: number;
}

export interface TrialBalance {
  asOfDate: string;
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
}

export class LedgerManager {
  private readonly session: Session;

  constructor(session: Session) {
    this.session = session;
  }

  /**
   * Create a balanced double-entry ledger transaction.
   *
   * Every call creates both a debit and credit entry to maintain
   * the fundamental accounting equation. The entries MUST balance.
   */
  async createBalancedEntry(pair: LedgerPair): Promise<{ debit: Ledger; credit: Ledger }> {
    // Validate the pair balances
    if (Math.abs(pair.debit.amount - pair.credit.amount) > 0.001) {
      throw new Error(
        `Ledger imbalance: debit amount (${pair.debit.amount}) does not equal credit amount (${pair.credit.amount}). ` +
        'Double-entry bookkeeping requires balanced entries.'
      );
    }

    if (pair.debit.amount <= 0 || pair.credit.amount <= 0) {
      throw new Error('Ledger entry amounts must be positive');
    }

    if (pair.debit.accountId === pair.credit.accountId) {
      throw new Error('Debit and credit accounts must be different for a two-way entry');
    }

    // Create both entries
    const [debitEntry, creditEntry] = await Promise.all([
      this.session.Ledger.create({
        account_id: pair.debit.accountId,
        amount: pair.debit.amount,
        entry_type: 'debit',
        description: pair.debit.description,
        reference: pair.debit.reference || '',
        ...(pair.debit.metadata ? { metadata: pair.debit.metadata } : {}),
      }),
      this.session.Ledger.create({
        account_id: pair.credit.accountId,
        amount: pair.credit.amount,
        entry_type: 'credit',
        description: pair.credit.description,
        reference: pair.credit.reference || '',
        ...(pair.credit.metadata ? { metadata: pair.credit.metadata } : {}),
      }),
    ]);

    return { debit: debitEntry, credit: creditEntry };
  }

  /**
   * Create a multi-leg ledger transaction with multiple debit/credit entries.
   * Total debits MUST equal total credits.
   */
  async createMultiLegEntry(entries: LedgerEntry[]): Promise<Ledger[]> {
    if (entries.length < 2) {
      throw new Error('Multi-leg entry requires at least 2 entries');
    }

    const totalDebits = entries
      .filter(e => e.entryType === 'debit')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalCredits = entries
      .filter(e => e.entryType === 'credit')
      .reduce((sum, e) => sum + e.amount, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.001) {
      throw new Error(
        `Multi-leg imbalance: total debits (${totalDebits}) do not equal total credits (${totalCredits})`
      );
    }

    const results = await Promise.all(
      entries.map(entry =>
        this.session.Ledger.create({
          account_id: entry.accountId,
          amount: entry.amount,
          entry_type: entry.entryType,
          description: entry.description,
          reference: entry.reference || '',
          ...(entry.metadata ? { metadata: entry.metadata } : {}),
        })
      )
    );

    return results;
  }

  /**
   * Get the balance for a specific account.
   * Computes net balance from all debit and credit entries.
   */
  async getAccountBalance(accountId: string): Promise<AccountBalance> {
    const entries = await this.session.Ledger
      .filterBy({ account_id: accountId })
      .all();

    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of entries) {
      if (entry.entryType === 'debit') {
        totalDebits += entry.amount;
      } else if (entry.entryType === 'credit') {
        totalCredits += entry.amount;
      }
    }

    return {
      accountId,
      totalDebits,
      totalCredits,
      netBalance: totalDebits - totalCredits,
      entryCount: entries.length,
    };
  }

  /**
   * Get ledger entries for a specific transaction.
   */
  async getTransactionEntries(transactionId: string): Promise<Ledger[]> {
    return this.session.Ledger
      .filterBy({ transaction_id: transactionId })
      .all();
  }

  /**
   * Validate that a transaction's ledger entries are balanced.
   */
  async validateTransactionBalance(transactionId: string): Promise<boolean> {
    const entries = await this.getTransactionEntries(transactionId);

    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of entries) {
      if (entry.entryType === 'debit') {
        totalDebits += entry.amount;
      } else if (entry.entryType === 'credit') {
        totalCredits += entry.amount;
      }
    }

    return Math.abs(totalDebits - totalCredits) < 0.001;
  }

  /**
   * Perform a full reconciliation across all accounts.
   * Verifies the double-entry system is balanced.
   */
  async reconcile(accountIds: string[]): Promise<ReconciliationResult> {
    const accountBalances: AccountBalance[] = await Promise.all(
      accountIds.map(id => this.getAccountBalance(id))
    );

    let totalDebits = 0;
    let totalCredits = 0;
    const imbalancedAccounts: string[] = [];

    for (const balance of accountBalances) {
      totalDebits += balance.totalDebits;
      totalCredits += balance.totalCredits;

      // Check for unexpected imbalances in individual accounts
      if (balance.entryCount > 0 && Math.abs(balance.netBalance) > 0.001) {
        // Note: Individual account imbalance is normal in double-entry
        // Only flag if the overall system is imbalanced
      }
    }

    const difference = Math.abs(totalDebits - totalCredits);
    const balanced = difference < 0.001;

    if (!balanced) {
      // Find which accounts contribute to the imbalance
      for (const balance of accountBalances) {
        if (balance.entryCount > 0) {
          imbalancedAccounts.push(balance.accountId);
        }
      }
    }

    return {
      balanced,
      totalDebits,
      totalCredits,
      difference,
      accountBalances,
      imbalancedAccounts,
    };
  }

  /**
   * Create a reversing entry to correct a previous entry.
   * In double-entry, corrections are done by creating opposite entries.
   */
  async createReversalEntry(
    originalDebitAccountId: string,
    originalCreditAccountId: string,
    amount: number,
    reason: string,
    metadata?: Record<string, unknown>
  ): Promise<{ debit: Ledger; credit: Ledger }> {
    // Reverse: the original debit account gets a credit, and vice versa
    return this.createBalancedEntry({
      debit: {
        accountId: originalCreditAccountId,
        amount,
        entryType: 'debit',
        description: `REVERSAL: ${reason}`,
        reference: `reversal`,
        ...(metadata ? { metadata } : {}),
      },
      credit: {
        accountId: originalDebitAccountId,
        amount,
        entryType: 'credit',
        description: `REVERSAL: ${reason}`,
        reference: `reversal`,
        ...(metadata ? { metadata } : {}),
      },
    });
  }

  /**
   * Get a summary of ledger activity for a date range.
   */
  async getActivitySummary(
    accountId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    accountId: string;
    debits: Array<{ amount: number; description: string; createdAt: string; reference?: string; metadata?: Record<string, unknown> | null }>;
    credits: Array<{ amount: number; description: string; createdAt: string; reference?: string; metadata?: Record<string, unknown> | null }>;
    totalDebits: number;
    totalCredits: number;
    netChange: number;
  }> {
    const filters: (Filter | Record<string, unknown>)[] = [{ account_id: accountId }];

    if (startDate) {
      filters.push((attr as Record<string, AttrChainLike>).created_at.gte(startDate));
    }
    if (endDate) {
      filters.push((attr as Record<string, AttrChainLike>).created_at.lte(endDate));
    }

    const entries = await this.session.Ledger.filterBy(...filters).all();

    const debits: Array<{ amount: number; description: string; createdAt: string; reference?: string; metadata?: Record<string, unknown> | null }> = [];
    const credits: Array<{ amount: number; description: string; createdAt: string; reference?: string; metadata?: Record<string, unknown> | null }> = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of entries) {
      const item = {
        amount: entry.amount,
        description: entry.description,
        createdAt: entry.createdAt,
        reference: entry.reference,
        metadata: entry.metadata,
      };

      if (entry.entryType === 'debit') {
        debits.push(item);
        totalDebits += entry.amount;
      } else {
        credits.push(item);
        totalCredits += entry.amount;
      }
    }

    return {
      accountId,
      debits,
      credits,
      totalDebits,
      totalCredits,
      netChange: totalDebits - totalCredits,
    };
  }

  /**
   * Get daily balance aggregations for an account within a date range.
   * Returns one row per day that has ledger activity.
   */
  async getDailyBalances(
    accountId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyBalance[]> {
    const filters: (Filter | Record<string, unknown>)[] = [{ account_id: accountId }];
    if (startDate) {
      filters.push((attr as Record<string, AttrChainLike>).created_at.gte(startDate));
    }
    if (endDate) {
      filters.push((attr as Record<string, AttrChainLike>).created_at.lte(endDate));
    }

    const entries = await this.session.Ledger.filterBy(...filters).all();

    // Group entries by date (YYYY-MM-DD)
    const dayMap = new Map<string, { debits: number; credits: number; count: number }>();
    for (const entry of entries) {
      const day = (entry.createdAt || '').slice(0, 10);
      if (!day) continue;
      const bucket = dayMap.get(day) || { debits: 0, credits: 0, count: 0 };
      if (entry.entryType === 'debit') {
        bucket.debits += entry.amount;
      } else {
        bucket.credits += entry.amount;
      }
      bucket.count++;
      dayMap.set(day, bucket);
    }

    // Sort by date and compute running balance
    const sortedDays = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let runningBalance = 0;
    return sortedDays.map(([date, bucket]) => {
      const net = bucket.debits - bucket.credits;
      runningBalance += net;
      return {
        date,
        debits: bucket.debits,
        credits: bucket.credits,
        net,
        runningBalance,
        entryCount: bucket.count,
      };
    });
  }

  /**
   * Get monthly balance aggregations for an account within a date range.
   * Returns one row per month that has ledger activity.
   */
  async getMonthlyBalances(
    accountId: string,
    startDate: string,
    endDate: string
  ): Promise<MonthlyBalance[]> {
    const filters: (Filter | Record<string, unknown>)[] = [{ account_id: accountId }];
    if (startDate) {
      filters.push((attr as Record<string, AttrChainLike>).created_at.gte(startDate));
    }
    if (endDate) {
      filters.push((attr as Record<string, AttrChainLike>).created_at.lte(endDate));
    }

    const entries = await this.session.Ledger.filterBy(...filters).all();

    // Group by month (YYYY-MM)
    const monthMap = new Map<string, { debits: number; credits: number; count: number }>();
    for (const entry of entries) {
      const month = (entry.createdAt || '').slice(0, 7);
      if (!month) continue;
      const bucket = monthMap.get(month) || { debits: 0, credits: 0, count: 0 };
      if (entry.entryType === 'debit') {
        bucket.debits += entry.amount;
      } else {
        bucket.credits += entry.amount;
      }
      bucket.count++;
      monthMap.set(month, bucket);
    }

    const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let runningBalance = 0;
    return sortedMonths.map(([month, bucket]) => {
      const net = bucket.debits - bucket.credits;
      runningBalance += net;
      return {
        month,
        debits: bucket.debits,
        credits: bucket.credits,
        net,
        runningBalance,
        entryCount: bucket.count,
      };
    });
  }

  /**
   * Generate a full account statement with running balance per entry.
   * Similar to a bank statement — shows every entry chronologically
   * with an opening and closing balance.
   */
  async getAccountStatement(
    accountId: string,
    startDate: string,
    endDate: string
  ): Promise<AccountStatement> {
    // Get all entries for this account (before the range to compute opening balance)
    const allEntries = await this.session.Ledger
      .filterBy({ account_id: accountId })
      .all();

    // Split into entries before the range and entries in the range
    let openingBalance = 0;
    const rangeEntries: Ledger[] = [];

    for (const entry of allEntries) {
      const date = entry.createdAt || '';
      if (date < startDate) {
        openingBalance += entry.entryType === 'debit' ? entry.amount : -entry.amount;
      } else if (date <= endDate || !endDate) {
        rangeEntries.push(entry);
      }
    }

    // Sort range entries chronologically
    rangeEntries.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    let runningBalance = openingBalance;
    let totalDebits = 0;
    let totalCredits = 0;

    const entries = rangeEntries.map(entry => {
      const amount = entry.amount;
      if (entry.entryType === 'debit') {
        runningBalance += amount;
        totalDebits += amount;
      } else {
        runningBalance -= amount;
        totalCredits += amount;
      }
      return {
        id: entry.id,
        date: entry.createdAt,
        description: entry.description,
        reference: entry.reference,
        entryType: entry.entryType as 'debit' | 'credit',
        amount,
        runningBalance,
        metadata: entry.metadata,
      };
    });

    return {
      accountId,
      startDate,
      endDate,
      openingBalance,
      closingBalance: runningBalance,
      entries,
      totalDebits,
      totalCredits,
    };
  }

  /**
   * Generate a trial balance across all specified accounts.
   * Lists each account with its debit or credit balance,
   * and verifies the totals match (balanced system).
   */
  async getTrialBalance(accountIds: string[], asOfDate?: string): Promise<TrialBalance> {
    const rows: TrialBalanceRow[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const accountId of accountIds) {
      const filters: (Filter | Record<string, unknown>)[] = [{ account_id: accountId }];
      if (asOfDate) {
        filters.push((attr as Record<string, AttrChainLike>).created_at.lte(asOfDate));
      }

      const entries = await this.session.Ledger.filterBy(...filters).all();
      let debits = 0;
      let credits = 0;

      for (const entry of entries) {
        if (entry.entryType === 'debit') {
          debits += entry.amount;
        } else {
          credits += entry.amount;
        }
      }

      const net = debits - credits;
      const row: TrialBalanceRow = {
        accountId,
        debitBalance: net > 0 ? net : 0,
        creditBalance: net < 0 ? Math.abs(net) : 0,
      };

      rows.push(row);
      totalDebits += row.debitBalance;
      totalCredits += row.creditBalance;
    }

    return {
      asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
      rows,
      totalDebits,
      totalCredits,
      balanced: Math.abs(totalDebits - totalCredits) < 0.001,
    };
  }

  /**
   * Export ledger entries for an account as structured data (for CSV/JSON export).
   * Returns raw entry records suitable for download.
   */
  async exportEntries(
    accountId: string,
    startDate?: string,
    endDate?: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<{ format: string; data: string; count: number }> {
    const filters: (Filter | Record<string, unknown>)[] = [{ account_id: accountId }];
    if (startDate) {
      filters.push((attr as Record<string, AttrChainLike>).created_at.gte(startDate));
    }
    if (endDate) {
      filters.push((attr as Record<string, AttrChainLike>).created_at.lte(endDate));
    }

    const entries = await this.session.Ledger.filterBy(...filters).all();

    const records = entries.map(entry => ({
      id: entry.id,
      account_id: entry.accountId,
      entry_type: entry.entryType,
      amount: entry.amount,
      description: entry.description,
      reference: entry.reference,
      metadata: entry.metadata,
      created_at: entry.createdAt,
    }));

    if (format === 'csv') {
      const headers = ['id', 'account_id', 'entry_type', 'amount', 'description', 'reference', 'metadata', 'created_at'];
      const csvRows = [headers.join(',')];
      for (const r of records) {
        csvRows.push([
          r.id,
          r.account_id,
          r.entry_type,
          r.amount,
          `"${(r.description || '').replace(/"/g, '""')}"`,
          `"${(r.reference || '').replace(/"/g, '""')}"`,
          `"${r.metadata ? JSON.stringify(r.metadata).replace(/"/g, '""') : ''}"`,
          r.created_at,
        ].join(','));
      }
      return { format: 'csv', data: csvRows.join('\n'), count: records.length };
    }

    return { format: 'json', data: JSON.stringify(records, null, 2), count: records.length };
  }
}

// Type helper for dynamic attr access
interface AttrChainLike {
  gte(value: unknown): Filter;
  lte(value: unknown): Filter;
}
