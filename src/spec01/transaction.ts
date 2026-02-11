import { Model, ModelSpec, ModelData } from '../core/model';

/**
 * Transaction - Base transaction object in the Payload API.
 * Parent class for Payment, Refund, Credit, and Deposit.
 *
 * Uses polymorphic dispatch: subclasses set type discriminator.
 */
export class Transaction extends Model {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
  };

  get amount(): number { return this.getFloat('amount'); }
  get status(): string { return this.getStr('status'); }
  get type(): string { return this.getStr('type'); }
  get description(): string { return this.getStr('description'); }
  get accountId(): string { return this.getStr('account_id'); }
  get paymentMethodId(): string { return this.getStr('payment_method_id'); }
  get createdAt(): string { return this.getStr('created_at'); }

  /** Void this transaction */
  async void(): Promise<this> {
    return this.update({ status: 'voided' } as ModelData);
  }
}
