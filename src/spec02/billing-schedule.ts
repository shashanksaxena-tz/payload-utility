import { Model, ModelSpec, ModelData } from '../core/model';

/**
 * BillingSchedule - Automated recurring billing schedule.
 *
 * Manages recurring payment collection on defined intervals.
 * Supports daily, weekly, monthly, and yearly frequencies
 * with configurable start/end dates and retry policies.
 */
export class BillingSchedule extends Model {
  static spec: ModelSpec = {
    object: 'billing_schedule',
    endpoint: '/billing_schedules',
  };

  get customerId(): string { return this.getStr('customer_id'); }
  get amount(): number { return this.getFloat('amount'); }
  get frequency(): string { return this.getStr('frequency'); }
  get interval(): number { return this.getInt('interval'); }
  get status(): string { return this.getStr('status'); }
  get startDate(): string { return this.getStr('start_date'); }
  get endDate(): string { return this.getStr('end_date'); }
  get nextChargeDate(): string { return this.getStr('next_charge_date'); }
  get paymentMethodId(): string { return this.getStr('payment_method_id'); }
  get description(): string { return this.getStr('description'); }
  get createdAt(): string { return this.getStr('created_at'); }

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
