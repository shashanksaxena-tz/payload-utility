import { ModelSpec } from '../core/model';
import { Transaction } from './transaction';

/**
 * Withdraw - Polymorphic child of Transaction (V2).
 * Represents a withdrawal transaction.
 *
 * V2 type discriminator: type='withdraw'
 * Endpoint: POST /transactions { type: 'withdraw', sender: {...}, receiver: {...}, amount: ... }
 */
export class Withdraw extends Transaction {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
    polymorphic: { type: 'withdraw' },
  };
}
