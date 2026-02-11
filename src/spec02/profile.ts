import { Model, ModelSpec } from '../core/model';

/**
 * Profile - Business profile for processing applications (v2).
 *
 * Contains business classification and operational details
 * required for processing account underwriting.
 */
export class Profile extends Model {
  static spec: ModelSpec = {
    object: 'profile',
    endpoint: '/profiles',
  };

  get entityId(): string { return this.getStr('entity_id'); }
  get businessCategory(): string { return this.getStr('business_category'); }
  get mcc(): string { return this.getStr('mcc'); }
  get averageTransactionAmount(): number { return this.getFloat('average_transaction_amount'); }
  get monthlyVolume(): number { return this.getFloat('monthly_volume'); }
  get status(): string { return this.getStr('status'); }
  get createdAt(): string { return this.getStr('created_at'); }
}
