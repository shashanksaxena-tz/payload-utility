import { Model, ModelSpec, ModelData } from '../core/model';

/**
 * Invoice - Invoice object for billing in the Payload V2 API.
 *
 * Uses the biller/payer pattern:
 * - biller: { account_id, method_id } - the merchant sending the invoice
 * - payer: { account_id, method_id } - the customer receiving the invoice
 *
 * ID prefix: inv_
 * Endpoint: /invoices
 */
export class Invoice extends Model {
  static spec: ModelSpec = {
    object: 'invoice',
    endpoint: '/invoices',
  };

  // --- Biller (merchant) ---
  get biller(): Record<string, unknown> {
    return (this.get('biller') as Record<string, unknown>) || {};
  }
  get billerAccountId(): string {
    const b = this.biller;
    return b.account_id ? String(b.account_id) : '';
  }
  get billerMethodId(): string {
    const b = this.biller;
    return b.method_id ? String(b.method_id) : '';
  }

  // --- Payer (customer) ---
  get payer(): Record<string, unknown> {
    return (this.get('payer') as Record<string, unknown>) || {};
  }
  get payerAccountId(): string {
    const p = this.payer;
    return p.account_id ? String(p.account_id) : '';
  }
  get payerMethodId(): string {
    const p = this.payer;
    return p.method_id ? String(p.method_id) : '';
  }

  // --- Core fields ---
  get number(): string { return this.getStr('number'); }
  get status(): string { return this.getStr('status'); }
  get type(): string { return this.getStr('type'); }
  get dueDate(): string { return this.getStr('due_date'); }
  get description(): string { return this.getStr('description'); }
  get defaultTaxRate(): number { return this.getFloat('default_tax_rate'); }
  get createdAt(): string { return this.getStr('created_at'); }

  // --- Totals (read-only from API) ---
  get totals(): Record<string, unknown> {
    return (this.get('totals') as Record<string, unknown>) || {};
  }
  get balanceDue(): number {
    const t = this.totals;
    return t.balance_due ? Number(t.balance_due) : 0;
  }
  get totalPaid(): number {
    const t = this.totals;
    return t.paid ? Number(t.paid) : 0;
  }
  get subtotal(): number {
    const t = this.totals;
    return t.subtotal ? Number(t.subtotal) : 0;
  }
  get tax(): number {
    const t = this.totals;
    return t.tax ? Number(t.tax) : 0;
  }
  get total(): number {
    const t = this.totals;
    return t.total ? Number(t.total) : 0;
  }

  // --- Nested collections ---
  get items(): unknown[] {
    return (this.get('items') as unknown[]) || [];
  }
  get payments(): unknown[] {
    return (this.get('payments') as unknown[]) || [];
  }
  get paymentLinks(): unknown[] {
    return (this.get('payment_links') as unknown[]) || [];
  }
  get autopaySettings(): Record<string, unknown> {
    return (this.get('autopay_settings') as Record<string, unknown>) || {};
  }

  /** Mark invoice as paid */
  async markPaid(): Promise<this> {
    return this.update({ status: 'paid' } as ModelData);
  }

  /** Close this invoice */
  async close(): Promise<this> {
    return this.update({ status: 'closed' } as ModelData);
  }
}
