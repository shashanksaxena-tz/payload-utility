import { ModelSpec } from '../core/model';
import { PaymentMethod } from './payment-method';

/**
 * Card - Polymorphic child of PaymentMethod.
 * Represents a credit/debit card payment method.
 */
export class Card extends PaymentMethod {
  static spec: ModelSpec = {
    object: 'payment_method',
    endpoint: '/payment_methods',
    polymorphic: { type: 'card' },
  };

  get cardNumber(): string { return this.getStr('card_number'); }
  get expiry(): string { return this.getStr('expiry'); }
  get lastFour(): string { return this.getStr('last_four'); }
  get brand(): string { return this.getStr('brand'); }
}
