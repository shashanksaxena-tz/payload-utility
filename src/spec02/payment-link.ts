import { Model, ModelSpec } from '../core/model';

/**
 * PaymentLink - Shareable payment collection link (v2).
 *
 * Generates a hosted URL for collecting payments without
 * requiring direct API integration. Supports customizable
 * amounts, descriptions, and checkout options.
 *
 * V2 object: payment_link
 * V2 endpoint: /payment_links
 * V2 ID prefix: pay_
 */
export class PaymentLink extends Model {
  static spec: ModelSpec = {
    object: 'payment_link',
    endpoint: '/payment_links',
  };

  get url(): string { return this.getStr('url'); }
  get qrUrl(): string { return this.getStr('qr_url'); }
  get amount(): number { return this.getFloat('amount'); }
  get amountEditable(): boolean { return this.getBool('amount_editable'); }
  get description(): string { return this.getStr('description'); }
  get status(): string { return this.getStr('status'); }
  get type(): string { return this.getStr('type'); }
  get customerId(): string { return this.getStr('customer_id'); }
  get invoiceId(): string { return this.getStr('invoice_id'); }
  get transactionId(): string { return this.getStr('transaction_id'); }
  get processingId(): string { return this.getStr('processing_id'); }
  get processingSettingsId(): string { return this.getStr('processing_settings_id'); }
  get checkoutOptions(): Record<string, unknown> { return (this.get('checkout_options') as Record<string, unknown>) || {}; }
  get billingContact(): Record<string, unknown> { return (this.get('billing_contact') as Record<string, unknown>) || {}; }
  get notifications(): unknown { return this.get('notifications'); }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }
}
