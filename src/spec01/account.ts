import { Model, ModelSpec } from '../core/model';

/**
 * Account - Base account object in the Payload API.
 * Represents a user or entity with API access.
 */
export class Account extends Model {
  static spec: ModelSpec = {
    object: 'account',
    endpoint: '/accounts',
  };

  get email(): string { return this.getStr('email'); }
  get name(): string { return this.getStr('name'); }
  get status(): string { return this.getStr('status'); }
  get createdAt(): string { return this.getStr('created_at'); }
}
