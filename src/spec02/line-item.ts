import { Model, ModelSpec } from '../core/model';

/**
 * LineItem - Line item for invoice entries (V2 API).
 *
 * Polymorphic parent for ChargeItem and PaymentItem.
 *
 * V2 object: line_item
 * V2 endpoint: /line_items
 * V2 ID prefix: item_
 */
export class LineItem extends Model {
  static spec: ModelSpec = {
    object: 'line_item',
    endpoint: '/line_items',
  };

  get entryType(): string { return this.getStr('entry_type'); }
  get type(): string { return this.getStr('type'); }
  get amount(): number { return this.getFloat('amount'); }
  get amountType(): string { return this.getStr('amount_type'); }
  get description(): string { return this.getStr('description'); }
  get qty(): number { return this.getFloat('qty'); }
  get total(): number { return this.getFloat('total'); }
  get lineNumber(): number { return this.getInt('line_number'); }
  get transactionId(): string { return this.getStr('transaction_id'); }
  get invoiceId(): string { return this.getStr('invoice_id'); }
  get incurredDate(): string { return this.getStr('incurred_date'); }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }
}

/**
 * ChargeItem - Polymorphic child of LineItem (entry_type: 'charge').
 * Represents a debit/charge entry on an invoice.
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
 * Represents a credit/payment entry on an invoice.
 */
export class PaymentItem extends LineItem {
  static spec: ModelSpec = {
    object: 'line_item',
    endpoint: '/line_items',
    polymorphic: { entry_type: 'payment' },
  };
}
