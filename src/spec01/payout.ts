import { ModelSpec } from '../core/model';
import { Transaction } from './transaction';

/**
 * Payout - Polymorphic child of Transaction (V2).
 * Represents a payout transaction.
 *
 * V2 type discriminator: type='payout'
 * Endpoint: POST /transactions { type: 'payout', sender: {...}, receiver: {...}, amount: ... }
 */
export class Payout extends Transaction {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
    polymorphic: { type: 'payout' },
  };
}
