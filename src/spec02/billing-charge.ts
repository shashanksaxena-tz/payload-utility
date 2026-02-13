import { Model, ModelSpec } from '../core/model';

/**
 * BillingCharge - Individual charge within a BillingSchedule (V2 API).
 *
 * Represents a single billing charge on a recurring schedule.
 *
 * V2 object: billing_charge
 * V2 endpoint: /billing_charges
 * V2 ID prefix: bcrg_
 */
export class BillingCharge extends Model {
  static spec: ModelSpec = {
    object: 'billing_charge',
    endpoint: '/billing_charges',
  };

  get billingScheduleId(): string { return this.getStr('billing_schedule_id'); }
  get amount(): number { return this.getFloat('amount'); }
  get description(): string { return this.getStr('description'); }
  get qty(): number { return this.getFloat('qty'); }
  get total(): number { return this.getFloat('total'); }
  get type(): string { return this.getStr('type'); }
  get startDate(): string { return this.getStr('start_date'); }
  get endDate(): string { return this.getStr('end_date'); }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }
}
