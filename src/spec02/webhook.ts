import { Model, ModelSpec, ModelData } from '../core/model';

/**
 * Webhook - Webhook configuration for event notifications.
 *
 * Configures HTTP endpoints to receive real-time notifications
 * for events occurring in the Payload system.
 */
export class Webhook extends Model {
  static spec: ModelSpec = {
    object: 'webhook',
    endpoint: '/webhooks',
  };

  get url(): string { return this.getStr('url'); }
  get events(): unknown[] { return (this.get('events') as unknown[]) || []; }
  get status(): string { return this.getStr('status'); }
  get secret(): string { return this.getStr('secret'); }
  get createdAt(): string { return this.getStr('created_at'); }

  /** Enable this webhook */
  async enable(): Promise<this> {
    return this.update({ status: 'active' } as ModelData);
  }

  /** Disable this webhook */
  async disable(): Promise<this> {
    return this.update({ status: 'disabled' } as ModelData);
  }
}
