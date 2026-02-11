import { Model, ModelSpec } from '../core/model';

/**
 * ProcessingAgreement - Agreement for processing terms (v2).
 *
 * Defines the processing terms, fee structures, and
 * operational parameters for a processing account.
 */
export class ProcessingAgreement extends Model {
  static spec: ModelSpec = {
    object: 'processing_agreement',
    endpoint: '/processing_agreements',
  };

  get processingAccountId(): string { return this.getStr('processing_account_id'); }
  get status(): string { return this.getStr('status'); }
  get agreementType(): string { return this.getStr('agreement_type'); }
  get effectiveDate(): string { return this.getStr('effective_date'); }
  get feeSchedule(): Record<string, unknown> { return (this.get('fee_schedule') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
}
