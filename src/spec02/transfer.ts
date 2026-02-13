import { Model, ModelSpec } from '../core/model';

/**
 * Transfer - Fund transfer between accounts (v2).
 *
 * In V2, transfers are handled as transactions with specific
 * entry_type in the TransactionLedger. This model provides
 * a convenience wrapper around the /transactions endpoint
 * for transfer-type operations.
 *
 * Note: V2 does not have a separate /transfers endpoint.
 * Transfers are transactions. The Operation model (/operations)
 * tracks the processing lifecycle.
 */
export class Transfer extends Model {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
    polymorphic: { type: 'transfer' },
  };

  get amount(): number { return this.getFloat('amount'); }
  get currency(): string { return this.getStr('currency'); }
  get status(): string { return this.getStr('status'); }
  get description(): string { return this.getStr('description'); }
  get senderId(): string { return this.getStr('sender_id'); }
  get receiverId(): string { return this.getStr('receiver_id'); }
  get accountId(): string { return this.getStr('account_id'); }
  get paymentMethodId(): string { return this.getStr('payment_method_id'); }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }
}
