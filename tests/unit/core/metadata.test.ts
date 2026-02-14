import { MetadataManager, AppMetadata, withMetadata } from '../../../src/core/metadata';

describe('MetadataManager', () => {
  describe('constructor', () => {
    it('should create with empty defaults', () => {
      const manager = new MetadataManager();
      expect(manager.getDefaults()).toEqual({});
    });

    it('should accept initial defaults', () => {
      const manager = new MetadataManager({ appId: 'myapp', tenantId: 'tenant1' });
      const defaults = manager.getDefaults();
      expect(defaults.appId).toBe('myapp');
      expect(defaults.tenantId).toBe('tenant1');
    });

    it('should deep clone the defaults (no shared references)', () => {
      const original = { custom: { key: 'val' } };
      const manager = new MetadataManager(original);
      original.custom.key = 'mutated';
      expect(manager.getDefaults().custom!.key).toBe('val');
    });
  });

  describe('setDefaults', () => {
    it('should replace existing defaults', () => {
      const manager = new MetadataManager({ appId: 'old' });
      manager.setDefaults({ appId: 'new', userId: 'user1' });
      const defaults = manager.getDefaults();
      expect(defaults.appId).toBe('new');
      expect(defaults.userId).toBe('user1');
    });
  });

  describe('getDefaults', () => {
    it('should return a clone (not the internal object)', () => {
      const manager = new MetadataManager({ appId: 'test' });
      const defaults1 = manager.getDefaults();
      const defaults2 = manager.getDefaults();
      expect(defaults1).not.toBe(defaults2);
      expect(defaults1).toEqual(defaults2);
    });
  });

  describe('merge', () => {
    it('should return defaults when no override provided', () => {
      const manager = new MetadataManager({ appId: 'app1', tenantId: 'tenant1' });
      const merged = manager.merge();
      expect(merged.appId).toBe('app1');
      expect(merged.tenantId).toBe('tenant1');
    });

    it('should return defaults when override is undefined', () => {
      const manager = new MetadataManager({ appId: 'app1' });
      const merged = manager.merge(undefined);
      expect(merged.appId).toBe('app1');
    });

    it('should override simple fields', () => {
      const manager = new MetadataManager({ appId: 'default', userId: 'default-user' });
      const merged = manager.merge({ appId: 'override' });
      expect(merged.appId).toBe('override');
      expect(merged.userId).toBe('default-user');
    });

    it('should merge and deduplicate tags', () => {
      const manager = new MetadataManager({ tags: ['tag1', 'tag2'] });
      const merged = manager.merge({ tags: ['tag2', 'tag3'] });
      expect(merged.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should deep merge custom objects', () => {
      const manager = new MetadataManager({ custom: { a: 1, b: 2 } });
      const merged = manager.merge({ custom: { b: 3, c: 4 } });
      expect(merged.custom).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should handle merging tags when defaults have no tags', () => {
      const manager = new MetadataManager({});
      const merged = manager.merge({ tags: ['new'] });
      expect(merged.tags).toEqual(['new']);
    });

    it('should handle merging custom when defaults have no custom', () => {
      const manager = new MetadataManager({});
      const merged = manager.merge({ custom: { key: 'val' } });
      expect(merged.custom).toEqual({ key: 'val' });
    });
  });

  describe('toPayloadAttrs', () => {
    it('should serialize all metadata fields', () => {
      const manager = new MetadataManager();
      const attrs = manager.toPayloadAttrs({
        appId: 'myapp',
        tenantId: 'tenant1',
        userId: 'user1',
        orderId: 'order1',
        correlationId: 'corr_123',
        tags: ['vip', 'priority'],
        custom: { source: 'api', version: 2 },
      });

      expect(attrs['app_metadata.app_id']).toBe('myapp');
      expect(attrs['app_metadata.tenant_id']).toBe('tenant1');
      expect(attrs['app_metadata.user_id']).toBe('user1');
      expect(attrs['app_metadata.order_id']).toBe('order1');
      expect(attrs['app_metadata.correlation_id']).toBe('corr_123');
      expect(attrs['app_metadata.tags']).toEqual(['vip', 'priority']);
      expect(attrs['app_metadata.custom.source']).toBe('api');
      expect(attrs['app_metadata.custom.version']).toBe(2);
    });

    it('should skip undefined fields', () => {
      const manager = new MetadataManager();
      const attrs = manager.toPayloadAttrs({ appId: 'only' });
      expect(Object.keys(attrs)).toEqual(['app_metadata.app_id']);
    });

    it('should skip empty tags array', () => {
      const manager = new MetadataManager();
      const attrs = manager.toPayloadAttrs({ tags: [] });
      expect(attrs['app_metadata.tags']).toBeUndefined();
    });

    it('should skip empty custom object', () => {
      const manager = new MetadataManager();
      const attrs = manager.toPayloadAttrs({ custom: {} });
      expect(Object.keys(attrs).filter(k => k.startsWith('app_metadata.custom.'))).toHaveLength(0);
    });

    it('should return empty object for empty metadata', () => {
      const manager = new MetadataManager();
      const attrs = manager.toPayloadAttrs({});
      expect(attrs).toEqual({});
    });
  });

  describe('fromPayloadAttrs', () => {
    it('should deserialize all metadata fields', () => {
      const manager = new MetadataManager();
      const metadata = manager.fromPayloadAttrs({
        'app_metadata.app_id': 'myapp',
        'app_metadata.tenant_id': 'tenant1',
        'app_metadata.user_id': 'user1',
        'app_metadata.order_id': 'order1',
        'app_metadata.correlation_id': 'corr_123',
        'app_metadata.tags': ['vip'],
        'app_metadata.custom.source': 'api',
        'app_metadata.custom.version': 2,
      });

      expect(metadata.appId).toBe('myapp');
      expect(metadata.tenantId).toBe('tenant1');
      expect(metadata.userId).toBe('user1');
      expect(metadata.orderId).toBe('order1');
      expect(metadata.correlationId).toBe('corr_123');
      expect(metadata.tags).toEqual(['vip']);
      expect(metadata.custom).toEqual({ source: 'api', version: 2 });
    });

    it('should ignore non-prefixed keys', () => {
      const manager = new MetadataManager();
      const metadata = manager.fromPayloadAttrs({
        'unrelated_key': 'value',
        'app_metadata.app_id': 'myapp',
      });

      expect(metadata.appId).toBe('myapp');
      expect((metadata as any)['unrelated_key']).toBeUndefined();
    });

    it('should return empty metadata for empty attrs', () => {
      const manager = new MetadataManager();
      const metadata = manager.fromPayloadAttrs({});
      expect(metadata).toEqual({});
    });

    it('should handle non-array tags by wrapping in array', () => {
      const manager = new MetadataManager();
      const metadata = manager.fromPayloadAttrs({
        'app_metadata.tags': 'single_tag',
      });
      expect(metadata.tags).toEqual(['single_tag']);
    });

    it('should roundtrip through toPayloadAttrs and fromPayloadAttrs', () => {
      const manager = new MetadataManager();
      const original: AppMetadata = {
        appId: 'test',
        tenantId: 'tenant',
        userId: 'user',
        orderId: 'order',
        correlationId: 'corr',
        tags: ['a', 'b'],
        custom: { x: 1, y: 'hello' },
      };

      const attrs = manager.toPayloadAttrs(original);
      const restored = manager.fromPayloadAttrs(attrs);

      expect(restored.appId).toBe(original.appId);
      expect(restored.tenantId).toBe(original.tenantId);
      expect(restored.userId).toBe(original.userId);
      expect(restored.orderId).toBe(original.orderId);
      expect(restored.correlationId).toBe(original.correlationId);
      expect(restored.tags).toEqual(original.tags);
      expect(restored.custom).toEqual(original.custom);
    });
  });

  describe('generateCorrelationId', () => {
    it('should generate IDs with corr_ prefix', () => {
      const manager = new MetadataManager();
      const id = manager.generateCorrelationId();
      expect(id).toMatch(/^corr_/);
    });

    it('should generate unique IDs', () => {
      const manager = new MetadataManager();
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(manager.generateCorrelationId());
      }
      expect(ids.size).toBe(100);
    });
  });
});

describe('withMetadata', () => {
  it('should inject metadata into data attrs', () => {
    const data = { amount: 100, description: 'test' };
    const result = withMetadata(data, { appId: 'myapp', tenantId: 'tenant1' });

    expect(result.amount).toBe(100);
    expect((result.attrs as any)['app_metadata.app_id']).toBe('myapp');
    expect((result.attrs as any)['app_metadata.tenant_id']).toBe('tenant1');
  });

  it('should merge with existing attrs', () => {
    const data = { amount: 100, attrs: { existing: 'value' } };
    const result = withMetadata(data, { appId: 'myapp' });

    expect((result.attrs as any).existing).toBe('value');
    expect((result.attrs as any)['app_metadata.app_id']).toBe('myapp');
  });

  it('should return original data when metadata is empty', () => {
    const data = { amount: 100 };
    const result = withMetadata(data, {});

    expect(result).toBe(data);
  });

  it('should not mutate the original data object', () => {
    const data = { amount: 100 };
    withMetadata(data, { appId: 'test' });
    expect((data as any).attrs).toBeUndefined();
  });
});
