import { Model, ModelSpec } from '../core/model';

/**
 * WebhookLog - Log entry for a webhook delivery attempt (v2).
 *
 * Records the details of each webhook notification delivery,
 * including response status, timing, and trigger information.
 *
 * V2 object: webhook_log
 * V2 endpoint: /webhook_logs
 */
export class WebhookLog extends Model {
  static spec: ModelSpec = {
    object: 'webhook_log',
    endpoint: '/webhook_logs',
  };

  get webhookId(): string { return this.getStr('webhook_id'); }
  get trigger(): string { return this.getStr('trigger'); }
  get url(): string { return this.getStr('url'); }
  get httpStatus(): number { return this.getInt('http_status'); }
  get oauthStatus(): number { return this.getInt('oauth_status'); }
  get triggeredOn(): Record<string, unknown> { return (this.get('triggered_on') as Record<string, unknown>) || {}; }
  get attrs(): Record<string, unknown> { return (this.get('attrs') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
  get modifiedAt(): string { return this.getStr('modified_at'); }
}
