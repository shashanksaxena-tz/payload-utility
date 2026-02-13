import { Model, ModelSpec } from '../core/model';

/**
 * Org - Organization account in the Payload system (v2).
 *
 * Represents an organizational entity with its own
 * settings, users, and processing configuration.
 *
 * V2 object: org
 * V2 endpoint: /orgs
 * V2 ID prefix: acct_
 */
export class Org extends Model {
  static spec: ModelSpec = {
    object: 'org',
    endpoint: '/orgs',
  };

  get name(): string { return this.getStr('name'); }
  get orgType(): string { return this.getStr('org_type'); }
  get industry(): string { return this.getStr('industry'); }
  get environ(): string { return this.getStr('environ'); }
  get phoneNumber(): string { return this.getStr('phone_number'); }
  get timezone(): string { return this.getStr('timezone'); }
  get legalEntityId(): string { return this.getStr('legal_entity_id'); }
  get parentOrgId(): string { return this.getStr('parent_org_id'); }
  get primaryProcessingId(): string { return this.getStr('primary_processing_id'); }
  get processingSettingsId(): string { return this.getStr('processing_settings_id'); }
  get processingSettings(): Record<string, unknown> { return (this.get('processing_settings') as Record<string, unknown>) || {}; }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }
}
