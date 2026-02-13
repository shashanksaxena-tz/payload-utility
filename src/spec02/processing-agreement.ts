import { Model, ModelSpec } from '../core/model';

/**
 * Operation - Transaction operation in the Payload API (v2).
 *
 * Represents an operation performed on a transaction, such as
 * authorize, process, finalize, void, reject, or clear.
 *
 * V2 object: operation
 * V2 endpoint: /operations
 * V2 ID prefix: op_
 *
 * Note: This replaces the old ProcessingAgreement. The class name
 * is kept as ProcessingAgreement for backward compatibility but
 * the underlying V2 API object is 'operation'.
 */
export class ProcessingAgreement extends Model {
  static spec: ModelSpec = {
    object: 'operation',
    endpoint: '/operations',
  };

  get amount(): number { return this.getFloat('amount'); }
  get status(): string { return this.getStr('status'); }
  get type(): string { return this.getStr('type'); }
  get transactionId(): string { return this.getStr('transaction_id'); }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }
}
