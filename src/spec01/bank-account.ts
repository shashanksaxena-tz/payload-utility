import { ModelSpec } from '../core/model';
import { PaymentMethod } from './payment-method';

/**
 * BankAccount - Polymorphic child of PaymentMethod.
 * Represents a bank account payment method.
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
}
