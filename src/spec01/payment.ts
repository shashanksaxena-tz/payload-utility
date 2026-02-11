import { ModelSpec } from '../core/model';
import { Transaction } from './transaction';

/**
 * Payment - Polymorphic child of Transaction.
 * Represents a payment (charge) transaction.
 */
export class Payment extends Transaction {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
    polymorphic: { type: 'payment' },
  };
}
