import { Model, ModelSpec } from '../core/model';

/**
 * Ledger - Transaction ledger entry (TransactionLedger).
 *
 * Records individual debit/credit entries for transactions,
 * forming the basis of the two-way (double-entry) ledger system.
 * Each transaction generates complementary ledger entries to
 * maintain balanced books.
 */
export class Ledger extends Model {
  static spec: ModelSpec = {
    object: 'transaction_ledger',
    endpoint: '/transaction_ledgers',
  };

  get transactionId(): string { return this.getStr('transaction_id'); }
  get accountId(): string { return this.getStr('account_id'); }
  get amount(): number { return this.getFloat('amount'); }
  get entryType(): string { return this.getStr('entry_type'); }
  get balanceBefore(): number { return this.getFloat('balance_before'); }
  get balanceAfter(): number { return this.getFloat('balance_after'); }
  get description(): string { return this.getStr('description'); }
  get reference(): string { return this.getStr('reference'); }
  get createdAt(): string { return this.getStr('created_at'); }

  /** Check if this is a debit entry */
  get isDebit(): boolean {
    return this.entryType === 'debit';
  }

  /** Check if this is a credit entry */
  get isCredit(): boolean {
    return this.entryType === 'credit';
  }
}
