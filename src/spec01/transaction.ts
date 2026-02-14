import { Model, ModelSpec, ModelData } from '../core/model';
import { AppMetadata, MetadataManager, withMetadata } from '../core/metadata';

/**
 * V2 Transaction status object shape.
 * status is returned as { value: '...', code: '...' } from the API.
 */
export interface TransactionStatus {
  value: 'processing' | 'authorized' | 'processed' | 'declined' | 'rejected' | 'voided' | 'adjusted';
  code: string;
}

/**
 * V2 Transaction sender/receiver participant object shape.
 * Each side of the transaction has an account and payment method reference.
 */
export interface TransactionParticipant {
  account_id?: string;
  method_id?: string;
  account?: Record<string, unknown>;
  method?: Record<string, unknown>;
}

/** V2 transaction source types */
export type TransactionSource = 'api' | 'keyed' | 'swipe' | 'emv' | 'nfc' | 'googlepay' | 'applepay' | 'check';

/** V2 transaction transfer_type (read-only from API) */
export type TransferType = 'debit' | 'credit';

/** V2 transaction type discriminator values */
export type TransactionType = 'payment' | 'deposit' | 'withdraw' | 'refund' | 'payout';

/**
 * Transaction - Base transaction object in the Payload V2 API.
 * Parent class for Payment, Refund, Deposit, Withdraw, and Payout.
 *
 * V2 uses a sender/receiver pattern instead of flat customer_id/payment_method_id.
 * Status is an object { value, code } rather than a flat string.
 *
 * Uses polymorphic dispatch: subclasses set type discriminator.
 */
export class Transaction extends Model {
  static spec: ModelSpec = {
    object: 'transaction',
    endpoint: '/transactions',
  };

  // --- Core fields ---
  get amount(): number { return this.getFloat('amount'); }
  get type(): TransactionType { return this.getStr('type') as TransactionType; }
  get description(): string { return this.getStr('description'); }
  get notes(): string { return this.getStr('notes'); }
  get orderNumber(): string { return this.getStr('order_number'); }
  get createdAt(): string { return this.getStr('created_at'); }

  // --- Status (V2: object with value + code) ---
  get statusObject(): TransactionStatus | null {
    const raw = this.get('status');
    if (raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
      return raw as TransactionStatus;
    }
    return null;
  }

  get status(): string {
    const obj = this.statusObject;
    if (obj) return obj.value;
    // Fallback for raw string status
    const raw = this.get('status');
    return typeof raw === 'string' ? raw : '';
  }

  get statusCode(): string {
    const obj = this.statusObject;
    return obj ? obj.code : '';
  }

  // --- Sender (V2: replaces flat customer_id / payment_method_id for source) ---
  get sender(): TransactionParticipant | null {
    const raw = this.get('sender');
    return (raw && typeof raw === 'object') ? raw as TransactionParticipant : null;
  }

  get senderAccountId(): string {
    return this.sender?.account_id ?? '';
  }

  get senderMethodId(): string {
    return this.sender?.method_id ?? '';
  }

  // --- Receiver (V2: replaces flat customer_id / payment_method_id for destination) ---
  get receiver(): TransactionParticipant | null {
    const raw = this.get('receiver');
    return (raw && typeof raw === 'object') ? raw as TransactionParticipant : null;
  }

  get receiverAccountId(): string {
    return this.receiver?.account_id ?? '';
  }

  get receiverMethodId(): string {
    return this.receiver?.method_id ?? '';
  }

  // --- Source & transfer_type ---
  get source(): TransactionSource { return this.getStr('source') as TransactionSource; }
  get transferType(): TransferType { return this.getStr('transfer_type') as TransferType; }

  // --- Additional V2 fields ---
  get checkImages(): unknown { return this.get('check_images'); }
  get orderDetails(): unknown { return this.get('order_details'); }
  get shippingDetails(): unknown { return this.get('shipping_details'); }
  get attrs(): Record<string, unknown> | null {
    const raw = this.get('attrs');
    return (raw && typeof raw === 'object') ? raw as Record<string, unknown> : null;
  }

  // --- App Metadata tracking ---

  /** Extract AppMetadata from the transaction's attrs field. */
  get appMetadata(): AppMetadata | null {
    const raw = this.attrs;
    if (!raw) return null;
    const manager = new MetadataManager();
    const metadata = manager.fromPayloadAttrs(raw);
    // Return null if no metadata keys were found
    if (Object.keys(metadata).length === 0) return null;
    return metadata;
  }

  /** Get the correlation ID from attrs, or empty string. */
  get correlationId(): string {
    return this.attrs?.['app_metadata.correlation_id'] as string ?? '';
  }

  /** Get the app ID from attrs, or empty string. */
  get appId(): string {
    return this.attrs?.['app_metadata.app_id'] as string ?? '';
  }

  /** Get the tenant ID from attrs, or empty string. */
  get tenantId(): string {
    return this.attrs?.['app_metadata.tenant_id'] as string ?? '';
  }

  /** Get the order ID from attrs, or empty string. */
  get orderId(): string {
    return this.attrs?.['app_metadata.order_id'] as string ?? '';
  }

  /** Merge AppMetadata into a create/update data payload's attrs field. */
  static withTracking(
    data: Record<string, unknown>,
    metadata: AppMetadata
  ): Record<string, unknown> {
    return withMetadata(data, metadata);
  }

  /** Void this transaction (V2: update status to voided) */
  async void(): Promise<this> {
    return this.update({ status: { value: 'voided' } } as ModelData);
  }
}
