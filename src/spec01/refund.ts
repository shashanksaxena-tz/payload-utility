import { ModelSpec } from '../core/model';
import { Transaction } from './transaction';

/**
 * Refund - Polymorphic child of Transaction (V2).
 * Represents a refund transaction.
 *
 * V2 type discriminator: type='refund'
 * Endpoint: POST /transactions { type: 'refund', sender: {...}, receiver: {...}, amount: ... }
 *
 * In V2, refunds use the sender/receiver pattern inherited from Transaction.
 * The original transaction reference is conveyed through the sender/receiver
 * account and method IDs rather than a flat linked_transaction_id field.
 */
export class Refund extends Transaction {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
    polymorphic: { type: 'refund' },
  };
}
