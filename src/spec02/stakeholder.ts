import { Model, ModelSpec } from '../core/model';

/**
 * Stakeholder (LegalEntityOwner) - Individual associated with a Legal Entity (v2).
 *
 * Represents a person with an ownership or control interest
 * in a business entity (e.g., owner, officer, director).
 *
 * V2 object: legal_entity_owner
 * V2 endpoint: /legal_entity_owners
 * V2 ID prefix: ownr_
 */
export class Stakeholder extends Model {
  static spec: ModelSpec = {
    object: 'legal_entity_owner',
    endpoint: '/legal_entity_owners',
  };

  get legalEntityId(): string { return this.getStr('legal_entity_id'); }
  get firstName(): string { return this.getStr('first_name'); }
  get lastName(): string { return this.getStr('last_name'); }
  get fullName(): string { return this.getStr('full_name'); }
  get email(): string { return this.getStr('email'); }
  get phoneNumber(): string { return this.getStr('phone_number'); }
  get title(): string { return this.getStr('title'); }
  get type(): string { return this.getStr('type'); }
  get ownership(): number { return this.getFloat('ownership'); }
  get ssn(): string { return this.getStr('ssn'); }
  get legalId(): string { return this.getStr('legal_id'); }
  get birthDate(): string { return this.getStr('birth_date'); }
  get streetAddress(): string { return this.getStr('street_address'); }
  get unitNumber(): string { return this.getStr('unit_number'); }
  get city(): string { return this.getStr('city'); }
  get stateProvince(): string { return this.getStr('state_province'); }
  get postalCode(): string { return this.getStr('postal_code'); }
  get countryCode(): string { return this.getStr('country_code'); }
  get yearsOwned(): number { return this.getNum('years_owned'); }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }
}
