import {
  PayloadEventEmitter,
  EventData,
  SDKEvent,
} from '../../../src/core/events';

describe('PayloadEventEmitter', () => {
  let emitter: PayloadEventEmitter;

  beforeEach(() => {
    emitter = new PayloadEventEmitter();
  });

  describe('on / emit', () => {
    it('should register and fire a handler for an event', () => {
      const received: EventData[] = [];
      emitter.on('payment.created', (ed) => received.push(ed));

      emitter.emit('payment.created', { id: 'txn_1' });

      expect(received).toHaveLength(1);
      expect(received[0].event).toBe('payment.created');
      expect(received[0].data).toEqual({ id: 'txn_1' });
      expect(received[0].timestamp).toBeDefined();
    });

    it('should return true when there are handlers, false otherwise', () => {
      expect(emitter.emit('payment.created', {})).toBe(false);

      emitter.on('payment.created', () => {});
      expect(emitter.emit('payment.created', {})).toBe(true);
    });

    it('should call multiple handlers for the same event', () => {
      const calls: string[] = [];
      emitter.on('customer.created', () => calls.push('a'));
      emitter.on('customer.created', () => calls.push('b'));

      emitter.emit('customer.created', {});
      expect(calls).toEqual(['a', 'b']);
    });

    it('should pass metadata to handlers', () => {
      let capturedMeta: Record<string, any> | undefined;
      emitter.on('request.before', (ed) => { capturedMeta = ed.metadata; });

      emitter.emit('request.before', {}, { correlationId: 'abc' });
      expect(capturedMeta).toEqual({ correlationId: 'abc' });
    });

    it('should set data to null when no data provided', () => {
      let capturedData: any;
      emitter.on('payment.voided', (ed) => { capturedData = ed.data; });

      emitter.emit('payment.voided');
      expect(capturedData).toBeNull();
    });

    it('should support chaining on()', () => {
      const result = emitter.on('payment.created', () => {}).on('customer.created', () => {});
      expect(result).toBe(emitter);
    });
  });

  describe('off', () => {
    it('should remove a specific handler', () => {
      const calls: string[] = [];
      const handler = () => calls.push('called');

      emitter.on('payment.created', handler);
      emitter.off('payment.created', handler);
      emitter.emit('payment.created', {});

      expect(calls).toHaveLength(0);
    });

    it('should only remove the first occurrence of a handler', () => {
      let count = 0;
      const handler = () => count++;

      emitter.on('payment.created', handler);
      emitter.on('payment.created', handler);
      emitter.off('payment.created', handler);
      emitter.emit('payment.created', {});

      expect(count).toBe(1);
    });

    it('should be a no-op when removing a handler from an event with no listeners', () => {
      expect(() => emitter.off('payment.created', () => {})).not.toThrow();
    });

    it('should support chaining', () => {
      const result = emitter.off('payment.created', () => {});
      expect(result).toBe(emitter);
    });
  });

  describe('once', () => {
    it('should fire handler only once', () => {
      let count = 0;
      emitter.once('invoice.paid', () => count++);

      emitter.emit('invoice.paid', {});
      emitter.emit('invoice.paid', {});
      emitter.emit('invoice.paid', {});

      expect(count).toBe(1);
    });

    it('should pass event data to once handler', () => {
      let capturedData: any;
      emitter.once('ledger.entry.created', (ed) => { capturedData = ed.data; });

      emitter.emit('ledger.entry.created', { amount: 100 });
      expect(capturedData).toEqual({ amount: 100 });
    });

    it('should support chaining', () => {
      const result = emitter.once('payment.created', () => {});
      expect(result).toBe(emitter);
    });
  });

  describe('removeAllListeners', () => {
    it('should clear all handlers for a specific event', () => {
      emitter.on('payment.created', () => {});
      emitter.on('payment.created', () => {});
      emitter.on('customer.created', () => {});

      emitter.removeAllListeners('payment.created');

      expect(emitter.listenerCount('payment.created')).toBe(0);
      expect(emitter.listenerCount('customer.created')).toBe(1);
    });

    it('should clear all handlers for all events when no event specified', () => {
      emitter.on('payment.created', () => {});
      emitter.on('customer.created', () => {});
      emitter.on('invoice.paid', () => {});

      emitter.removeAllListeners();

      expect(emitter.eventNames()).toHaveLength(0);
    });

    it('should support chaining', () => {
      const result = emitter.removeAllListeners();
      expect(result).toBe(emitter);
    });
  });

  describe('listenerCount', () => {
    it('should return 0 for events with no listeners', () => {
      expect(emitter.listenerCount('payment.created')).toBe(0);
    });

    it('should return correct count', () => {
      emitter.on('payment.created', () => {});
      emitter.on('payment.created', () => {});
      expect(emitter.listenerCount('payment.created')).toBe(2);
    });
  });

  describe('eventNames', () => {
    it('should return empty array initially', () => {
      expect(emitter.eventNames()).toEqual([]);
    });

    it('should return all event names with listeners', () => {
      emitter.on('payment.created', () => {});
      emitter.on('customer.deleted', () => {});

      const names = emitter.eventNames();
      expect(names).toContain('payment.created');
      expect(names).toContain('customer.deleted');
      expect(names).toHaveLength(2);
    });
  });

  describe('type-safe event names', () => {
    it('should accept all defined SDK event types', () => {
      const events: SDKEvent[] = [
        'request.before', 'request.after', 'request.error',
        'payment.created', 'payment.updated', 'payment.voided',
        'customer.created', 'customer.updated', 'customer.deleted',
        'invoice.created', 'invoice.sent', 'invoice.paid',
        'ledger.entry.created', 'ledger.reconciled',
        'webhook.received', 'webhook.verified',
        'model.created', 'model.updated', 'model.deleted',
      ];

      for (const event of events) {
        expect(() => emitter.on(event, () => {})).not.toThrow();
      }
    });
  });
});
