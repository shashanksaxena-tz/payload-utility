import { attr, AttrChain, serializeFilters, Filter } from '../../../src/core/attr';

describe('Attr', () => {
  describe('AttrChain', () => {
    it('should create eq filter', () => {
      const chain = new AttrChain(['status']);
      const filter = chain.eq('active');
      expect(filter).toEqual({ key: 'status', operator: '', value: 'active' });
    });

    it('should create ne filter', () => {
      const chain = new AttrChain(['status']);
      const filter = chain.ne('inactive');
      expect(filter).toEqual({ key: 'status', operator: '!', value: 'inactive' });
    });

    it('should create gt filter', () => {
      const chain = new AttrChain(['amount']);
      const filter = chain.gt(100);
      expect(filter).toEqual({ key: 'amount', operator: '>', value: 100 });
    });

    it('should create lt filter', () => {
      const chain = new AttrChain(['amount']);
      const filter = chain.lt(500);
      expect(filter).toEqual({ key: 'amount', operator: '<', value: 500 });
    });

    it('should create gte filter', () => {
      const chain = new AttrChain(['amount']);
      const filter = chain.gte(100);
      expect(filter).toEqual({ key: 'amount', operator: '>=', value: 100 });
    });

    it('should create lte filter', () => {
      const chain = new AttrChain(['amount']);
      const filter = chain.lte(500);
      expect(filter).toEqual({ key: 'amount', operator: '<=', value: 500 });
    });

    it('should create contains filter', () => {
      const chain = new AttrChain(['description']);
      const filter = chain.contains('test');
      expect(filter).toEqual({ key: 'description', operator: '?*', value: 'test' });
    });

    it('should build nested keys with bracket notation', () => {
      const chain = new AttrChain(['payment_method', 'type']);
      const filter = chain.eq('card');
      expect(filter).toEqual({ key: 'payment_method[type]', operator: '', value: 'card' });
    });

    it('should throw on empty path', () => {
      const chain = new AttrChain([]);
      expect(() => chain.eq('value')).toThrow('Attr: Cannot create filter with empty path');
    });
  });

  describe('proxy attr', () => {
    it('should create filters via property access', () => {
      const filter = (attr as any).amount.gt(100);
      expect(filter).toEqual({ key: 'amount', operator: '>', value: 100 });
    });

    it('should create nested filters via property chaining', () => {
      const filter = (attr as any).payment_method.type.eq('card');
      expect(filter).toEqual({ key: 'payment_method[type]', operator: '', value: 'card' });
    });
  });

  describe('serializeFilters', () => {
    it('should serialize eq filters', () => {
      const filters: Filter[] = [{ key: 'status', operator: '', value: 'active' }];
      expect(serializeFilters(filters)).toEqual({ status: 'active' });
    });

    it('should serialize comparison filters with operators', () => {
      const filters: Filter[] = [
        { key: 'amount', operator: '>', value: 100 },
        { key: 'amount', operator: '<', value: 500 },
      ];
      expect(serializeFilters(filters)).toEqual({
        'amount>': '100',
        'amount<': '500',
      });
    });

    it('should serialize Date values to ISO strings', () => {
      const date = new Date('2024-01-15T00:00:00.000Z');
      const filters: Filter[] = [{ key: 'created_at', operator: '>', value: date }];
      const result = serializeFilters(filters);
      expect(result['created_at>']).toBe('2024-01-15T00:00:00.000Z');
    });
  });
});
