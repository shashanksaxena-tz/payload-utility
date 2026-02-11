import { Model, ModelSpec } from '../core/model';

/**
 * PaymentLink - Shareable payment collection link.
 *
 * Generates a hosted URL for collecting payments without
 * requiring direct API integration. Supports customizable
 * amounts, descriptions, and expiration.
 */
export class PaymentLink extends Model {
  static spec: ModelSpec = {
    object: 'payment_link',
    endpoint: '/payment_links',
  };

  get url(): string { return this.getStr('url'); }
  get amount(): number { return this.getFloat('amount'); }
  get currency(): string { return this.getStr('currency'); }
  get description(): string { return this.getStr('description'); }
  get status(): string { return this.getStr('status'); }
  get expiresAt(): string { return this.getStr('expires_at'); }
  get createdAt(): string { return this.getStr('created_at'); }
}
