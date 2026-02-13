import { Model, ModelSpec } from '../core/model';

/**
 * ProcessingAccount - Merchant processing account (v2).
 *
 * Represents a merchant's payment processing configuration,
 * including associated legal entity, settings, and status.
 *
 * V2 object: processing_account
 * V2 endpoint: /processing_accounts
 * V2 ID prefix: acct_
 */
export class ProcessingAccount extends Model {
  static spec: ModelSpec = {
    object: 'processing_account',
    endpoint: '/processing_accounts',
  };

  get name(): string { return this.getStr('name'); }
  get description(): string { return this.getStr('description'); }
  get status(): string { return this.getStr('status'); }
  get industry(): string { return this.getStr('industry'); }
  get legalEntityId(): string { return this.getStr('legal_entity_id'); }
  get parentOrgId(): string { return this.getStr('parent_org_id'); }
  get processingSettingsId(): string { return this.getStr('processing_settings_id'); }
  get processingSettings(): Record<string, unknown> { return (this.get('processing_settings') as Record<string, unknown>) || {}; }
  get legalEntity(): Record<string, unknown> { return (this.get('legal_entity') as Record<string, unknown>) || {}; }
  get paymentMethods(): unknown[] { return (this.get('payment_methods') as unknown[]) || []; }
  get billingContact(): Record<string, unknown> { return (this.get('billing_contact') as Record<string, unknown>) || {}; }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }
}
