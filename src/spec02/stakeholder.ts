import { Model, ModelSpec } from '../core/model';

/**
 * Stakeholder - Individual associated with an Entity (v2).
 *
 * Represents a person with an ownership or control interest
 * in a business entity (e.g., owner, officer, director).
 */
export class Stakeholder extends Model {
  static spec: ModelSpec = {
    object: 'stakeholder',
    endpoint: '/stakeholders',
  };

  get entityId(): string { return this.getStr('entity_id'); }
  get firstName(): string { return this.getStr('first_name'); }
  get lastName(): string { return this.getStr('last_name'); }
  get email(): string { return this.getStr('email'); }
  get phone(): string { return this.getStr('phone'); }
  get title(): string { return this.getStr('title'); }
  get ownershipPercentage(): number { return this.getFloat('ownership_percentage'); }
  get ssn(): string { return this.getStr('ssn'); }
  get dateOfBirth(): string { return this.getStr('date_of_birth'); }
  get address(): Record<string, unknown> { return (this.get('address') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
}
