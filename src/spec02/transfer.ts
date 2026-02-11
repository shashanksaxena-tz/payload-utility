import { Model, ModelSpec } from '../core/model';

/**
 * Transfer - Fund transfer between accounts (v2).
 *
 * Facilitates movement of funds between processing accounts,
 * supporting marketplace payouts, vendor payments, and
 * commission distributions.
 */
export class Transfer extends Model {
  static spec: ModelSpec = {
    object: 'transfer',
    endpoint: '/transfers',
  };

  get amount(): number { return this.getFloat('amount'); }
  get currency(): string { return this.getStr('currency'); }
  get sourceAccountId(): string { return this.getStr('source_account_id'); }
  get destinationAccountId(): string { return this.getStr('destination_account_id'); }
  get status(): string { return this.getStr('status'); }
  get description(): string { return this.getStr('description'); }
  get transactionId(): string { return this.getStr('transaction_id'); }
  get createdAt(): string { return this.getStr('created_at'); }
}
