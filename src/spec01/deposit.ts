import { ModelSpec } from '../core/model';
import { Transaction } from './transaction';

/**
 * Deposit - Polymorphic child of Transaction.
 * Represents a deposit transaction.
 */
export class Deposit extends Transaction {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
    polymorphic: { type: 'deposit' },
  };
}
