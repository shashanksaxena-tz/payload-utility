import { Model, ModelSpec } from '../core/model';

/**
 * WebhookLog - Log entry for a webhook delivery attempt.
 *
 * Records the details of each webhook notification delivery,
 * including response status, timing, and retry information.
 */
export class WebhookLog extends Model {
  static spec: ModelSpec = {
    object: 'webhook_log',
    endpoint: '/webhook_logs',
  };

  get webhookId(): string { return this.getStr('webhook_id'); }
  get eventType(): string { return this.getStr('event_type'); }
  get url(): string { return this.getStr('url'); }
  get requestBody(): string { return this.getStr('request_body'); }
  get responseStatus(): number { return this.getInt('response_status'); }
  get responseBody(): string { return this.getStr('response_body'); }
  get success(): boolean { return this.getBool('success'); }
  get attemptNumber(): number { return this.getInt('attempt_number'); }
  get deliveredAt(): string { return this.getStr('delivered_at'); }
  get createdAt(): string { return this.getStr('created_at'); }
}
