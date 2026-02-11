import { Model, ModelSpec } from '../core/model';

/**
 * Intent - Payment intent for two-step payment flows (v2).
 *
 * Represents the customer's intent to pay, used for
 * authorization-then-capture workflows and secure
 * client-side payment collection.
 */
export class Intent extends Model {
  static spec: ModelSpec = {
    object: 'intent',
    endpoint: '/intents',
  };

  get amount(): number { return this.getFloat('amount'); }
  get currency(): string { return this.getStr('currency'); }
  get status(): string { return this.getStr('status'); }
  get customerId(): string { return this.getStr('customer_id'); }
  get paymentMethodId(): string { return this.getStr('payment_method_id'); }
  get clientSecret(): string { return this.getStr('client_secret'); }
  get transactionId(): string { return this.getStr('transaction_id'); }
  get description(): string { return this.getStr('description'); }
  get metadata(): Record<string, unknown> { return (this.get('metadata') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
}
