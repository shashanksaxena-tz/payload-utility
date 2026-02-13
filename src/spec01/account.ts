import { Model, ModelSpec, ModelData } from '../core/model';

/**
 * Account - Base account object in the Payload V2 API.
 * All accounts live at /accounts. Customers and processing accounts
 * are polymorphic subtypes distinguished by the `type` field.
 *
 * V2 fields:
 * - id: acct_[A-Za-z0-9]+ pattern
 * - type: 'processing' | 'customer'
 * - name: required, max 72 chars
 * - contact_details: { email, phone_number (10 digits), website, address }
 * - description: max 56 chars
 * - external_uid: max 64 chars
 * - attrs: custom attributes object
 * - entity_id: required if type=processing
 * - processing: object (if type=processing)
 */
export class Account extends Model {
  static spec: ModelSpec = {
    object: 'account',
    endpoint: '/accounts',
  };

  get name(): string { return this.getStr('name'); }
  get type(): string { return this.getStr('type'); }
  get description(): string { return this.getStr('description'); }
  get externalUid(): string { return this.getStr('external_uid'); }
  get entityId(): string { return this.getStr('entity_id'); }
  get status(): string { return this.getStr('status'); }
  get createdAt(): string { return this.getStr('created_at'); }

  /** Contact details object (email, phone_number, website, address) */
  get contactDetails(): ModelData {
    return (this.get('contact_details') as ModelData) || {};
  }

  get email(): string {
    const cd = this.contactDetails;
    return cd.email ? String(cd.email) : '';
  }

  get phoneNumber(): string {
    const cd = this.contactDetails;
    return cd.phone_number ? String(cd.phone_number) : '';
  }

  get website(): string {
    const cd = this.contactDetails;
    return cd.website ? String(cd.website) : '';
  }

  /** Custom attributes */
  get attrs(): ModelData {
    return (this.get('attrs') as ModelData) || {};
  }

  /** Processing config (only for type=processing) */
  get processing(): ModelData {
    return (this.get('processing') as ModelData) || {};
  }
}
