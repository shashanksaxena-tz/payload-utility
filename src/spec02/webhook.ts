import { Model, ModelSpec, ModelData } from '../core/model';

/**
 * Webhook - Webhook configuration for event notifications (v2).
 *
 * Configures HTTP endpoints to receive real-time notifications
 * for events occurring in the Payload system.
 *
 * V2 object: webhook
 * V2 endpoint: /webhooks
 * V2 uses 'trigger' field instead of 'events'
 */
export class Webhook extends Model {
  static spec: ModelSpec = {
    object: 'webhook',
    endpoint: '/webhooks',
  };

  get url(): string { return this.getStr('url'); }
  get trigger(): string { return this.getStr('trigger'); }
  get status(): string { return this.getStr('status'); }
  get paymentLinkId(): string { return this.getStr('payment_link_id'); }
  get referenceObject(): string { return this.getStr('reference_object'); }
  get oauthParams(): Record<string, unknown> { return (this.get('oauth_params') as Record<string, unknown>) || {}; }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }

  /** Enable this webhook */
  async enable(): Promise<this> {
    return this.update({ status: 'active' } as ModelData);
  }

  /** Disable this webhook */
  async disable(): Promise<this> {
    return this.update({ status: 'disabled' } as ModelData);
  }
}
