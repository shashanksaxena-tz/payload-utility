import { Model, ModelSpec } from '../core/model';

/**
 * Ledger - Local double-entry ledger entry.
 *
 * Records individual debit/credit entries for the local bookkeeping system.
 * Each entry is stored in-memory by the LedgerManager and can be linked
 * to real Payload transaction IDs for reconciliation.
 *
 * Note: The Payload V2 API does not have a dedicated ledger endpoint.
 * This model serves as a typed data container for local ledger entries
 * managed by LedgerManager.
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
  get metadata(): Record<string, unknown> | null {
    const val = this.get('metadata');
    if (val && typeof val === 'object') return val as Record<string, unknown>;
    return null;
  }
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
