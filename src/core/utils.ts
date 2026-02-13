/**
 * Utility functions for the Payload ARM framework.
 */

/**
 * Flattens nested objects to bracket-notation query string keys.
 * Example: { payment_method: { type: 'card' } } => { 'payment_method[type]': 'card' }
 */
export function nestedQStringKeys(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, nestedQStringKeys(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          Object.assign(result, nestedQStringKeys(item as Record<string, unknown>, `${fullKey}[${index}]`));
        } else {
          result[`${fullKey}[${index}]`] = String(item);
        }
      });
    } else if (value instanceof Date) {
      result[fullKey] = value.toISOString();
    } else if (value !== undefined && value !== null) {
      result[fullKey] = String(value);
    }
  }

  return result;
}

/**
 * Deep clone an object.
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as unknown as T;

  const cloned = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    cloned[key] = deepClone(value);
  }
  return cloned as T;
}

/**
 * Pluralize an object type name for endpoint generation.
 * Simple English pluralization for common Payload object types.
 */
export function pluralize(word: string): string {
  if (word.endsWith('y') && !['ey', 'ay', 'oy', 'uy'].some(s => word.endsWith(s))) {
    return word.slice(0, -1) + 'ies';
  }
  if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x')) {
    return word + 'es';
  }
  return word + 's';
}

/**
 * Build a URL with query parameters.
 */
export function buildUrl(baseUrl: string, path: string, params?: Record<string, string>): string {
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }
  }
  return url.toString();
}

/**
 * Sanitize a string for safe use in URLs.
 */
export function sanitizeId(id: string): string {
  return encodeURIComponent(id).replace(/[^a-zA-Z0-9_\-%.]/g, '');
}

/**
 * Validate an API key format.
 * Payload API keys follow the pattern: secret_key_<id>, client_key_<id>, or test_secret_key_<id>
 */
export function validateApiKey(key: string): boolean {
  return /^(test_secret_key|secret_key|client_key|bearer)_[a-zA-Z0-9]{10,}$/.test(key);
}

/**
 * Generate a unique request ID for tracking.
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}
