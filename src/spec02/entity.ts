import { Model, ModelSpec } from '../core/model';

/**
 * Entity - Business/legal entity in the Payload API (v2).
 *
 * Represents a legal business entity for processing account
 * applications and compliance. Contains business details,
 * stakeholders, and processing agreements.
 */
export class Entity extends Model {
  static spec: ModelSpec = {
    object: 'entity',
    endpoint: '/entities',
  };

  get legalName(): string { return this.getStr('legal_name'); }
  get dbaName(): string { return this.getStr('dba_name'); }
  get entityType(): string { return this.getStr('entity_type'); }
  get ein(): string { return this.getStr('ein'); }
  get website(): string { return this.getStr('website'); }
  get phone(): string { return this.getStr('phone'); }
  get email(): string { return this.getStr('email'); }
  get status(): string { return this.getStr('status'); }
  get address(): Record<string, unknown> { return (this.get('address') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
}
