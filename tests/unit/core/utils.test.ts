import {
  nestedQStringKeys,
  deepClone,
  pluralize,
  buildUrl,
  sanitizeId,
  validateApiKey,
  generateRequestId,
} from '../../../src/core/utils';

describe('Utils', () => {
  describe('nestedQStringKeys', () => {
    it('should flatten simple object', () => {
      const result = nestedQStringKeys({ type: 'card', status: 'active' });
      expect(result).toEqual({ type: 'card', status: 'active' });
    });

    it('should flatten nested object with bracket notation', () => {
      const result = nestedQStringKeys({ payment_method: { type: 'card' } });
      expect(result).toEqual({ 'payment_method[type]': 'card' });
    });

    it('should handle deeply nested objects', () => {
      const result = nestedQStringKeys({
        a: { b: { c: 'value' } },
      });
      expect(result).toEqual({ 'a[b][c]': 'value' });
    });

    it('should handle arrays', () => {
      const result = nestedQStringKeys({ items: ['a', 'b'] });
      expect(result).toEqual({ 'items[0]': 'a', 'items[1]': 'b' });
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-01-15T00:00:00.000Z');
      const result = nestedQStringKeys({ created_at: date });
      expect(result).toEqual({ created_at: '2024-01-15T00:00:00.000Z' });
    });

    it('should skip null and undefined values', () => {
      const result = nestedQStringKeys({ a: 'keep', b: null, c: undefined });
      expect(result).toEqual({ a: 'keep' });
    });
  });

  describe('deepClone', () => {
    it('should clone primitive values', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone(null)).toBe(null);
    });

    it('should deep clone objects', () => {
      const original = { a: { b: 1 }, c: [1, 2] };
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.a).not.toBe(original.a);
    });

    it('should clone Date objects', () => {
      const date = new Date('2024-01-01');
      const cloned = deepClone(date);
      expect(cloned.getTime()).toBe(date.getTime());
      expect(cloned).not.toBe(date);
    });
  });

  describe('pluralize', () => {
    it('should add s to regular words', () => {
      expect(pluralize('customer')).toBe('customers');
      expect(pluralize('payment')).toBe('payments');
    });

    it('should handle words ending in y', () => {
      expect(pluralize('entity')).toBe('entities');
    });

    it('should handle words ending in s/sh/ch/x', () => {
      expect(pluralize('status')).toBe('statuses');
      expect(pluralize('match')).toBe('matches');
    });

    it('should not change y ending after vowel', () => {
      expect(pluralize('key')).toBe('keys');
    });
  });

  describe('buildUrl', () => {
    it('should build a URL with path', () => {
      const result = buildUrl('https://api.payload.co', '/customers');
      expect(result).toBe('https://api.payload.co/customers');
    });

    it('should build a URL with query params', () => {
      const result = buildUrl('https://api.payload.co', '/customers', { type: 'card' });
      expect(result).toBe('https://api.payload.co/customers?type=card');
    });
  });

  describe('sanitizeId', () => {
    it('should encode special characters', () => {
      const result = sanitizeId('cust_123abc');
      expect(result).toBe('cust_123abc');
    });

    it('should handle IDs with special chars', () => {
      const result = sanitizeId('test<script>');
      expect(result).toBe('test%3Cscript%3E');
    });
  });

  describe('validateApiKey', () => {
    it('should validate correct secret key', () => {
      expect(validateApiKey('secret_key_test1234567890')).toBe(true);
    });

    it('should validate correct client key', () => {
      expect(validateApiKey('client_key_test1234567890')).toBe(true);
    });

    it('should reject invalid keys', () => {
      expect(validateApiKey('invalid_key')).toBe(false);
      expect(validateApiKey('')).toBe(false);
    });
  });

  describe('generateRequestId', () => {
    it('should generate unique request IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).toMatch(/^req_/);
      expect(id2).toMatch(/^req_/);
      expect(id1).not.toBe(id2);
    });
  });
});
