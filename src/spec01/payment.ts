import { ModelSpec } from '../core/model';
import { Transaction } from './transaction';

/**
 * Payment - Polymorphic child of Transaction (V2).
 * Represents a payment (charge) transaction.
 *
 * V2 type discriminator: type='payment'
 * Endpoint: POST /transactions { type: 'payment', sender: {...}, receiver: {...}, amount: ... }
 */
export class Payment extends Transaction {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
    polymorphic: { type: 'payment' },
  };
}
