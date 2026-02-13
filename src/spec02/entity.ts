import { Model, ModelSpec } from '../core/model';

/**
 * Entity - Legal Entity in the Payload API (v2).
 *
 * Represents a legal business entity for processing account
 * applications and compliance. Contains business details,
 * owners, and processing configuration.
 *
 * V2 object: entity
 * V2 endpoint: /entities
 * V2 ID prefix: ent_
 * V2 type values: 'individual' | 'business'
 *
 * Required fields for creation:
 * - legal_name, type, phone_number, country
 * - tax_id: { value: string } (type is read-only, auto-set by API)
 * - If type='business': business: { category, structure, formation, website }
 */
export class Entity extends Model {
  static spec: ModelSpec = {
    object: 'entity',
    endpoint: '/entities',
  };

  get legalName(): string { return this.getStr('legal_name'); }
  get type(): string { return this.getStr('type'); }
  get country(): string { return this.getStr('country'); }
  get phoneNumber(): string { return this.getStr('phone_number'); }
  get status(): string { return this.getStr('status'); }
  get taxId(): Record<string, unknown> { return (this.get('tax_id') as Record<string, unknown>) || {}; }
  get address(): Record<string, unknown> { return (this.get('address') as Record<string, unknown>) || {}; }
  get business(): Record<string, unknown> { return (this.get('business') as Record<string, unknown>) || {}; }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get owners(): unknown[] { return (this.get('owners') as unknown[]) || []; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }
}
