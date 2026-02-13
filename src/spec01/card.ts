import { ModelSpec } from '../core/model';
import { PaymentMethod } from './payment-method';

/**
 * Card - Polymorphic child of PaymentMethod (V2).
 * Represents a credit/debit card payment method.
 *
 * Fields: card_number (immutable), expiry (MM/YY or MMYYYY),
 * card_code (CVV), brand (read-only: visa, mastercard, american_express, discover)
 */
export class Card extends PaymentMethod {
  static spec: ModelSpec = {
    object: 'payment_method',
    endpoint: '/payment_methods',
    polymorphic: { type: 'card' },
  };

  get cardNumber(): string { return this.getStr('card_number'); }
  get expiry(): string { return this.getStr('expiry'); }
  get cardCode(): string { return this.getStr('card_code'); }
  get lastFour(): string { return this.getStr('last_four'); }
  get brand(): string { return this.getStr('brand'); }
}
