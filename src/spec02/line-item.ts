import { Model, ModelSpec } from '../core/model';

/**
 * LineItem - Base line item for transaction-level entries.
 *
 * Polymorphic parent for ChargeItem and PaymentItem.
 * Used in ledger-style accounting within the Payload system.
 */
export class LineItem extends Model {
  static spec: ModelSpec = {
    object: 'line_item',
    endpoint: '/line_items',
  };

  get entryType(): string { return this.getStr('entry_type'); }
  get amount(): number { return this.getFloat('amount'); }
  get description(): string { return this.getStr('description'); }
  get transactionId(): string { return this.getStr('transaction_id'); }
  get invoiceId(): string { return this.getStr('invoice_id'); }
  get createdAt(): string { return this.getStr('created_at'); }
}

/**
 * ChargeItem - Polymorphic child of LineItem (entry_type: 'charge').
 * Represents a debit/charge entry.
 */
export class ChargeItem extends LineItem {
  static spec: ModelSpec = {
    object: 'line_item',
    endpoint: '/line_items',
    polymorphic: { entry_type: 'charge' },
  };
}

/**
 * PaymentItem - Polymorphic child of LineItem (entry_type: 'payment').
 * Represents a credit/payment entry.
 */
export class PaymentItem extends LineItem {
  static spec: ModelSpec = {
    object: 'line_item',
    endpoint: '/line_items',
    polymorphic: { entry_type: 'payment' },
  };
}
