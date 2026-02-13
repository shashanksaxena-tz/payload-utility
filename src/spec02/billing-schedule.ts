import { Model, ModelSpec, ModelData } from '../core/model';

/**
 * BillingSchedule - Automated recurring billing schedule (V2 API).
 *
 * Uses the biller/payer pattern:
 * - biller: { account_id, method_id } - the merchant
 * - payer: { account_id, method_id } - the customer
 *
 * V2 object: billing_schedule
 * V2 endpoint: /billing_schedules
 * V2 ID prefix: bscd_
 */
export class BillingSchedule extends Model {
  static spec: ModelSpec = {
    object: 'billing_schedule',
    endpoint: '/billing_schedules',
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

  // --- Recurring schedule config ---
  get recurringSchedule(): Record<string, unknown> {
    return (this.get('recurring_schedule') as Record<string, unknown>) || {};
  }
  get scheduleType(): string {
    const rs = this.recurringSchedule;
    return rs.type ? String(rs.type) : '';
  }
  get billingDay(): number {
    const rs = this.recurringSchedule;
    return rs.billing_day ? Number(rs.billing_day) : 0;
  }
  get billingWeekday(): string {
    const rs = this.recurringSchedule;
    return rs.billing_weekday ? String(rs.billing_weekday) : '';
  }
  get billingWeek(): number {
    const rs = this.recurringSchedule;
    return rs.billing_week ? Number(rs.billing_week) : 0;
  }

  // --- Core fields ---
  get status(): string { return this.getStr('status'); }
  get startDate(): string { return this.getStr('start_date'); }
  get endDate(): string { return this.getStr('end_date'); }
  get description(): string { return this.getStr('description'); }
  get type(): string { return this.getStr('type'); }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }

  // --- Items and nested collections ---
  get items(): unknown[] {
    return (this.get('items') as unknown[]) || [];
  }
  get charges(): unknown[] {
    return (this.get('charges') as unknown[]) || [];
  }
  get invoices(): unknown[] {
    return (this.get('invoices') as unknown[]) || [];
  }
  get attrs(): Record<string, unknown> {
    return (this.get('attrs') as Record<string, unknown>) || {};
  }

  // --- Totals (read-only from API) ---
  get totals(): Record<string, unknown> {
    return (this.get('totals') as Record<string, unknown>) || {};
  }
  get totalAmount(): number {
    const t = this.totals;
    return t.total ? Number(t.total) : 0;
  }
  get totalPaid(): number {
    const t = this.totals;
    return t.paid ? Number(t.paid) : 0;
  }
  get balanceDue(): number {
    const t = this.totals;
    return t.balance_due ? Number(t.balance_due) : 0;
  }
  get recurringAmount(): number {
    const t = this.totals;
    return t.recurring_amount ? Number(t.recurring_amount) : 0;
  }

  /** Pause this billing schedule */
  async pause(): Promise<this> {
    return this.update({ status: 'paused' } as ModelData);
  }

  /** Resume a paused billing schedule */
  async resume(): Promise<this> {
    return this.update({ status: 'active' } as ModelData);
  }

  /** Cancel this billing schedule */
  async cancel(): Promise<this> {
    return this.update({ status: 'cancelled' } as ModelData);
  }
}
