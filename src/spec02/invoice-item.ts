import { Model, ModelSpec } from '../core/model';

/**
 * InvoiceItem - Convenience alias for LineItem on an Invoice (V2 API).
 *
 * In V2, invoice items are stored as line_item objects at /line_items.
 * This class provides a convenience wrapper that uses the same
 * endpoint as LineItem.
 *
 * V2 object: line_item
 * V2 endpoint: /line_items
 */
export class InvoiceItem extends Model {
  static spec: ModelSpec = {
    object: 'line_item',
    endpoint: '/line_items',
  };

  get invoiceId(): string { return this.getStr('invoice_id'); }
  get description(): string { return this.getStr('description'); }
  get entryType(): string { return this.getStr('entry_type'); }
  get amount(): number { return this.getFloat('amount'); }
  get amountType(): string { return this.getStr('amount_type'); }
  get qty(): number { return this.getFloat('qty'); }
  get total(): number { return this.getFloat('total'); }
  get lineNumber(): number { return this.getInt('line_number'); }
  get type(): string { return this.getStr('type'); }
  get transactionId(): string { return this.getStr('transaction_id'); }
  get incurredDate(): string { return this.getStr('incurred_date'); }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }
}
