import { Model, ModelSpec } from '../core/model';

/**
 * ProcessingAccount - Merchant processing account.
 *
 * Represents a merchant's payment processing configuration,
 * including fee structures, settlement settings, and
 * compliance information.
 */
export class ProcessingAccount extends Model {
  static spec: ModelSpec = {
    object: 'processing_account',
    endpoint: '/processing_accounts',
  };

  get entityId(): string { return this.getStr('entity_id'); }
  get status(): string { return this.getStr('status'); }
  get accountName(): string { return this.getStr('account_name'); }
  get processingType(): string { return this.getStr('processing_type'); }
  get settlementCycle(): string { return this.getStr('settlement_cycle'); }
  get createdAt(): string { return this.getStr('created_at'); }
}
