import { Model, ModelSpec } from '../core/model';

/**
 * InvoiceItem - Individual item within an Invoice.
 *
 * Represents a single billable item or service on an invoice.
 */
export class InvoiceItem extends Model {
  static spec: ModelSpec = {
    object: 'invoice_item',
    endpoint: '/invoice_items',
  };

  get invoiceId(): string { return this.getStr('invoice_id'); }
  get description(): string { return this.getStr('description'); }
  get quantity(): number { return this.getFloat('quantity'); }
  get unitPrice(): number { return this.getFloat('unit_price'); }
  get amount(): number { return this.getFloat('amount'); }
  get createdAt(): string { return this.getStr('created_at'); }
}
