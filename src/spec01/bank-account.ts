import { ModelSpec } from '../core/model';
import { PaymentMethod } from './payment-method';

/**
 * BankAccount - Polymorphic child of PaymentMethod (V2).
 * Represents a bank account payment method.
 *
 * Fields: account_number (immutable), routing_number (9-digit, immutable),
 * account_type ('checking'|'savings', immutable),
 * account_class ('personal'|'business', immutable),
 * currency ('USD'|'CAD'), bank_name (read-only)
 */
export class BankAccount extends PaymentMethod {
  static spec: ModelSpec = {
    object: 'payment_method',
    endpoint: '/payment_methods',
    polymorphic: { type: 'bank_account' },
  };

  get accountNumber(): string { return this.getStr('account_number'); }
  get routingNumber(): string { return this.getStr('routing_number'); }
  get accountType(): string { return this.getStr('account_type'); }
  get accountClass(): string { return this.getStr('account_class'); }
  get currency(): string { return this.getStr('currency'); }
  get bankName(): string { return this.getStr('bank_name'); }
}
