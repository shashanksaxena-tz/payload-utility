import { Model, ModelSpec } from '../core/model';

/**
 * AccessToken - API access token object.
 */
export class AccessToken extends Model {
  static spec: ModelSpec = {
    object: 'access_token',
    endpoint: '/access_tokens',
  };

  get token(): string { return this.getStr('token'); }
  get expiresAt(): string { return this.getStr('expires_at'); }
}

/**
 * ClientToken - Client-side access token (polymorphic child of AccessToken).
 * Used for browser-safe tokenization.
 */
export class ClientToken extends AccessToken {
  static spec: ModelSpec = {
    object: 'access_token',
    endpoint: '/access_tokens',
    polymorphic: { type: 'client' },
  };
}
