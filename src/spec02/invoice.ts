import { Model, ModelSpec, ModelData } from '../core/model';

/**
 * Invoice - Invoice object for billing customers.
 *
 * Represents a detailed bill sent to a customer, containing line items,
 * payment tracking, and due date management.
 */
export class Invoice extends Model {
  static spec: ModelSpec = {
    object: 'invoice',
    endpoint: '/invoices',
  };

  get customerId(): string { return this.getStr('customer_id'); }
  get number(): string { return this.getStr('number'); }
  get status(): string { return this.getStr('status'); }
  get totalAmount(): number { return this.getFloat('total_amount'); }
  get amountDue(): number { return this.getFloat('amount_due'); }
  get amountPaid(): number { return this.getFloat('amount_paid'); }
  get currency(): string { return this.getStr('currency'); }
  get dueDate(): string { return this.getStr('due_date'); }
  get issuedDate(): string { return this.getStr('issued_date'); }
  get description(): string { return this.getStr('description'); }
  get createdAt(): string { return this.getStr('created_at'); }

  /** Mark invoice as sent */
  async send(): Promise<this> {
    return this.update({ status: 'sent' } as ModelData);
  }

  /** Mark invoice as paid */
  async markPaid(): Promise<this> {
    return this.update({ status: 'paid' } as ModelData);
  }

  /** Void this invoice */
  async void(): Promise<this> {
    return this.update({ status: 'voided' } as ModelData);
  }
}
