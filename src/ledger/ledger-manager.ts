/**
 * LedgerManager - Local double-entry ledger management system.
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
 * Supports multi-tenant isolation via an optional tenantId parameter.
 * When a tenantId is set, all operations are scoped to that tenant.
 * Defaults to 'default' tenant for backward compatibility.
 *
 * Supports pluggable storage via the StorageAdapter interface.
 * When no storage adapter is provided, uses MemoryAdapter as default.
 *
 * The Session parameter is retained for backward compatibility and for
 * optional reconciliation against real Payload transactions.
 */

import { Session } from '../core/session';
import { Ledger } from '../spec02/ledger';
import { StorageAdapter, StoredLedgerEntry, LedgerQuery } from '../storage/types';
import { MemoryAdapter } from '../storage/memory-adapter';

export interface LedgerEntry {
  accountId: string;
  amount: number;
  entryType: 'debit' | 'credit';
  description: string;
  reference?: string;
  metadata?: Record<string, unknown>;
  transactionId?: string;
  tenantId?: string;
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

export interface LedgerManagerOptions {
  tenantId?: string;
  storage?: StorageAdapter;
}

const DEFAULT_TENANT = 'default';

export class LedgerManager {
  private readonly session: Session;
  private readonly storage: StorageAdapter;
  private tenantId: string;

  /**
   * Local Ledger[] cache for backward-compatible synchronous access.
   * Kept in sync with the storage adapter — every write goes to both.
   */
  private readonly entries: Ledger[] = [];
  private idCounter = 0;
  private initialized = false;

  constructor(session: Session, options?: LedgerManagerOptions) {
    this.session = session;
    this.tenantId = options?.tenantId ?? DEFAULT_TENANT;
    this.storage = options?.storage ?? new MemoryAdapter();
  }

  // -------------------------------------------------------------------------
  // Tenant management
  // -------------------------------------------------------------------------

  /** Switch the current tenant context. */
  setTenant(tenantId: string): void {
    this.tenantId = tenantId;
  }

  /** Get the current tenant ID. */
  getTenant(): string {
    return this.tenantId;
  }

  // -------------------------------------------------------------------------
  // Storage initialization
  // -------------------------------------------------------------------------

  /** Ensure the storage adapter is initialized. Called lazily on first operation. */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.storage.init();
      this.initialized = true;
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Convert a StoredLedgerEntry to a Ledger model instance. */
  private storedToLedger(stored: StoredLedgerEntry): Ledger {
    return new Ledger({
      id: stored.id,
      account_id: stored.accountId,
      amount: stored.amount,
      entry_type: stored.entryType,
      description: stored.description,
      reference: stored.reference || '',
      tenant_id: stored.tenantId,
      ...(stored.transactionId ? { transaction_id: stored.transactionId } : {}),
      ...(stored.metadata ? { metadata: stored.metadata } : {}),
      created_at: stored.createdAt,
    });
  }

  /**
   * Build a StoredLedgerEntry from raw data, assign an ID and timestamp.
   */
  private buildStoredEntry(data: Record<string, unknown>): StoredLedgerEntry {
    const id = `ledger_${++this.idCounter}`;
    const createdAt = (data.created_at as string) || new Date().toISOString();
    const entryTenantId = (data.tenant_id as string) || this.tenantId;

    return {
      id,
      tenantId: entryTenantId,
      accountId: (data.account_id as string) || '',
      amount: (data.amount as number) || 0,
      entryType: (data.entry_type as 'debit' | 'credit') || 'debit',
      description: (data.description as string) || '',
      reference: (data.reference as string) || undefined,
      transactionId: (data.transaction_id as string) || undefined,
      metadata: (data.metadata as Record<string, unknown>) || undefined,
      createdAt,
    };
  }

  /**
   * Create a ledger entry synchronously (local cache + fire-and-forget storage).
   * Used by synchronous methods like importEntries().
   */
  private createLocalEntrySync(data: Record<string, unknown>): Ledger {
    const stored = this.buildStoredEntry(data);
    const entry = this.storedToLedger(stored);
    this.entries.push(entry);

    // Persist to storage adapter in the background.
    this.storage.saveLedgerEntry(stored).catch(() => {
      // Best-effort persistence
    });

    return entry;
  }

  /**
   * Create a ledger entry and persist it via the storage adapter (async).
   * Also pushes to the local cache for synchronous access.
   */
  private async createLocalEntry(data: Record<string, unknown>): Promise<Ledger> {
    await this.ensureInitialized();

    const stored = this.buildStoredEntry(data);
    await this.storage.saveLedgerEntry(stored);

    const entry = this.storedToLedger(stored);
    this.entries.push(entry);

    return entry;
  }

  /**
   * Query entries via the storage adapter with simple filters.
   * Always scoped to the current tenant.
   */
  private async queryEntries(filters: Record<string, unknown> = {}): Promise<Ledger[]> {
    await this.ensureInitialized();

    const query: LedgerQuery = {
      tenantId: this.tenantId,
    };

    if (filters.account_id) {
      query.accountId = filters.account_id as string;
    }
    if (filters.transaction_id) {
      query.transactionId = filters.transaction_id as string;
    }
    if (filters.entry_type) {
      query.entryType = filters.entry_type as 'debit' | 'credit';
    }

    const stored = await this.storage.getLedgerEntries(query);
    return stored.map(s => this.storedToLedger(s));
  }

  /**
   * Query entries for an account with optional date range.
   * Always scoped to the current tenant.
   */
  private async queryAccountEntries(
    accountId: string,
    startDate?: string,
    endDate?: string
  ): Promise<Ledger[]> {
    await this.ensureInitialized();

    const query: LedgerQuery = {
      tenantId: this.tenantId,
      accountId,
    };

    if (startDate) {
      query.fromDate = startDate;
    }
    if (endDate) {
      query.toDate = endDate;
    }

    const stored = await this.storage.getLedgerEntries(query);
    return stored.map(s => this.storedToLedger(s));
  }

  // -------------------------------------------------------------------------
  // Public write operations
  // -------------------------------------------------------------------------

  /**
   * Create a balanced double-entry ledger transaction.
   *
   * Every call creates both a debit and credit entry to maintain
   * the fundamental accounting equation. The entries MUST balance.
   */
  async createBalancedEntry(pair: LedgerPair): Promise<{ debit: Ledger; credit: Ledger }> {
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

    const debitEntry = await this.createLocalEntry({
      account_id: pair.debit.accountId,
      amount: pair.debit.amount,
      entry_type: 'debit',
      description: pair.debit.description,
      reference: pair.debit.reference || '',
      ...(pair.debit.tenantId ? { tenant_id: pair.debit.tenantId } : {}),
      ...(pair.debit.transactionId ? { transaction_id: pair.debit.transactionId } : {}),
      ...(pair.debit.metadata ? { metadata: pair.debit.metadata } : {}),
    });

    const creditEntry = await this.createLocalEntry({
      account_id: pair.credit.accountId,
      amount: pair.credit.amount,
      entry_type: 'credit',
      description: pair.credit.description,
      reference: pair.credit.reference || '',
      ...(pair.credit.tenantId ? { tenant_id: pair.credit.tenantId } : {}),
      ...(pair.credit.transactionId ? { transaction_id: pair.credit.transactionId } : {}),
      ...(pair.credit.metadata ? { metadata: pair.credit.metadata } : {}),
    });

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

    const results: Ledger[] = [];
    for (const entry of entries) {
      const ledger = await this.createLocalEntry({
        account_id: entry.accountId,
        amount: entry.amount,
        entry_type: entry.entryType,
        description: entry.description,
        reference: entry.reference || '',
        ...(entry.tenantId ? { tenant_id: entry.tenantId } : {}),
        ...(entry.transactionId ? { transaction_id: entry.transactionId } : {}),
        ...(entry.metadata ? { metadata: entry.metadata } : {}),
      });
      results.push(ledger);
    }
    return results;
  }

  /**
   * Link a ledger entry pair to a real Payload transaction ID.
   * Creates balanced entries that reference the Payload transaction.
   */
  async createTransactionEntry(
    transactionId: string,
    pair: LedgerPair
  ): Promise<{ debit: Ledger; credit: Ledger }> {
    pair.debit.transactionId = transactionId;
    pair.credit.transactionId = transactionId;
    return this.createBalancedEntry(pair);
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

  // -------------------------------------------------------------------------
  // Public read operations
  // -------------------------------------------------------------------------

  /**
   * Get the balance for a specific account.
   * Computes net balance from all debit and credit entries.
   */
  async getAccountBalance(accountId: string): Promise<AccountBalance> {
    const accountEntries = await this.queryEntries({ account_id: accountId });

    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of accountEntries) {
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
      entryCount: accountEntries.length,
    };
  }

  /**
   * Get ledger entries linked to a specific Payload transaction.
   */
  async getTransactionEntries(transactionId: string): Promise<Ledger[]> {
    return this.queryEntries({ transaction_id: transactionId });
  }

  /**
   * Validate that a transaction's ledger entries are balanced.
   */
  async validateTransactionBalance(transactionId: string): Promise<boolean> {
    const txEntries = await this.getTransactionEntries(transactionId);

    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of txEntries) {
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
    }

    const difference = Math.abs(totalDebits - totalCredits);
    const balanced = difference < 0.001;

    if (!balanced) {
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
    const accountEntries = await this.queryAccountEntries(accountId, startDate, endDate);

    const debits: Array<{ amount: number; description: string; createdAt: string; reference?: string; metadata?: Record<string, unknown> | null }> = [];
    const credits: Array<{ amount: number; description: string; createdAt: string; reference?: string; metadata?: Record<string, unknown> | null }> = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of accountEntries) {
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
    const accountEntries = await this.queryAccountEntries(accountId, startDate, endDate);

    const dayMap = new Map<string, { debits: number; credits: number; count: number }>();
    for (const entry of accountEntries) {
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
    const accountEntries = await this.queryAccountEntries(accountId, startDate, endDate);

    const monthMap = new Map<string, { debits: number; credits: number; count: number }>();
    for (const entry of accountEntries) {
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
   * Similar to a bank statement -- shows every entry chronologically
   * with an opening and closing balance.
   */
  async getAccountStatement(
    accountId: string,
    startDate: string,
    endDate: string
  ): Promise<AccountStatement> {
    const allAccountEntries = await this.queryEntries({ account_id: accountId });

    let openingBalance = 0;
    const rangeEntries: Ledger[] = [];

    for (const entry of allAccountEntries) {
      const date = entry.createdAt || '';
      if (date < startDate) {
        openingBalance += entry.entryType === 'debit' ? entry.amount : -entry.amount;
      } else if (date <= endDate || !endDate) {
        rangeEntries.push(entry);
      }
    }

    rangeEntries.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    let runningBalance = openingBalance;
    let totalDebits = 0;
    let totalCredits = 0;

    const statementEntries = rangeEntries.map(entry => {
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
      entries: statementEntries,
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
      const accountEntries = asOfDate
        ? await this.queryAccountEntries(accountId, undefined, asOfDate)
        : await this.queryEntries({ account_id: accountId });

      let debits = 0;
      let credits = 0;

      for (const entry of accountEntries) {
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
   * Only exports entries for the current tenant.
   */
  async exportEntries(
    accountId: string,
    startDate?: string,
    endDate?: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<{ format: string; data: string; count: number }> {
    const accountEntries = await this.queryAccountEntries(accountId, startDate, endDate);

    const records = accountEntries.map(entry => ({
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

  // -------------------------------------------------------------------------
  // Utility methods
  // -------------------------------------------------------------------------

  /**
   * Get all entries stored in the ledger.
   * Returns from the local cache for backward-compatible synchronous access.
   * Useful for debugging and full export.
   */
  getAllEntries(): Ledger[] {
    return [...this.entries];
  }

  /**
   * Get all entries stored in the ledger for the current tenant (async version).
   * Use this when working with storage adapters.
   */
  async getAllEntriesAsync(): Promise<Ledger[]> {
    return this.queryEntries();
  }

  /**
   * Get all unique account IDs in the ledger.
   * Returns from the local cache for backward-compatible synchronous access.
   */
  getAccountIds(): string[] {
    const ids = new Set<string>();
    for (const entry of this.entries) {
      ids.add(entry.accountId);
    }
    return Array.from(ids);
  }

  /**
   * Get all unique account IDs in the ledger for the current tenant (async version).
   * Use this when working with storage adapters.
   */
  async getAccountIdsAsync(): Promise<string[]> {
    await this.ensureInitialized();
    return this.storage.getDistinctAccountIds(this.tenantId);
  }

  /**
   * Clear all ledger entries.
   * Clears both the local cache and storage (scoped to current tenant).
   * Useful for testing or resetting the local ledger.
   */
  clear(): void {
    this.entries.length = 0;
    this.idCounter = 0;

    // Also clear the storage adapter for the current tenant (fire-and-forget).
    this.storage.deleteLedgerEntries({ tenantId: this.tenantId }).catch(() => {
      // Best-effort cleanup
    });
  }

  /**
   * Clear ledger entries for the current tenant (async version).
   * Returns the number of entries deleted.
   */
  async clearAsync(): Promise<number> {
    await this.ensureInitialized();
    this.entries.length = 0;
    this.idCounter = 0;
    return this.storage.deleteLedgerEntries({ tenantId: this.tenantId });
  }

  /**
   * Import entries from a JSON string (previously exported).
   * Tags all imported entries with the current tenantId.
   * Returns the number of entries imported.
   */
  importEntries(jsonData: string): number {
    const records = JSON.parse(jsonData) as Array<Record<string, unknown>>;
    for (const record of records) {
      this.createLocalEntrySync({
        ...record,
        tenant_id: this.tenantId,
      });
    }
    return records.length;
  }

  /**
   * Import entries from parsed records (async version).
   * Tags all imported entries with the current tenantId.
   * Returns the number of entries imported.
   */
  async importEntriesAsync(records: Array<Record<string, unknown>>): Promise<number> {
    for (const record of records) {
      await this.createLocalEntry({
        ...record,
        tenant_id: this.tenantId,
      });
    }
    return records.length;
  }
}
