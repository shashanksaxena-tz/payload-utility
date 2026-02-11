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
      }),
      this.session.Ledger.create({
        account_id: pair.credit.accountId,
        amount: pair.credit.amount,
        entry_type: 'credit',
        description: pair.credit.description,
        reference: pair.credit.reference || '',
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
    reason: string
  ): Promise<{ debit: Ledger; credit: Ledger }> {
    // Reverse: the original debit account gets a credit, and vice versa
    return this.createBalancedEntry({
      debit: {
        accountId: originalCreditAccountId,
        amount,
        entryType: 'debit',
        description: `REVERSAL: ${reason}`,
        reference: `reversal`,
      },
      credit: {
        accountId: originalDebitAccountId,
        amount,
        entryType: 'credit',
        description: `REVERSAL: ${reason}`,
        reference: `reversal`,
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
    debits: Array<{ amount: number; description: string; createdAt: string }>;
    credits: Array<{ amount: number; description: string; createdAt: string }>;
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

    const debits: Array<{ amount: number; description: string; createdAt: string }> = [];
    const credits: Array<{ amount: number; description: string; createdAt: string }> = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of entries) {
      const item = {
        amount: entry.amount,
        description: entry.description,
        createdAt: entry.createdAt,
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
}

// Type helper for dynamic attr access
interface AttrChainLike {
  gte(value: unknown): Filter;
  lte(value: unknown): Filter;
}
