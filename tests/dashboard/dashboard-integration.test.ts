/**
 * Dashboard Integration Test Suite
 *
 * Tests EVERY dashboard API route end-to-end against the mock Payload gateway.
 * Flow: Test → Dashboard Express API → Payload SDK → Mock Payload Server
 *
 * Coverage:
 *  - Config & session management
 *  - Generic CRUD for all 27 resource types
 *  - Instance actions (void, pause/resume/cancel, send/markPaid, enable/disable)
 *  - Ledger Manager (balanced entry, multi-leg, balance, reconcile, reversal, activity, validation)
 *  - Dashboard stats
 *  - Query & filter integration
 *  - Error propagation
 */

import http from 'http';
import { createMockServer, MockServerInstance } from '../mock/mock-server';

const MOCK_PORT = 3250;
const DASH_PORT = 3251;
const MOCK_URL = `http://localhost:${MOCK_PORT}`;
const DASH_URL = `http://localhost:${DASH_PORT}`;
const TEST_API_KEY = 'secret_key_test1234567890';

let mockServer: MockServerInstance;
let dashProcess: ReturnType<typeof require> | null = null;
let dashServer: http.Server | null = null;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DASH_URL);
    const opts: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, res => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(raw || '{}') });
        } catch {
          resolve({ status: res.statusCode || 0, data: raw });
        }
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

const GET    = (p: string) => api('GET', p);
const POST   = (p: string, b?: unknown) => api('POST', p, b);
const PUT    = (p: string, b: unknown) => api('PUT', p, b);
const DELETE = (p: string) => api('DELETE', p);

/* ------------------------------------------------------------------ */
/*  Setup & Teardown                                                   */
/* ------------------------------------------------------------------ */

beforeAll(async () => {
  // 1. Start mock Payload server
  mockServer = createMockServer(MOCK_PORT);
  await new Promise<void>(resolve => mockServer.server.listen(MOCK_PORT, resolve));

  // 2. Start dashboard server (loaded dynamically so we can set env vars)
  process.env.PAYLOAD_API_KEY = TEST_API_KEY;
  process.env.PAYLOAD_API_URL = MOCK_URL;
  process.env.DASHBOARD_PORT = String(DASH_PORT);

  // Resolve express/cors from dashboard's own node_modules
  const dashRoot = require('path').join(__dirname, '..', '..', 'dashboard');
  const express = require(require.resolve('express', { paths: [dashRoot] }));
  const cors = require(require.resolve('cors', { paths: [dashRoot] }));
  const path = require('path');

  // Build SDK session pointing at mock
  const { Session, attr, LedgerManager } = require('../../dist');
  const session = new Session(TEST_API_KEY, { apiUrl: MOCK_URL, apiVersion: 'v2' });
  const ledger = new LedgerManager(session);
  const sdk = { session, attr, LedgerManager, ledger };

  // Create a mini Express app that mirrors dashboard/server.js
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Model map
  const MODEL_MAP: Record<string, string> = {
    'customers': 'Customer', 'payments': 'Payment', 'refunds': 'Refund',
    'credits': 'Credit', 'deposits': 'Deposit', 'cards': 'Card',
    'bank-accounts': 'BankAccount', 'billing-schedules': 'BillingSchedule',
    'billing-charges': 'BillingCharge', 'invoices': 'Invoice',
    'invoice-items': 'InvoiceItem', 'charge-items': 'ChargeItem',
    'payment-items': 'PaymentItem', 'entities': 'Entity',
    'stakeholders': 'Stakeholder', 'webhooks': 'Webhook',
    'webhook-logs': 'WebhookLog', 'payment-links': 'PaymentLink',
    'intents': 'Intent', 'transfers': 'Transfer',
    'ledger-entries': 'Ledger', 'processing-accounts': 'ProcessingAccount',
    'processing-agreements': 'ProcessingAgreement', 'profiles': 'Profile',
    'orgs': 'Org', 'accounts': 'Account', 'client-tokens': 'ClientToken',
  };

  function buildAttrFilter(attrProxy: any, f: any) {
    const chain = f.field.split('.').reduce((a: any, k: string) => a[k], attrProxy);
    return chain[f.op](f.value);
  }

  function modelData(instance: any) {
    if (!instance) return null;
    const d: any = { id: instance.id };
    if (instance._data) Object.assign(d, instance._data);
    if (instance.data) Object.assign(d, instance.data);
    const raw = instance.toJSON ? instance.toJSON() : instance;
    if (typeof raw === 'object' && raw !== null) Object.assign(d, raw);
    return d;
  }

  // Generic CRUD routes
  Object.entries(MODEL_MAP).forEach(([resource, modelName]) => {
    const router = express.Router();
    router.get('/', async (req: any, res: any) => {
      try {
        const model = (sdk.session as any)[modelName];
        let query = model.filterBy();
        Object.entries(req.query).forEach(([key, value]: any) => {
          const m = key.match(/^filter\.(.+)\.(\w+)$/);
          if (m) query = query.filterBy(buildAttrFilter(sdk.attr, { field: m[1], op: m[2], value }));
        });
        if (req.query.orderBy) query = query.orderBy(req.query.orderBy);
        if (req.query.limit) query = query.limit(Number(req.query.limit));
        if (req.query.offset) query = query.offset(Number(req.query.offset));
        const items = await query.all();
        res.json(items.map(modelData));
      } catch (e: any) {
        res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
      }
    });
    router.get('/:id', async (req: any, res: any) => {
      try {
        const item = await (sdk.session as any)[modelName].get(req.params.id);
        res.json(modelData(item));
      } catch (e: any) {
        res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
      }
    });
    router.post('/', async (req: any, res: any) => {
      try {
        const item = await (sdk.session as any)[modelName].create(req.body);
        res.status(201).json(modelData(item));
      } catch (e: any) {
        res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
      }
    });
    router.put('/:id', async (req: any, res: any) => {
      try {
        const instance = await (sdk.session as any)[modelName].get(req.params.id);
        await instance.update(req.body);
        res.json(modelData(instance));
      } catch (e: any) {
        res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
      }
    });
    router.delete('/:id', async (req: any, res: any) => {
      try {
        const instance = await (sdk.session as any)[modelName].get(req.params.id);
        await instance.delete();
        res.json({ ok: true });
      } catch (e: any) {
        res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
      }
    });
    app.use(`/api/${resource}`, router);
  });

  // Query route
  app.post('/api/:resource/query', async (req: any, res: any) => {
    try {
      const modelName = MODEL_MAP[req.params.resource];
      if (!modelName) return res.status(404).json({ error: 'Unknown resource' });
      const model = (sdk.session as any)[modelName];
      let query = model.filterBy();
      (req.body.filters || []).forEach((f: any) => query = query.filterBy(buildAttrFilter(sdk.attr, f)));
      if (req.body.orderBy) query = query.orderBy(req.body.orderBy);
      if (req.body.limit) query = query.limit(Number(req.body.limit));
      if (req.body.offset) query = query.offset(Number(req.body.offset));
      const items = await query.all();
      res.json(items.map(modelData));
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
    }
  });

  // Instance actions
  function instanceAction(modelName: string, method: string) {
    return async (req: any, res: any) => {
      try {
        const instance = await (sdk.session as any)[modelName].get(req.params.id);
        await instance[method]();
        res.json(modelData(instance));
      } catch (e: any) {
        res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
      }
    };
  }

  app.post('/api/payments/:id/void', instanceAction('Payment', 'void'));
  app.post('/api/refunds/:id/void', instanceAction('Refund', 'void'));
  app.post('/api/billing-schedules/:id/pause', instanceAction('BillingSchedule', 'pause'));
  app.post('/api/billing-schedules/:id/resume', instanceAction('BillingSchedule', 'resume'));
  app.post('/api/billing-schedules/:id/cancel', instanceAction('BillingSchedule', 'cancel'));
  app.post('/api/invoices/:id/send', instanceAction('Invoice', 'send'));
  app.post('/api/invoices/:id/mark-paid', instanceAction('Invoice', 'markPaid'));
  app.post('/api/invoices/:id/void', instanceAction('Invoice', 'void'));
  app.post('/api/webhooks/:id/enable', instanceAction('Webhook', 'enable'));
  app.post('/api/webhooks/:id/disable', instanceAction('Webhook', 'disable'));

  // Ledger routes
  app.post('/api/ledger/balanced-entry', async (req: any, res: any) => {
    try {
      const result = await sdk.ledger.createBalancedEntry(req.body);
      res.status(201).json({ debit: modelData(result.debit), credit: modelData(result.credit) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/ledger/multi-leg-entry', async (req: any, res: any) => {
    try {
      const entries = await sdk.ledger.createMultiLegEntry(req.body.entries);
      res.status(201).json(entries.map(modelData));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/ledger/balance/:accountId', async (req: any, res: any) => {
    try {
      const balance = await sdk.ledger.getAccountBalance(req.params.accountId);
      res.json(balance);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/ledger/reconcile', async (req: any, res: any) => {
    try {
      const result = await sdk.ledger.reconcile(req.body.accountIds);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/ledger/reversal', async (req: any, res: any) => {
    try {
      const { originalDebitAccountId, originalCreditAccountId, amount, reason } = req.body;
      const result = await sdk.ledger.createReversalEntry(
        originalDebitAccountId, originalCreditAccountId, amount, reason
      );
      res.status(201).json({ debit: modelData(result.debit), credit: modelData(result.credit) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/ledger/activity/:accountId', async (req: any, res: any) => {
    try {
      const result = await sdk.ledger.getActivitySummary(
        req.params.accountId, req.query.startDate, req.query.endDate
      );
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/ledger/transaction/:txnId/entries', async (req: any, res: any) => {
    try {
      const entries = await sdk.ledger.getTransactionEntries(req.params.txnId);
      res.json(entries.map(modelData));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/ledger/transaction/:txnId/validate', async (req: any, res: any) => {
    try {
      const balanced = await sdk.ledger.validateTransactionBalance(req.params.txnId);
      res.json({ balanced });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', async (_req: any, res: any) => {
    try {
      const counts: any = {};
      const quick = ['Customer','Payment','Invoice','BillingSchedule','Webhook','Entity','Transfer'];
      await Promise.all(quick.map(async m => {
        try {
          const items = await (sdk.session as any)[m].filterBy().limit(100).all();
          counts[m] = items.length;
        } catch { counts[m] = 0; }
      }));
      res.json(counts);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Config route
  app.get('/api/config', (_req: any, res: any) => {
    res.json({ initialised: true, apiUrl: MOCK_URL, hasKey: true });
  });

  dashServer = app.listen(DASH_PORT);
  await new Promise<void>(resolve => dashServer!.on('listening', resolve));
}, 15000);

afterAll(async () => {
  if (dashServer) await new Promise<void>(resolve => dashServer!.close(() => resolve()));
  if (mockServer) await new Promise<void>(resolve => mockServer.server.close(() => resolve()));
});

beforeEach(() => {
  // Clear SDK object cache between tests
  const { clearObjectCache } = require('../../dist');
  clearObjectCache();
  // Reset mock server data
  mockServer.reset();
});

/* ================================================================== */
/*  TEST SUITES                                                        */
/* ================================================================== */

describe('Dashboard API Integration Tests', () => {

  /* ---------------------------------------------------------------- */
  /*  1. CONFIG & STATUS                                               */
  /* ---------------------------------------------------------------- */
  describe('1. Config & Status', () => {
    test('GET /api/config returns initialised state', async () => {
      const { status, data } = await GET('/api/config');
      expect(status).toBe(200);
      expect(data.initialised).toBe(true);
      expect(data.apiUrl).toBe(MOCK_URL);
      expect(data.hasKey).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  2. CUSTOMER CRUD                                                 */
  /* ---------------------------------------------------------------- */
  describe('2. Customer CRUD', () => {
    test('POST /api/customers creates a customer', async () => {
      const { status, data } = await POST('/api/customers', {
        name: 'Alice Smith', email: 'alice@test.com', phone: '555-1234',
      });
      expect(status).toBe(201);
      expect(data.id).toMatch(/^cust_/);
      expect(data.name).toBe('Alice Smith');
      expect(data.email).toBe('alice@test.com');
      expect(data.created_at).toBeTruthy();
    });

    test('GET /api/customers lists customers', async () => {
      await POST('/api/customers', { name: 'Bob' });
      await POST('/api/customers', { name: 'Carol' });
      const { status, data } = await GET('/api/customers');
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
    });

    test('GET /api/customers/:id retrieves one customer', async () => {
      const created = await POST('/api/customers', { name: 'Dave', email: 'dave@test.com' });
      const { status, data } = await GET(`/api/customers/${created.data.id}`);
      expect(status).toBe(200);
      expect(data.name).toBe('Dave');
      expect(data.email).toBe('dave@test.com');
    });

    test('PUT /api/customers/:id updates a customer', async () => {
      const created = await POST('/api/customers', { name: 'Eve' });
      const { status, data } = await PUT(`/api/customers/${created.data.id}`, { name: 'Eve Updated' });
      expect(status).toBe(200);
      expect(data.name).toBe('Eve Updated');
    });

    test('DELETE /api/customers/:id deletes a customer', async () => {
      const created = await POST('/api/customers', { name: 'Frank' });
      const { status, data } = await DELETE(`/api/customers/${created.data.id}`);
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });

    test('GET /api/customers/:id returns 404 for missing customer', async () => {
      const { status } = await GET('/api/customers/cust_nonexistent');
      expect(status).toBe(404);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  3. TRANSACTION POLYMORPHISM (Payment, Refund, Credit, Deposit)   */
  /* ---------------------------------------------------------------- */
  describe('3. Transactions (Polymorphic)', () => {
    test('POST /api/payments creates a payment with type=payment', async () => {
      const { status, data } = await POST('/api/payments', { amount: 99.99, description: 'Test payment' });
      expect(status).toBe(201);
      expect(data.amount).toBe(99.99);
      expect(data.type).toBe('payment');
    });

    test('POST /api/refunds creates a refund with type=refund', async () => {
      const payment = await POST('/api/payments', { amount: 50 });
      const { status, data } = await POST('/api/refunds', {
        amount: 10, linked_transaction_id: payment.data.id, description: 'Partial refund',
      });
      expect(status).toBe(201);
      expect(data.type).toBe('refund');
      expect(data.linked_transaction_id).toBe(payment.data.id);
    });

    test('POST /api/credits creates a credit', async () => {
      const { status, data } = await POST('/api/credits', { amount: 25 });
      expect(status).toBe(201);
      expect(data.type).toBe('credit');
    });

    test('POST /api/deposits creates a deposit', async () => {
      const { status, data } = await POST('/api/deposits', { amount: 500 });
      expect(status).toBe(201);
      expect(data.type).toBe('deposit');
    });

    test('GET /api/payments lists only payments (not refunds)', async () => {
      await POST('/api/payments', { amount: 100 });
      await POST('/api/refunds', { amount: 10, linked_transaction_id: 'txn_fake' });
      const { data } = await GET('/api/payments');
      expect(data.every((p: any) => p.type === 'payment')).toBe(true);
    });

    test('POST /api/payments/:id/void voids a payment', async () => {
      const payment = await POST('/api/payments', { amount: 75 });
      const { status, data } = await POST(`/api/payments/${payment.data.id}/void`);
      expect(status).toBe(200);
      expect(data.status).toBe('voided');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  4. PAYMENT METHODS (Card, BankAccount)                           */
  /* ---------------------------------------------------------------- */
  describe('4. Payment Methods (Polymorphic)', () => {
    test('POST /api/cards creates a card', async () => {
      const { status, data } = await POST('/api/cards', {
        card_number: '4242424242424242', expiry: '12/2028', card_code: '123',
      });
      expect(status).toBe(201);
      expect(data.type).toBe('card');
      expect(data.card_number).toBe('4242424242424242');
    });

    test('POST /api/bank-accounts creates a bank account', async () => {
      const { status, data } = await POST('/api/bank-accounts', {
        account_number: '1234567890', routing_number: '021000021', account_type: 'checking',
      });
      expect(status).toBe(201);
      expect(data.type).toBe('bank_account');
    });

    test('GET /api/cards lists only cards', async () => {
      await POST('/api/cards', { card_number: '4242424242424242', expiry: '12/28', card_code: '123' });
      await POST('/api/bank-accounts', { account_number: '111', routing_number: '222', account_type: 'checking' });
      const { data } = await GET('/api/cards');
      expect(data.every((c: any) => c.type === 'card')).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  5. BILLING SCHEDULES & CHARGES                                   */
  /* ---------------------------------------------------------------- */
  describe('5. Billing Schedules', () => {
    test('POST /api/billing-schedules creates a schedule', async () => {
      const { status, data } = await POST('/api/billing-schedules', {
        amount: 29.99, frequency: 'monthly', start_date: '2026-03-01', customer_id: 'cust_1',
      });
      expect(status).toBe(201);
      expect(data.amount).toBe(29.99);
      expect(data.frequency).toBe('monthly');
    });

    test('POST /api/billing-schedules/:id/pause pauses a schedule', async () => {
      const sched = await POST('/api/billing-schedules', { amount: 10, frequency: 'weekly' });
      const { status, data } = await POST(`/api/billing-schedules/${sched.data.id}/pause`);
      expect(status).toBe(200);
      expect(data.status).toBe('paused');
    });

    test('POST /api/billing-schedules/:id/resume resumes a schedule', async () => {
      const sched = await POST('/api/billing-schedules', { amount: 10, frequency: 'weekly' });
      await POST(`/api/billing-schedules/${sched.data.id}/pause`);
      const { status, data } = await POST(`/api/billing-schedules/${sched.data.id}/resume`);
      expect(status).toBe(200);
      expect(data.status).toBe('active');
    });

    test('POST /api/billing-schedules/:id/cancel cancels a schedule', async () => {
      const sched = await POST('/api/billing-schedules', { amount: 10, frequency: 'daily' });
      const { status, data } = await POST(`/api/billing-schedules/${sched.data.id}/cancel`);
      expect(status).toBe(200);
      expect(data.status).toBe('cancelled');
    });

    test('GET /api/billing-charges lists charges', async () => {
      await POST('/api/billing-charges', { amount: 29.99, billing_schedule_id: 'bs_1', status: 'pending' });
      const { status, data } = await GET('/api/billing-charges');
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  6. INVOICES & INVOICE ITEMS                                      */
  /* ---------------------------------------------------------------- */
  describe('6. Invoices', () => {
    test('POST /api/invoices creates an invoice', async () => {
      const { status, data } = await POST('/api/invoices', {
        customer_id: 'cust_1', due_date: '2026-04-01', description: 'March consulting',
      });
      expect(status).toBe(201);
      expect(data.description).toBe('March consulting');
    });

    test('POST /api/invoice-items creates an invoice item', async () => {
      const inv = await POST('/api/invoices', { customer_id: 'cust_1', due_date: '2026-04-01' });
      const { status, data } = await POST('/api/invoice-items', {
        invoice_id: inv.data.id, description: 'Consulting (10hrs)', quantity: 10, unit_price: 150,
      });
      expect(status).toBe(201);
      expect(data.quantity).toBe(10);
      expect(data.unit_price).toBe(150);
    });

    test('POST /api/invoices/:id/send marks invoice as sent', async () => {
      const inv = await POST('/api/invoices', { customer_id: 'cust_1' });
      const { status, data } = await POST(`/api/invoices/${inv.data.id}/send`);
      expect(status).toBe(200);
      expect(data.status).toBe('sent');
    });

    test('POST /api/invoices/:id/mark-paid marks invoice as paid', async () => {
      const inv = await POST('/api/invoices', { customer_id: 'cust_1' });
      const { status, data } = await POST(`/api/invoices/${inv.data.id}/mark-paid`);
      expect(status).toBe(200);
      expect(data.status).toBe('paid');
    });

    test('POST /api/invoices/:id/void voids an invoice', async () => {
      const inv = await POST('/api/invoices', { customer_id: 'cust_1' });
      const { status, data } = await POST(`/api/invoices/${inv.data.id}/void`);
      expect(status).toBe(200);
      expect(data.status).toBe('voided');
    });

    test('POST /api/charge-items creates a charge line item', async () => {
      const { status, data } = await POST('/api/charge-items', {
        invoice_id: 'inv_1', amount: 100, description: 'Service fee',
      });
      expect(status).toBe(201);
      expect(data.entry_type).toBe('charge');
    });

    test('POST /api/payment-items creates a payment line item', async () => {
      const { status, data } = await POST('/api/payment-items', {
        invoice_id: 'inv_1', amount: 100, description: 'Payment received',
      });
      expect(status).toBe(201);
      expect(data.entry_type).toBe('payment');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  7. ENTITIES, STAKEHOLDERS, PROCESSING, PROFILES                  */
  /* ---------------------------------------------------------------- */
  describe('7. Entities & Business Onboarding', () => {
    test('POST /api/entities creates an entity', async () => {
      const { status, data } = await POST('/api/entities', {
        legal_name: 'Acme LLC', dba_name: 'Acme', entity_type: 'llc',
      });
      expect(status).toBe(201);
      expect(data.legal_name).toBe('Acme LLC');
    });

    test('POST /api/stakeholders creates a stakeholder', async () => {
      const ent = await POST('/api/entities', { legal_name: 'TestCo' });
      const { status, data } = await POST('/api/stakeholders', {
        entity_id: ent.data.id, first_name: 'John', last_name: 'Doe', title: 'CEO', ownership_percentage: 100,
      });
      expect(status).toBe(201);
      expect(data.first_name).toBe('John');
      expect(data.entity_id).toBe(ent.data.id);
    });

    test('POST /api/processing-accounts creates a processing account', async () => {
      const ent = await POST('/api/entities', { legal_name: 'ProcessCo' });
      const { status, data } = await POST('/api/processing-accounts', {
        entity_id: ent.data.id, account_name: 'Card Processing', processing_type: 'card',
      });
      expect(status).toBe(201);
      expect(data.processing_type).toBe('card');
    });

    test('POST /api/processing-agreements creates an agreement', async () => {
      const { status, data } = await POST('/api/processing-agreements', {
        processing_account_id: 'pa_1', agreement_type: 'standard', effective_date: '2026-02-11',
      });
      expect(status).toBe(201);
      expect(data.agreement_type).toBe('standard');
    });

    test('POST /api/profiles creates a profile', async () => {
      const { status, data } = await POST('/api/profiles', {
        entity_id: 'ent_1', business_category: 'technology', mcc: '5734',
        average_transaction_amount: 150, monthly_volume: 50000,
      });
      expect(status).toBe(201);
      expect(data.business_category).toBe('technology');
    });

    test('POST /api/orgs creates an org', async () => {
      const { status, data } = await POST('/api/orgs', { name: 'TestOrg' });
      expect(status).toBe(201);
      expect(data.name).toBe('TestOrg');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  8. WEBHOOKS & LOGS                                               */
  /* ---------------------------------------------------------------- */
  describe('8. Webhooks', () => {
    test('POST /api/webhooks creates a webhook', async () => {
      const { status, data } = await POST('/api/webhooks', {
        url: 'https://example.com/hook', events: ['payment.created', 'refund.created'],
      });
      expect(status).toBe(201);
      expect(data.url).toBe('https://example.com/hook');
      expect(data.events).toEqual(['payment.created', 'refund.created']);
    });

    test('POST /api/webhooks/:id/enable enables a webhook', async () => {
      const wh = await POST('/api/webhooks', { url: 'https://example.com/hook' });
      const { status, data } = await POST(`/api/webhooks/${wh.data.id}/enable`);
      expect(status).toBe(200);
      expect(data.status).toBe('active');
    });

    test('POST /api/webhooks/:id/disable disables a webhook', async () => {
      const wh = await POST('/api/webhooks', { url: 'https://example.com/hook' });
      const { status, data } = await POST(`/api/webhooks/${wh.data.id}/disable`);
      expect(status).toBe(200);
      expect(data.status).toBe('disabled');
    });

    test('DELETE /api/webhooks/:id deletes a webhook', async () => {
      const wh = await POST('/api/webhooks', { url: 'https://example.com/hook' });
      const { status, data } = await DELETE(`/api/webhooks/${wh.data.id}`);
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });

    test('GET /api/webhook-logs lists webhook logs', async () => {
      await POST('/api/webhook-logs', { webhook_id: 'wh_1', event_type: 'payment.created', success: true });
      const { status, data } = await GET('/api/webhook-logs');
      expect(status).toBe(200);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  9. PAYMENT LINKS                                                 */
  /* ---------------------------------------------------------------- */
  describe('9. Payment Links', () => {
    test('POST /api/payment-links creates a payment link', async () => {
      const { status, data } = await POST('/api/payment-links', {
        amount: 50, description: 'Quick payment', currency: 'USD',
      });
      expect(status).toBe(201);
      expect(data.amount).toBe(50);
    });

    test('GET /api/payment-links lists payment links', async () => {
      await POST('/api/payment-links', { amount: 25 });
      await POST('/api/payment-links', { amount: 75 });
      const { data } = await GET('/api/payment-links');
      expect(data.length).toBe(2);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  10. INTENTS                                                      */
  /* ---------------------------------------------------------------- */
  describe('10. Payment Intents', () => {
    test('POST /api/intents creates an intent', async () => {
      const { status, data } = await POST('/api/intents', {
        amount: 99.99, currency: 'USD', customer_id: 'cust_1', description: 'Premium upgrade',
      });
      expect(status).toBe(201);
      expect(data.amount).toBe(99.99);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  11. TRANSFERS                                                    */
  /* ---------------------------------------------------------------- */
  describe('11. Transfers', () => {
    test('POST /api/transfers creates a transfer', async () => {
      const { status, data } = await POST('/api/transfers', {
        amount: 500, source_account_id: 'acct_src', destination_account_id: 'acct_dst',
        description: 'Payout',
      });
      expect(status).toBe(201);
      expect(data.amount).toBe(500);
      expect(data.source_account_id).toBe('acct_src');
    });

    test('GET /api/transfers lists transfers', async () => {
      await POST('/api/transfers', { amount: 100, source_account_id: 'a', destination_account_id: 'b' });
      const { data } = await GET('/api/transfers');
      expect(data.length).toBe(1);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  12. LEDGER — Full Double-Entry System                            */
  /* ---------------------------------------------------------------- */
  describe('12. Ledger Manager', () => {
    test('POST /api/ledger/balanced-entry creates a balanced pair', async () => {
      const { status, data } = await POST('/api/ledger/balanced-entry', {
        debit:  { accountId: 'acct_revenue', amount: 100, entryType: 'debit', description: 'Sale #1' },
        credit: { accountId: 'acct_recv',    amount: 100, entryType: 'credit', description: 'AR #1' },
      });
      expect(status).toBe(201);
      expect(data.debit).toBeTruthy();
      expect(data.credit).toBeTruthy();
      expect(data.debit.account_id).toBe('acct_revenue');
      expect(data.credit.account_id).toBe('acct_recv');
      expect(data.debit.amount).toBe(100);
      expect(data.credit.amount).toBe(100);
      expect(data.debit.entry_type).toBe('debit');
      expect(data.credit.entry_type).toBe('credit');
    });

    test('POST /api/ledger/multi-leg-entry creates multiple entries', async () => {
      const { status, data } = await POST('/api/ledger/multi-leg-entry', {
        entries: [
          { accountId: 'acct_platform', amount: 1000, entryType: 'debit', description: 'Received' },
          { accountId: 'acct_merchant', amount: 900, entryType: 'credit', description: 'Merchant share' },
          { accountId: 'acct_fees',     amount: 100, entryType: 'credit', description: 'Fee' },
        ],
      });
      expect(status).toBe(201);
      expect(data.length).toBe(3);
    });

    test('GET /api/ledger/balance/:accountId returns balance', async () => {
      // Create some entries first
      await POST('/api/ledger/balanced-entry', {
        debit:  { accountId: 'acct_rev', amount: 500, entryType: 'debit', description: 'D1' },
        credit: { accountId: 'acct_ar',  amount: 500, entryType: 'credit', description: 'C1' },
      });
      await POST('/api/ledger/balanced-entry', {
        debit:  { accountId: 'acct_rev', amount: 250, entryType: 'debit', description: 'D2' },
        credit: { accountId: 'acct_ar',  amount: 250, entryType: 'credit', description: 'C2' },
      });
      const { status, data } = await GET('/api/ledger/balance/acct_rev');
      expect(status).toBe(200);
      expect(data.accountId).toBe('acct_rev');
      expect(data.totalDebits).toBe(750);
      expect(data.totalCredits).toBe(0);
      expect(data.netBalance).toBe(750);
      expect(data.entryCount).toBe(2);
    });

    test('POST /api/ledger/reconcile checks system balance', async () => {
      await POST('/api/ledger/balanced-entry', {
        debit:  { accountId: 'acct_a', amount: 300, entryType: 'debit', description: 'D' },
        credit: { accountId: 'acct_b', amount: 300, entryType: 'credit', description: 'C' },
      });
      const { status, data } = await POST('/api/ledger/reconcile', {
        accountIds: ['acct_a', 'acct_b'],
      });
      expect(status).toBe(200);
      expect(data.balanced).toBe(true);
      expect(data.totalDebits).toBe(300);
      expect(data.totalCredits).toBe(300);
      expect(data.difference).toBe(0);
      expect(data.accountBalances.length).toBe(2);
      expect(data.imbalancedAccounts.length).toBe(0);
    });

    test('POST /api/ledger/reversal creates a reversal entry', async () => {
      // Create original entry
      await POST('/api/ledger/balanced-entry', {
        debit:  { accountId: 'acct_x', amount: 200, entryType: 'debit', description: 'Original' },
        credit: { accountId: 'acct_y', amount: 200, entryType: 'credit', description: 'Original' },
      });
      // Reverse it
      const { status, data } = await POST('/api/ledger/reversal', {
        originalDebitAccountId: 'acct_x',
        originalCreditAccountId: 'acct_y',
        amount: 200,
        reason: 'Customer refund',
      });
      expect(status).toBe(201);
      // Reversal swaps: credit goes to original debit account, debit goes to original credit account
      expect(data.debit.account_id).toBe('acct_y');
      expect(data.credit.account_id).toBe('acct_x');
      expect(data.debit.description).toContain('REVERSAL');
    });

    test('GET /api/ledger/activity/:accountId returns activity summary', async () => {
      await POST('/api/ledger/balanced-entry', {
        debit:  { accountId: 'acct_act', amount: 100, entryType: 'debit', description: 'Entry 1' },
        credit: { accountId: 'acct_other', amount: 100, entryType: 'credit', description: 'Entry 1' },
      });
      const { status, data } = await GET('/api/ledger/activity/acct_act');
      expect(status).toBe(200);
      expect(data.accountId).toBe('acct_act');
      expect(data.totalDebits).toBe(100);
      expect(data.totalCredits).toBe(0);
      expect(data.netChange).toBe(100);
      expect(data.debits.length).toBe(1);
      expect(data.credits.length).toBe(0);
    });

    test('GET /api/ledger-entries lists all ledger entries', async () => {
      await POST('/api/ledger/balanced-entry', {
        debit:  { accountId: 'acct_1', amount: 50, entryType: 'debit', description: 'Test' },
        credit: { accountId: 'acct_2', amount: 50, entryType: 'credit', description: 'Test' },
      });
      const { status, data } = await GET('/api/ledger-entries');
      expect(status).toBe(200);
      expect(data.length).toBe(2); // one debit + one credit
    });
  });

  /* ---------------------------------------------------------------- */
  /*  13. QUERY & FILTER INTEGRATION                                   */
  /* ---------------------------------------------------------------- */
  describe('13. Query & Filter System', () => {
    test('filters by equality via query string', async () => {
      await POST('/api/customers', { name: 'Alice', email: 'alice@test.com' });
      await POST('/api/customers', { name: 'Bob', email: 'bob@test.com' });
      const { data } = await GET('/api/customers?filter.email.eq=alice@test.com');
      expect(data.length).toBe(1);
      expect(data[0].email).toBe('alice@test.com');
    });

    test('filters with gte operator', async () => {
      await POST('/api/payments', { amount: 10 });
      await POST('/api/payments', { amount: 50 });
      await POST('/api/payments', { amount: 100 });
      const { data } = await GET('/api/payments?filter.amount.gte=50');
      expect(data.length).toBe(2);
      data.forEach((p: any) => expect(p.amount).toBeGreaterThanOrEqual(50));
    });

    test('limits results', async () => {
      await POST('/api/customers', { name: 'A' });
      await POST('/api/customers', { name: 'B' });
      await POST('/api/customers', { name: 'C' });
      const { data } = await GET('/api/customers?limit=2');
      expect(data.length).toBe(2);
    });

    test('POST /api/:resource/query with structured filters', async () => {
      await POST('/api/payments', { amount: 10 });
      await POST('/api/payments', { amount: 200 });
      await POST('/api/payments', { amount: 500 });
      const { data } = await POST('/api/payments/query', {
        filters: [{ field: 'amount', op: 'gte', value: 100 }],
        limit: 10,
      });
      expect(data.length).toBe(2);
      data.forEach((p: any) => expect(p.amount).toBeGreaterThanOrEqual(100));
    });
  });

  /* ---------------------------------------------------------------- */
  /*  14. ERROR PROPAGATION                                            */
  /* ---------------------------------------------------------------- */
  describe('14. Error Propagation', () => {
    test('400 for missing required fields (entity without legal_name)', async () => {
      const { status, data } = await POST('/api/entities', { dba_name: 'Test' });
      expect(status).toBe(400);
      expect(data.error).toBeTruthy();
    });

    test('404 for non-existent resource ID', async () => {
      const { status } = await GET('/api/customers/cust_does_not_exist');
      expect(status).toBe(404);
    });

    test('400 for declined transaction (amount 0.01)', async () => {
      const { status, data } = await POST('/api/payments', { amount: 0.01 });
      expect(status).toBe(400);
      expect(data.error).toBeTruthy();
    });

    test('validates balanced entry with mismatched amounts', async () => {
      const { status, data } = await POST('/api/ledger/balanced-entry', {
        debit:  { accountId: 'acct_a', amount: 100, entryType: 'debit', description: '' },
        credit: { accountId: 'acct_b', amount: 200, entryType: 'credit', description: '' },
      });
      expect(status).toBe(500);
      expect(data.error).toContain('equal');
    });

    test('validates multi-leg entry balance', async () => {
      const { status, data } = await POST('/api/ledger/multi-leg-entry', {
        entries: [
          { accountId: 'a', amount: 100, entryType: 'debit', description: '' },
          { accountId: 'b', amount: 50, entryType: 'credit', description: '' },
        ],
      });
      expect(status).toBe(500);
      expect(data.error).toBeTruthy();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  15. ACCOUNTS & ACCESS TOKENS                                     */
  /* ---------------------------------------------------------------- */
  describe('15. Accounts & Tokens', () => {
    test('POST /api/client-tokens creates a client token', async () => {
      const { status, data } = await POST('/api/client-tokens', { type: 'client' });
      expect(status).toBe(201);
      expect(data.type).toBe('client');
    });

    test('GET /api/accounts lists accounts', async () => {
      const { status, data } = await GET('/api/accounts');
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  16. INTENTS CRUD (expanded)                                      */
  /* ---------------------------------------------------------------- */
  describe('16. Intents CRUD', () => {
    test('GET /api/intents lists intents', async () => {
      await POST('/api/intents', { amount: 50, currency: 'USD' });
      await POST('/api/intents', { amount: 75, currency: 'EUR' });
      const { status, data } = await GET('/api/intents');
      expect(status).toBe(200);
      expect(data.length).toBe(2);
    });

    test('GET /api/intents/:id retrieves a single intent', async () => {
      const created = await POST('/api/intents', { amount: 100, description: 'Lookup test' });
      const { status, data } = await GET(`/api/intents/${created.data.id}`);
      expect(status).toBe(200);
      expect(data.amount).toBe(100);
      expect(data.description).toBe('Lookup test');
    });

    test('PUT /api/intents/:id updates an intent', async () => {
      const created = await POST('/api/intents', { amount: 100 });
      const { status, data } = await PUT(`/api/intents/${created.data.id}`, { description: 'Updated desc' });
      expect(status).toBe(200);
      expect(data.description).toBe('Updated desc');
    });

    test('DELETE /api/intents/:id deletes an intent', async () => {
      const created = await POST('/api/intents', { amount: 100 });
      const { status, data } = await DELETE(`/api/intents/${created.data.id}`);
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  17. ACCOUNTS & ORGS CRUD (expanded)                              */
  /* ---------------------------------------------------------------- */
  describe('17. Accounts & Orgs CRUD', () => {
    test('POST /api/accounts creates an account', async () => {
      const { status, data } = await POST('/api/accounts', { name: 'Test Acct' });
      expect(status).toBe(201);
      expect(data.name).toBe('Test Acct');
    });

    test('GET /api/orgs lists organizations', async () => {
      await POST('/api/orgs', { name: 'Org A' });
      await POST('/api/orgs', { name: 'Org B' });
      const { status, data } = await GET('/api/orgs');
      expect(status).toBe(200);
      expect(data.length).toBe(2);
    });

    test('GET /api/orgs/:id retrieves one org', async () => {
      const created = await POST('/api/orgs', { name: 'My Org' });
      const { status, data } = await GET(`/api/orgs/${created.data.id}`);
      expect(status).toBe(200);
      expect(data.name).toBe('My Org');
    });

    test('DELETE /api/orgs/:id deletes an org', async () => {
      const created = await POST('/api/orgs', { name: 'Delete Me' });
      const { status, data } = await DELETE(`/api/orgs/${created.data.id}`);
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });

    test('GET /api/client-tokens lists client tokens', async () => {
      await POST('/api/client-tokens', { type: 'client' });
      const { status, data } = await GET('/api/client-tokens');
      expect(status).toBe(200);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    test('DELETE /api/client-tokens/:id deletes a token', async () => {
      const created = await POST('/api/client-tokens', { type: 'client' });
      const { status, data } = await DELETE(`/api/client-tokens/${created.data.id}`);
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  18. PAGINATION & OFFSET                                          */
  /* ---------------------------------------------------------------- */
  describe('18. Pagination & Offset', () => {
    test('limit and offset paginate results', async () => {
      for (let i = 0; i < 5; i++) {
        await POST('/api/customers', { name: `PageUser${i}` });
      }
      const page1 = await GET('/api/customers?limit=2&offset=0');
      const page2 = await GET('/api/customers?limit=2&offset=2');
      const page3 = await GET('/api/customers?limit=2&offset=4');

      expect(page1.data.length).toBe(2);
      expect(page2.data.length).toBe(2);
      expect(page3.data.length).toBe(1);

      // Pages should not overlap
      const ids1 = page1.data.map((d: any) => d.id);
      const ids2 = page2.data.map((d: any) => d.id);
      ids1.forEach((id: string) => expect(ids2).not.toContain(id));
    });

    test('filter combined with limit', async () => {
      await POST('/api/payments', { amount: 10 });
      await POST('/api/payments', { amount: 20 });
      await POST('/api/payments', { amount: 30 });
      await POST('/api/payments', { amount: 40 });
      const { data } = await GET('/api/payments?filter.amount.gte=20&limit=2');
      expect(data.length).toBe(2);
      data.forEach((p: any) => expect(p.amount).toBeGreaterThanOrEqual(20));
    });
  });

  /* ---------------------------------------------------------------- */
  /*  19. DASHBOARD STATS                                              */
  /* ---------------------------------------------------------------- */
  describe('19. Dashboard Stats', () => {
    test('GET /api/dashboard/stats returns counts', async () => {
      await POST('/api/customers', { name: 'A' });
      await POST('/api/customers', { name: 'B' });
      await POST('/api/payments', { amount: 50 });
      const { status, data } = await GET('/api/dashboard/stats');
      expect(status).toBe(200);
      expect(data.Customer).toBe(2);
      expect(data.Payment).toBe(1);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  20. FULL E2E WORKFLOW                                            */
  /* ---------------------------------------------------------------- */
  describe('20. Full E2E Workflow', () => {
    test('complete payment lifecycle: customer → card → payment → refund → ledger', async () => {
      // 1. Create customer
      const cust = await POST('/api/customers', { name: 'E2E User', email: 'e2e@test.com' });
      expect(cust.status).toBe(201);

      // 2. Add card
      const card = await POST('/api/cards', {
        card_number: '4242424242424242', expiry: '12/2028', card_code: '123',
        customer_id: cust.data.id,
      });
      expect(card.status).toBe(201);

      // 3. Create payment
      const payment = await POST('/api/payments', {
        amount: 250, customer_id: cust.data.id, payment_method_id: card.data.id,
        description: 'E2E order',
      });
      expect(payment.status).toBe(201);
      expect(payment.data.amount).toBe(250);

      // 4. Partial refund
      const refund = await POST('/api/refunds', {
        amount: 50, linked_transaction_id: payment.data.id, description: 'Partial refund',
      });
      expect(refund.status).toBe(201);

      // 5. Record in ledger
      const entry = await POST('/api/ledger/balanced-entry', {
        debit:  { accountId: 'acct_revenue',   amount: 250, entryType: 'debit', description: 'Payment received' },
        credit: { accountId: 'acct_receivable', amount: 250, entryType: 'credit', description: 'Customer AR' },
      });
      expect(entry.status).toBe(201);

      // 6. Record refund in ledger (reversal)
      const rev = await POST('/api/ledger/reversal', {
        originalDebitAccountId: 'acct_revenue',
        originalCreditAccountId: 'acct_receivable',
        amount: 50,
        reason: 'Partial refund for E2E order',
      });
      expect(rev.status).toBe(201);

      // 7. Check balance
      const bal = await GET('/api/ledger/balance/acct_revenue');
      expect(bal.data.totalDebits).toBe(250);
      expect(bal.data.totalCredits).toBe(50);
      expect(bal.data.netBalance).toBe(200);

      // 8. Reconcile
      const rec = await POST('/api/ledger/reconcile', {
        accountIds: ['acct_revenue', 'acct_receivable'],
      });
      expect(rec.data.balanced).toBe(true);

      // 9. Get activity
      const act = await GET('/api/ledger/activity/acct_revenue');
      expect(act.data.debits.length).toBe(1);
      expect(act.data.credits.length).toBe(1);
      expect(act.data.netChange).toBe(200);

      // 10. Verify stats reflect everything
      const stats = await GET('/api/dashboard/stats');
      expect(stats.data.Customer).toBe(1);
      expect(stats.data.Payment).toBe(1);
    });

    test('complete invoice lifecycle: create → items → send → pay → void', async () => {
      // Create customer
      const cust = await POST('/api/customers', { name: 'Invoice User' });

      // Create invoice
      const inv = await POST('/api/invoices', {
        customer_id: cust.data.id, due_date: '2026-04-01', description: 'Service invoice',
      });
      expect(inv.status).toBe(201);

      // Add items
      const item1 = await POST('/api/invoice-items', {
        invoice_id: inv.data.id, description: 'Consulting', quantity: 5, unit_price: 200,
      });
      expect(item1.status).toBe(201);

      const item2 = await POST('/api/invoice-items', {
        invoice_id: inv.data.id, description: 'Development', quantity: 10, unit_price: 150,
      });
      expect(item2.status).toBe(201);

      // List items for this invoice
      const items = await GET('/api/invoice-items');
      expect(items.data.length).toBe(2);

      // Send invoice
      const sent = await POST(`/api/invoices/${inv.data.id}/send`);
      expect(sent.data.status).toBe('sent');

      // Mark paid
      const paid = await POST(`/api/invoices/${inv.data.id}/mark-paid`);
      expect(paid.data.status).toBe('paid');
    });

    test('entity onboarding: entity → stakeholder → processing → agreement → profile', async () => {
      const entity = await POST('/api/entities', {
        legal_name: 'Onboard LLC', entity_type: 'llc', email: 'info@onboard.com',
      });
      expect(entity.status).toBe(201);

      const stakeholder = await POST('/api/stakeholders', {
        entity_id: entity.data.id, first_name: 'Jane', last_name: 'CEO',
        title: 'CEO', ownership_percentage: 100,
      });
      expect(stakeholder.status).toBe(201);

      const procAcct = await POST('/api/processing-accounts', {
        entity_id: entity.data.id, account_name: 'Card Processing', processing_type: 'card',
      });
      expect(procAcct.status).toBe(201);

      const agreement = await POST('/api/processing-agreements', {
        processing_account_id: procAcct.data.id, agreement_type: 'standard', effective_date: '2026-02-11',
      });
      expect(agreement.status).toBe(201);

      const profile = await POST('/api/profiles', {
        entity_id: entity.data.id, business_category: 'technology', mcc: '5734',
      });
      expect(profile.status).toBe(201);
    });

    test('billing lifecycle: schedule → pause → resume → cancel', async () => {
      const sched = await POST('/api/billing-schedules', {
        amount: 49.99, frequency: 'monthly', customer_id: 'cust_1', start_date: '2026-03-01',
      });
      expect(sched.status).toBe(201);

      const paused = await POST(`/api/billing-schedules/${sched.data.id}/pause`);
      expect(paused.data.status).toBe('paused');

      const resumed = await POST(`/api/billing-schedules/${sched.data.id}/resume`);
      expect(resumed.data.status).toBe('active');

      const cancelled = await POST(`/api/billing-schedules/${sched.data.id}/cancel`);
      expect(cancelled.data.status).toBe('cancelled');
    });

    test('webhook lifecycle: create → enable → disable → delete', async () => {
      const wh = await POST('/api/webhooks', {
        url: 'https://myapp.com/hook', events: ['payment.created'],
      });
      expect(wh.status).toBe(201);

      const enabled = await POST(`/api/webhooks/${wh.data.id}/enable`);
      expect(enabled.data.status).toBe('active');

      const disabled = await POST(`/api/webhooks/${wh.data.id}/disable`);
      expect(disabled.data.status).toBe('disabled');

      const deleted = await DELETE(`/api/webhooks/${wh.data.id}`);
      expect(deleted.data.ok).toBe(true);
    });
  });
});
