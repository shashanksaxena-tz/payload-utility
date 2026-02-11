import { Model, ModelSpec } from '../core/model';

/**
 * Org - Organization account in the Payload system.
 *
 * Represents an organizational entity with its own
 * settings, users, and processing configuration.
 */
export class Org extends Model {
  static spec: ModelSpec = {
    object: 'org',
    endpoint: '/accounts/orgs',
  };

  get name(): string { return this.getStr('name'); }
  get status(): string { return this.getStr('status'); }
  get settings(): Record<string, unknown> { return (this.get('settings') as Record<string, unknown>) || {}; }
  get createdAt(): string { return this.getStr('created_at'); }
}
