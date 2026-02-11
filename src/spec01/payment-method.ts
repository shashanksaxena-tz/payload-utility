import { Model, ModelSpec } from '../core/model';

/**
 * PaymentMethod - Base payment method object.
 * Parent class for Card and BankAccount.
 */
export class PaymentMethod extends Model {
  static spec: ModelSpec = {
    object: 'payment_method',
    endpoint: '/payment_methods',
  };

  get type(): string { return this.getStr('type'); }
  get accountId(): string { return this.getStr('account_id'); }
  get status(): string { return this.getStr('status'); }
  get createdAt(): string { return this.getStr('created_at'); }
}
