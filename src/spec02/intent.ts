import { Model, ModelSpec } from '../core/model';

/**
 * Intent - Payment intent for multi-step payment flows (v2).
 *
 * Represents a checkout or payment flow intent, used for
 * embedded checkout plugins, payment forms, and payment
 * method collection.
 *
 * V2 object: intent
 * V2 endpoint: /intents
 * V2 ID prefix: int_
 */
export class Intent extends Model {
  static spec: ModelSpec = {
    object: 'intent',
    endpoint: '/intents',
  };

  get status(): string { return this.getStr('status'); }
  get type(): string { return this.getStr('type'); }
  get clientTokenId(): string { return this.getStr('client_token_id'); }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }
}
