import { ModelSpec } from '../core/model';
import { Transaction } from './transaction';

/**
 * Credit - Polymorphic child of Transaction.
 *
 * NOTE: In Payload V2, the 'credit' transaction type does not exist.
 * This class is kept for backward compatibility and maps to type='deposit'.
 * New code should use the Deposit class directly.
 *
 * @deprecated Use Deposit instead. Credit maps to type='deposit' in V2.
 */
export class Credit extends Transaction {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
    polymorphic: { type: 'deposit' },
  };
}
