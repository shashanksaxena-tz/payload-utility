import { Model, ModelSpec } from '../core/model';

/**
 * Customer - Represents a customer in the Payload system.
 * Customers can have payment methods and transactions.
 */
export class Customer extends Model {
  static spec: ModelSpec = {
    object: 'customer',
    endpoint: '/customers',
  };

  get email(): string { return this.getStr('email'); }
  get name(): string { return this.getStr('name'); }
  get phone(): string { return this.getStr('phone'); }
  get status(): string { return this.getStr('status'); }
  get createdAt(): string { return this.getStr('created_at'); }
}
