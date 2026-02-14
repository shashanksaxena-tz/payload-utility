import { Model, ModelSpec, clearObjectCache } from '../../../src/core/model';
import { Payment } from '../../../src/spec01/payment';
import { Customer } from '../../../src/spec01/customer';
import { Card } from '../../../src/spec01/card';
import { ChargeItem } from '../../../src/spec02/line-item';

beforeEach(() => {
  clearObjectCache();
});

describe('Model', () => {
  describe('spec merging', () => {
    it('should return spec for Customer (polymorphic Account)', () => {
      const spec = Customer.getMergedSpec();
      expect(spec.object).toBe('account');
      expect(spec.endpoint).toBe('/accounts');
      expect(spec.polymorphic).toEqual({ type: 'customer' });
    });

    it('should merge polymorphic spec with parent', () => {
      const spec = Payment.getMergedSpec();
      expect(spec.object).toBe('transaction');
      expect(spec.endpoint).toBe('/transactions');
      expect(spec.polymorphic).toEqual({ type: 'payment' });
    });

    it('should merge Card spec correctly', () => {
      const spec = Card.getMergedSpec();
      expect(spec.object).toBe('payment_method');
      expect(spec.endpoint).toBe('/payment_methods');
      expect(spec.polymorphic).toEqual({ type: 'card' });
    });

    it('should merge ChargeItem spec with entry_type polymorphic', () => {
      const spec = ChargeItem.getMergedSpec();
      expect(spec.object).toBe('line_item');
      expect(spec.endpoint).toBe('/line_items');
      expect(spec.polymorphic).toEqual({ entry_type: 'charge' });
    });
  });

  describe('getEndpoint', () => {
    it('should return explicit endpoint', () => {
      expect(Customer.getEndpoint()).toBe('/accounts');
    });

    it('should auto-generate endpoint from object name', () => {
      class TestModel extends Model {
        static spec: ModelSpec = { object: 'widget' };
      }
      expect(TestModel.getEndpoint()).toBe('/widgets');
    });
  });

  describe('instance operations', () => {
    it('should store and retrieve data', () => {
      const customer = new Customer({
        id: 'cust_1',
        name: 'Jane Doe',
        contact_details: { email: 'jane@example.com' },
      });

      expect(customer.id).toBe('cust_1');
      expect(customer.name).toBe('Jane Doe');
    });

    it('should apply polymorphic defaults', () => {
      const payment = new Payment({ amount: 100.00 });
      expect(payment.type).toBe('payment');
    });

    it('should provide typed accessors', () => {
      const model = new Model({
        str_val: 'hello',
        num_val: 42.5,
        bool_val: true,
      });

      expect(model.getStr('str_val')).toBe('hello');
      expect(model.getNum('num_val')).toBe(42.5);
      expect(model.getFloat('num_val')).toBe(42.5);
      expect(model.getInt('num_val')).toBe(42);
      expect(model.getBool('bool_val')).toBe(true);
    });

    it('should return defaults for missing values', () => {
      const model = new Model({});
      expect(model.getStr('missing')).toBe('');
      expect(model.getNum('missing')).toBe(0);
      expect(model.getBool('missing')).toBe(false);
    });

    it('should deep clone data on toJSON', () => {
      const data = { id: '1', nested: { a: 1 } };
      const model = new Model(data);
      const json = model.toJSON();
      expect(json).toEqual(data);
      expect(json).not.toBe(data);
      expect(json.nested).not.toBe(data.nested);
    });

    it('should throw on update without request binding', async () => {
      const customer = new Customer({ id: 'cust_1' });
      await expect(customer.update({ name: 'New' })).rejects.toThrow('not bound to a request');
    });

    it('should throw on delete without request binding', async () => {
      const customer = new Customer({ id: 'cust_1' });
      await expect(customer.delete()).rejects.toThrow('not bound to a request');
    });

    it('should throw on update without ID', async () => {
      const customer = new Customer({});
      customer.bindRequest({} as any);
      await expect(customer.update({ name: 'New' })).rejects.toThrow('without an ID');
    });
  });
});
