import { ModelSpec } from '../core/model';
import { Transaction } from './transaction';

/**
 * Credit - Polymorphic child of Transaction.
 * Represents a credit transaction (funds sent to customer).
 */
export class Credit extends Transaction {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
    polymorphic: { type: 'credit' },
  };
}
