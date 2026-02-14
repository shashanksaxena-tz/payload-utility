/**
 * Events - Typed event emitter system for the Payload SDK.
 *
 * Provides a type-safe event system for observing SDK lifecycle events
 * including request lifecycle, model CRUD operations, payment processing,
 * invoicing, ledger operations, and webhook handling.
 *
 * Implemented from scratch with no external dependencies, following the
 * Node.js EventEmitter pattern with strongly typed event names.
 */

// --- Event name types ---

/** Request lifecycle events */
export type RequestEvent =
  | 'request.before'
  | 'request.after'
  | 'request.error';

/** Payment events */
export type PaymentEvent =
  | 'payment.created'
  | 'payment.updated'
  | 'payment.voided';

/** Customer events */
export type CustomerEvent =
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted';

/** Invoice events */
export type InvoiceEvent =
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.paid';

/** Ledger events */
export type LedgerEvent =
  | 'ledger.entry.created'
  | 'ledger.reconciled';

/** Webhook events */
export type WebhookEvent =
  | 'webhook.received'
  | 'webhook.verified';

/** Generic model events */
export type ModelEvent =
  | 'model.created'
  | 'model.updated'
  | 'model.deleted';

/** Union of all SDK event names */
export type SDKEvent =
  | RequestEvent
  | PaymentEvent
  | CustomerEvent
  | InvoiceEvent
  | LedgerEvent
  | WebhookEvent
  | ModelEvent;

// --- Event data interface ---

/** Data payload passed to event handlers */
export interface EventData {
  /** The event name that was emitted */
  event: SDKEvent;
  /** ISO 8601 timestamp of when the event was emitted */
  timestamp: string;
  /** The event-specific data */
  data: any;
  /** Optional metadata for additional context */
  metadata?: Record<string, any>;
}

// --- Event handler type ---

/** Handler function signature for event listeners */
export type EventHandler = (eventData: EventData) => void;

// --- Event emitter implementation ---

/**
 * PayloadEventEmitter - Type-safe event emitter for the Payload SDK.
 *
 * Supports standard event emitter operations: on, off, once, emit,
 * and removeAllListeners. All event names are validated against the
 * SDKEvent union type at compile time.
 *
 * Usage:
 *   const emitter = new PayloadEventEmitter();
 *
 *   emitter.on('payment.created', (eventData) => {
 *     console.log('Payment created:', eventData.data);
 *   });
 *
 *   emitter.emit('payment.created', { id: 'txn_123', amount: 50 });
 */
export class PayloadEventEmitter {
  private _listeners: Map<SDKEvent, EventHandler[]> = new Map();

  /**
   * Register an event handler for a specific event.
   * The handler will be called every time the event is emitted.
   *
   * @param event - The event name to listen for
   * @param handler - The handler function to invoke
   * @returns this (for chaining)
   */
  on(event: SDKEvent, handler: EventHandler): this {
    const handlers = this._listeners.get(event);
    if (handlers) {
      handlers.push(handler);
    } else {
      this._listeners.set(event, [handler]);
    }
    return this;
  }

  /**
   * Remove a specific event handler for an event.
   * If the handler was registered multiple times, only the first
   * occurrence is removed.
   *
   * @param event - The event name to remove the handler from
   * @param handler - The handler function to remove
   * @returns this (for chaining)
   */
  off(event: SDKEvent, handler: EventHandler): this {
    const handlers = this._listeners.get(event);
    if (!handlers) return this;

    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }

    if (handlers.length === 0) {
      this._listeners.delete(event);
    }

    return this;
  }

  /**
   * Register a one-time event handler. The handler will be automatically
   * removed after its first invocation.
   *
   * @param event - The event name to listen for
   * @param handler - The handler function to invoke once
   * @returns this (for chaining)
   */
  once(event: SDKEvent, handler: EventHandler): this {
    const wrapper: EventHandler = (eventData: EventData) => {
      this.off(event, wrapper);
      handler(eventData);
    };
    return this.on(event, wrapper);
  }

  /**
   * Emit an event, invoking all registered handlers for that event.
   * Handlers are called synchronously in the order they were registered.
   *
   * @param event - The event name to emit
   * @param data - The event-specific data payload
   * @param metadata - Optional metadata to include in the EventData
   * @returns true if there were any handlers, false otherwise
   */
  emit(event: SDKEvent, data?: any, metadata?: Record<string, any>): boolean {
    const handlers = this._listeners.get(event);
    if (!handlers || handlers.length === 0) return false;

    const eventData: EventData = {
      event,
      timestamp: new Date().toISOString(),
      data: data !== undefined ? data : null,
      metadata,
    };

    // Copy the array to protect against handlers that modify the listener list
    const snapshot = [...handlers];
    for (const handler of snapshot) {
      handler(eventData);
    }

    return true;
  }

  /**
   * Remove all listeners for a specific event, or all listeners entirely
   * if no event is specified.
   *
   * @param event - Optional event name. If omitted, all listeners are removed.
   * @returns this (for chaining)
   */
  removeAllListeners(event?: SDKEvent): this {
    if (event !== undefined) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  /**
   * Get the number of listeners registered for a specific event.
   *
   * @param event - The event name to check
   * @returns The number of registered handlers
   */
  listenerCount(event: SDKEvent): number {
    const handlers = this._listeners.get(event);
    return handlers ? handlers.length : 0;
  }

  /**
   * Get all event names that have at least one registered listener.
   *
   * @returns Array of event names with active listeners
   */
  eventNames(): SDKEvent[] {
    return Array.from(this._listeners.keys());
  }
}
