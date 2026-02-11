/**
 * Integration Tests - Full end-to-end testing against the mock server.
 *
 * Spins up a local mock Payload API server and exercises the complete
 * SDK flow for both Spec01 and Spec02 objects.
 */

import http from 'http';
import { createMockServer } from './mock-server';
import { Session } from '../../src/core/session';
import { clearObjectCache } from '../../src/core/model';

const TEST_PORT = 3199;
const TEST_API_KEY = 'secret_key_test1234567890';
const TEST_API_URL = `http://localhost:${TEST_PORT}`;

let server: http.Server;
let session: Session;

beforeAll((done) => {
  server = createMockServer(TEST_PORT);
  server.listen(TEST_PORT, () => {
    session = new Session(TEST_API_KEY, { apiUrl: TEST_API_URL });
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  clearObjectCache();
});

describe('Integration: Spec01 - Core Objects', () => {
  describe('Customer CRUD', () => {
    it('should create a customer', async () => {
      const customer = await session.Customer.create({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0101',
      });

      expect(customer.id).toBeTruthy();
      expect(customer.name).toBe('Jane Doe');
      expect(customer.email).toBe('jane@example.com');
    });

    it('should get a customer by ID', async () => {
      const created = await session.Customer.create({ name: 'Get Test' });
      const fetched = await session.Customer.get(created.id);
      expect(fetched.name).toBe('Get Test');
    });

    it('should update a customer', async () => {
      const customer = await session.Customer.create({ name: 'Before' });
      await customer.update({ name: 'After' });
      expect(customer.name).toBe('After');
    });

    it('should delete a customer', async () => {
      const customer = await session.Customer.create({ name: 'To Delete' });
      await customer.delete();
      // Verify it's gone - should throw 404
      await expect(session.Customer.get(customer.id)).rejects.toThrow();
    });

    it('should list all customers', async () => {
      await session.Customer.create({ name: 'List Test 1' });
      await session.Customer.create({ name: 'List Test 2' });
      const all = await session.Customer.all();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Payment (polymorphic Transaction)', () => {
    it('should create a payment with polymorphic type', async () => {
      const payment = await session.Payment.create({
        amount: 99.99,
        description: 'Test payment',
      });

      expect(payment.id).toBeTruthy();
      expect(payment.amount).toBe(99.99);
      expect(payment.type).toBe('payment');
    });

    it('should create a refund', async () => {
      const refund = await session.Refund.create({
        amount: 25.00,
        linked_transaction_id: 'txn_original',
      });

      expect(refund.type).toBe('refund');
      expect(refund.amount).toBe(25.00);
    });
  });

  describe('Card (polymorphic PaymentMethod)', () => {
    it('should create a card with polymorphic type', async () => {
      const card = await session.Card.create({
        card_number: '4242424242424242',
        expiry: '12/25',
      });

      expect(card.id).toBeTruthy();
      expect(card.type).toBe('card');
      expect(card.cardNumber).toBe('4242424242424242');
    });
  });

  describe('BankAccount', () => {
    it('should create a bank account', async () => {
      const bank = await session.BankAccount.create({
        account_number: '123456789',
        routing_number: '021000021',
        account_type: 'checking',
      });

      expect(bank.type).toBe('bank_account');
      expect(bank.accountType).toBe('checking');
    });
  });
});

describe('Integration: Spec02 - Advanced Objects', () => {
  describe('BillingSchedule', () => {
    it('should create a billing schedule', async () => {
      const schedule = await session.BillingSchedule.create({
        customer_id: 'cust_1',
        amount: 29.99,
        frequency: 'monthly',
        interval: 1,
        status: 'active',
      });

      expect(schedule.id).toBeTruthy();
      expect(schedule.amount).toBe(29.99);
      expect(schedule.frequency).toBe('monthly');
    });
  });

  describe('Invoice', () => {
    it('should create and manage an invoice', async () => {
      const invoice = await session.Invoice.create({
        customer_id: 'cust_1',
        number: 'INV-001',
        total_amount: 500.00,
        amount_due: 500.00,
        currency: 'USD',
        status: 'draft',
      });

      expect(invoice.id).toBeTruthy();
      expect(invoice.totalAmount).toBe(500.00);
      expect(invoice.status).toBe('draft');
    });
  });

  describe('InvoiceItem', () => {
    it('should create an invoice item', async () => {
      const item = await session.InvoiceItem.create({
        invoice_id: 'inv_1',
        description: 'Consulting services',
        quantity: 10,
        unit_price: 50.00,
        amount: 500.00,
      });

      expect(item.id).toBeTruthy();
      expect(item.description).toBe('Consulting services');
    });
  });

  describe('LineItem polymorphic', () => {
    it('should create a ChargeItem', async () => {
      const charge = await session.ChargeItem.create({
        amount: 100,
        description: 'Service charge',
      });
      expect(charge.entryType).toBe('charge');
    });

    it('should create a PaymentItem', async () => {
      const payment = await session.PaymentItem.create({
        amount: 100,
        description: 'Payment received',
      });
      expect(payment.entryType).toBe('payment');
    });
  });

  describe('Webhook', () => {
    it('should create a webhook', async () => {
      const webhook = await session.Webhook.create({
        url: 'https://example.com/webhooks/payload',
        events: ['payment.created', 'payment.updated'],
        status: 'active',
      });

      expect(webhook.id).toBeTruthy();
      expect(webhook.url).toBe('https://example.com/webhooks/payload');
    });
  });

  describe('Entity (v2)', () => {
    it('should create a business entity', async () => {
      const entity = await session.Entity.create({
        legal_name: 'Acme Corp LLC',
        dba_name: 'Acme',
        entity_type: 'llc',
        ein: '12-3456789',
      });

      expect(entity.id).toBeTruthy();
      expect(entity.legalName).toBe('Acme Corp LLC');
      expect(entity.entityType).toBe('llc');
    });
  });

  describe('Stakeholder', () => {
    it('should create a stakeholder', async () => {
      const sh = await session.Stakeholder.create({
        entity_id: 'ent_1',
        first_name: 'John',
        last_name: 'Doe',
        ownership_percentage: 75,
        title: 'CEO',
      });

      expect(sh.id).toBeTruthy();
      expect(sh.firstName).toBe('John');
      expect(sh.ownershipPercentage).toBe(75);
    });
  });

  describe('Transfer', () => {
    it('should create a transfer', async () => {
      const transfer = await session.Transfer.create({
        amount: 1000.00,
        source_account_id: 'acct_1',
        destination_account_id: 'acct_2',
        description: 'Vendor payout',
      });

      expect(transfer.id).toBeTruthy();
      expect(transfer.amount).toBe(1000.00);
    });
  });

  describe('PaymentLink', () => {
    it('should create a payment link', async () => {
      const link = await session.PaymentLink.create({
        amount: 50.00,
        description: 'Donation',
        currency: 'USD',
      });

      expect(link.id).toBeTruthy();
      expect(link.amount).toBe(50.00);
    });
  });

  describe('Intent (v2)', () => {
    it('should create a payment intent', async () => {
      const intent = await session.Intent.create({
        amount: 200,
        currency: 'USD',
        description: 'Order #123',
        metadata: { order_id: 'ord_123' },
      });

      expect(intent.id).toBeTruthy();
      expect(intent.amount).toBe(200);
    });
  });

  describe('Ledger', () => {
    it('should create ledger entries', async () => {
      const entry = await session.Ledger.create({
        transaction_id: 'txn_1',
        account_id: 'acct_1',
        amount: 100,
        entry_type: 'debit',
        description: 'Payment received',
      });

      expect(entry.id).toBeTruthy();
      expect(entry.amount).toBe(100);
      expect(entry.isDebit).toBe(true);
    });
  });

  describe('ProcessingAccount', () => {
    it('should create a processing account', async () => {
      const pa = await session.ProcessingAccount.create({
        entity_id: 'ent_1',
        account_name: 'Main Processing',
        status: 'active',
      });

      expect(pa.id).toBeTruthy();
    });
  });

  describe('Profile', () => {
    it('should create a profile', async () => {
      const profile = await session.Profile.create({
        entity_id: 'ent_1',
        business_category: 'retail',
        mcc: '5411',
        monthly_volume: 50000,
      });

      expect(profile.id).toBeTruthy();
      expect(profile.businessCategory).toBe('retail');
    });
  });
});

describe('Integration: Authentication', () => {
  it('should reject invalid API key', async () => {
    const badSession = new Session('secret_key_invalidkey999', { apiUrl: TEST_API_URL });
    await expect(badSession.Customer.create({ name: 'test' })).rejects.toThrow();
  });
});

describe('Integration: Session', () => {
  it('should mask API key', () => {
    const masked = session.getMaskedApiKey();
    expect(masked).toContain('...');
    expect(masked).not.toContain(TEST_API_KEY);
  });
});
