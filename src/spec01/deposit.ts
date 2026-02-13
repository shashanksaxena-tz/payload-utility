import { ModelSpec } from '../core/model';
import { Transaction } from './transaction';

/**
 * Deposit - Polymorphic child of Transaction (V2).
 * Represents a deposit transaction.
 *
 * V2 type discriminator: type='deposit'
 * Endpoint: POST /transactions { type: 'deposit', sender: {...}, receiver: {...}, amount: ... }
 */
export class Deposit extends Transaction {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
    polymorphic: { type: 'deposit' },
  };
}
