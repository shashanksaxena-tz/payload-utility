import { Model, ModelSpec } from '../core/model';

/**
 * PaymentMethod - Base payment method object (V2).
 * Parent class for Card and BankAccount.
 *
 * V2 id prefix: pm_
 * Uses account_id (acct_ pattern) instead of customer_id.
 * Types: 'card' | 'bank_account' | 'synthetic'
 */
export class PaymentMethod extends Model {
  static spec: ModelSpec = {
    object: 'payment_method',
    endpoint: '/payment_methods',
  };

  get type(): string { return this.getStr('type'); }
  get accountId(): string { return this.getStr('account_id'); }
  get accountHolder(): string { return this.getStr('account_holder'); }
  get status(): string { return this.getStr('status'); }
  get keepActive(): boolean { return this.getBool('keep_active'); }
  get verificationStatus(): string { return this.getStr('verification_status'); }
  get accountDefaults(): Record<string, unknown> | null {
    const val = this.get('account_defaults');
    return val && typeof val === 'object' ? val as Record<string, unknown> : null;
  }
  get billingAddress(): Record<string, unknown> | null {
    const val = this.get('billing_address');
    return val && typeof val === 'object' ? val as Record<string, unknown> : null;
  }
  get attrs(): Record<string, unknown> | null {
    const val = this.get('attrs');
    return val && typeof val === 'object' ? val as Record<string, unknown> : null;
  }
  get createdAt(): string { return this.getStr('created_at'); }
}
