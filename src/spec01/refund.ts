import { ModelSpec } from '../core/model';
import { Transaction } from './transaction';

/**
 * Refund - Polymorphic child of Transaction.
 * Represents a refund transaction.
 */
export class Refund extends Transaction {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
    polymorphic: { type: 'refund' },
  };

  get linkedTransactionId(): string { return this.getStr('linked_transaction_id'); }
}
