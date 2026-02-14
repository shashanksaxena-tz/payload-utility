/**
 * Metadata tracking system for linking SDK operations back to the integrating application.
 *
 * Provides a standard way to attach application-specific context (app ID, tenant,
 * user, order reference, correlation ID, tags, custom data) to every Payload API
 * request, and to parse that context back from API responses.
 */

import { deepClone } from './utils';

/** Standard metadata fields every payment/operation can carry. */
export interface AppMetadata {
  /** The integrating application's identifier */
  appId?: string;
  /** Tenant or organization in the integrating app */
  tenantId?: string;
  /** User who initiated the action */
  userId?: string;
  /** The app's order or invoice reference */
  orderId?: string;
  /** Correlation ID for tracing across systems */
  correlationId?: string;
  /** Arbitrary tags for categorization */
  tags?: string[];
  /** Any additional app-specific data */
  custom?: Record<string, unknown>;
}

/** Keys used when serializing metadata into Payload API attrs. */
const METADATA_PREFIX = 'app_metadata';

const KNOWN_KEYS: (keyof AppMetadata)[] = [
  'appId',
  'tenantId',
  'userId',
  'orderId',
  'correlationId',
  'tags',
  'custom',
];

/**
 * MetadataManager - manages default metadata and merging for SDK operations.
 */
export class MetadataManager {
  private _defaults: AppMetadata;

  constructor(defaults?: Partial<AppMetadata>) {
    this._defaults = defaults ? deepClone(defaults) as AppMetadata : {};
  }

  /** Update default metadata applied to all operations. */
  setDefaults(defaults: Partial<AppMetadata>): void {
    this._defaults = deepClone(defaults) as AppMetadata;
  }

  /** Get current default metadata. */
  getDefaults(): AppMetadata {
    return deepClone(this._defaults);
  }

  /** Merge defaults with per-operation overrides. Overrides take precedence. */
  merge(override?: Partial<AppMetadata>): AppMetadata {
    if (!override) {
      return deepClone(this._defaults);
    }

    const merged: AppMetadata = deepClone(this._defaults);

    for (const key of KNOWN_KEYS) {
      if (override[key] !== undefined) {
        if (key === 'tags') {
          // Merge tag arrays, deduplicate
          const defaultTags = merged.tags || [];
          const overrideTags = override.tags || [];
          merged.tags = [...new Set([...defaultTags, ...overrideTags])];
        } else if (key === 'custom') {
          // Deep merge custom objects
          merged.custom = {
            ...(merged.custom || {}),
            ...(override.custom || {}),
          };
        } else {
          (merged as Record<string, unknown>)[key] = override[key];
        }
      }
    }

    return merged;
  }

  /**
   * Serialize metadata into Payload API `attrs` field format.
   * Produces a flat record keyed under `app_metadata.*`.
   */
  toPayloadAttrs(metadata: AppMetadata): Record<string, unknown> {
    const attrs: Record<string, unknown> = {};

    if (metadata.appId !== undefined) {
      attrs[`${METADATA_PREFIX}.app_id`] = metadata.appId;
    }
    if (metadata.tenantId !== undefined) {
      attrs[`${METADATA_PREFIX}.tenant_id`] = metadata.tenantId;
    }
    if (metadata.userId !== undefined) {
      attrs[`${METADATA_PREFIX}.user_id`] = metadata.userId;
    }
    if (metadata.orderId !== undefined) {
      attrs[`${METADATA_PREFIX}.order_id`] = metadata.orderId;
    }
    if (metadata.correlationId !== undefined) {
      attrs[`${METADATA_PREFIX}.correlation_id`] = metadata.correlationId;
    }
    if (metadata.tags !== undefined && metadata.tags.length > 0) {
      attrs[`${METADATA_PREFIX}.tags`] = metadata.tags;
    }
    if (metadata.custom !== undefined && Object.keys(metadata.custom).length > 0) {
      for (const [key, value] of Object.entries(metadata.custom)) {
        attrs[`${METADATA_PREFIX}.custom.${key}`] = value;
      }
    }

    return attrs;
  }

  /**
   * Deserialize metadata from Payload API response attrs.
   * Reads keys prefixed with `app_metadata.*` and reconstructs AppMetadata.
   */
  fromPayloadAttrs(attrs: Record<string, unknown>): AppMetadata {
    const metadata: AppMetadata = {};
    const customData: Record<string, unknown> = {};
    const prefix = `${METADATA_PREFIX}.`;
    const customPrefix = `${METADATA_PREFIX}.custom.`;

    for (const [key, value] of Object.entries(attrs)) {
      if (!key.startsWith(prefix)) continue;

      if (key.startsWith(customPrefix)) {
        const customKey = key.slice(customPrefix.length);
        customData[customKey] = value;
      } else {
        const field = key.slice(prefix.length);
        switch (field) {
          case 'app_id':
            metadata.appId = String(value);
            break;
          case 'tenant_id':
            metadata.tenantId = String(value);
            break;
          case 'user_id':
            metadata.userId = String(value);
            break;
          case 'order_id':
            metadata.orderId = String(value);
            break;
          case 'correlation_id':
            metadata.correlationId = String(value);
            break;
          case 'tags':
            metadata.tags = Array.isArray(value) ? value.map(String) : [String(value)];
            break;
        }
      }
    }

    if (Object.keys(customData).length > 0) {
      metadata.custom = customData;
    }

    return metadata;
  }

  /** Generate a unique correlation ID for tracing across systems. */
  generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `corr_${timestamp}_${random}`;
  }
}

/**
 * Helper to inject metadata into any create/update payload.
 * Serializes the metadata and merges it into the data's `attrs` field.
 */
export function withMetadata(
  data: Record<string, unknown>,
  metadata: AppMetadata
): Record<string, unknown> {
  const manager = new MetadataManager();
  const serialized = manager.toPayloadAttrs(metadata);

  if (Object.keys(serialized).length === 0) {
    return data;
  }

  const result = { ...data };
  const existingAttrs = (result.attrs as Record<string, unknown>) || {};
  result.attrs = {
    ...existingAttrs,
    ...serialized,
  };

  return result;
}
