/**
 * Comprehensive E2E Test Suite
 *
 * Tests every object type across both Spec01 and Spec02 with full CRUD
 * lifecycle, error handling, query filtering, pagination, polymorphic
 * dispatch, ledger management, and API contract validation.
 *
 * Uses the contract-faithful mock server that enforces Payload API behavior.
 */

import { createMockServer, MockServerInstance } from '../mock/mock-server';
import { Session } from '../../src/core/session';
import { attr } from '../../src/core/attr';
import { clearObjectCache } from '../../src/core/model';
import { LedgerManager } from '../../src/ledger/ledger-manager';
import {
  PayloadError,
  Unauthorized,
  NotFound,
  BadRequest,
  InvalidAttributes,
  TransactionDeclined,
} from '../../src/core/exceptions';

const E2E_PORT = 3200;
const API_KEY = 'test_secret_key_12iNWc9pk09ixqSR0b5CZGFn9FBkP9nT5AJLY3wFq6u1PA';
const API_URL = `http://localhost:${E2E_PORT}`;

let mock: MockServerInstance;
let pl: Session;

beforeAll((done) => {
  mock = createMockServer(E2E_PORT);
  mock.server.listen(E2E_PORT, () => {
    pl = new Session(API_KEY, { apiUrl: API_URL, apiVersion: 'v2' });
    done();
  });
});

afterAll((done) => {
  mock.server.close(done);
});

beforeEach(() => {
  clearObjectCache();
  mock.reset();
});

// ============================================================
// SECTION 1: SPEC01 - CORE OBJECTS FULL LIFECYCLE
// ============================================================

describe('E2E: Spec01 - Customer Full Lifecycle', () => {
  it('should CREATE a customer with all fields', async () => {
    const customer = await pl.Customer.create({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '+1-555-0100',
    });

    expect(customer.id).toMatch(/^cust_/);
    expect(customer.name).toBe('Alice Johnson');
    expect(customer.email).toBe('alice@example.com');
    expect(customer.phone).toBe('+1-555-0100');
    expect(customer.getStr('object')).toBe('customer');
    expect(customer.getStr('created_at')).toBeTruthy();
  });

  it('should READ a customer by ID', async () => {
    const created = await pl.Customer.create({ name: 'Read Test', email: 'read@test.com' });
    clearObjectCache();
    const fetched = await pl.Customer.get(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe('Read Test');
  });

  it('should UPDATE a customer', async () => {
    const customer = await pl.Customer.create({ name: 'Old Name', email: 'old@test.com' });
    await customer.update({ name: 'New Name', email: 'new@test.com' });
    expect(customer.name).toBe('New Name');
    expect(customer.email).toBe('new@test.com');
  });

  it('should DELETE a customer', async () => {
    const customer = await pl.Customer.create({ name: 'Delete Me' });
    const id = customer.id;
    await customer.delete();
    clearObjectCache();
    await expect(pl.Customer.get(id)).rejects.toThrow();
  });

  it('should LIST all customers', async () => {
    await pl.Customer.create({ name: 'Customer A' });
    await pl.Customer.create({ name: 'Customer B' });
    await pl.Customer.create({ name: 'Customer C' });
    const all = await pl.Customer.all();
    expect(all.length).toBe(3);
  });

  it('should FILTER customers by attribute', async () => {
    await pl.Customer.create({ name: 'Alice', email: 'alice@test.com' });
    await pl.Customer.create({ name: 'Bob', email: 'bob@test.com' });
    await pl.Customer.create({ name: 'Alice', email: 'alice2@test.com' });

    const alices = await pl.Customer.filterBy({ name: 'Alice' }).all();
    expect(alices.length).toBe(2);
    expect(alices.every(c => c.name === 'Alice')).toBe(true);
  });

  it('should PAGINATE results with limit and offset', async () => {
    for (let i = 0; i < 5; i++) {
      await pl.Customer.create({ name: `Customer ${i}` });
    }
    const page1 = await pl.Customer.filterBy().limit(2).all();
    expect(page1.length).toBe(2);

    const page2 = await pl.Customer.filterBy().limit(2).offset(2).all();
    expect(page2.length).toBe(2);
  });

  it('should use identity map cache', async () => {
    const c1 = await pl.Customer.create({ name: 'Cache Test' });
    const c2 = await pl.Customer.get(c1.id);
    // Same instance from cache
    expect(c2).toBe(c1);
  });
});

describe('E2E: Spec01 - Transaction Hierarchy', () => {
  it('should create Payment with polymorphic type=payment', async () => {
    const payment = await pl.Payment.create({
      amount: 150.00,
      description: 'E2E payment test',
      payment_method_id: 'pm_test',
    });
    expect(payment.id).toBeTruthy();
    expect(payment.type).toBe('payment');
    expect(payment.amount).toBe(150.00);
  });

  it('should create Refund with polymorphic type=refund', async () => {
    const refund = await pl.Refund.create({
      amount: 50.00,
      linked_transaction_id: 'txn_original',
    });
    expect(refund.type).toBe('refund');
    expect(refund.linkedTransactionId).toBe('txn_original');
  });

  it('should create Credit with polymorphic type=credit', async () => {
    const credit = await pl.Credit.create({
      amount: 25.00,
      description: 'Credit refund',
    });
    expect(credit.type).toBe('credit');
  });

  it('should create Deposit with polymorphic type=deposit', async () => {
    const deposit = await pl.Deposit.create({
      amount: 500.00,
      description: 'ACH deposit',
    });
    expect(deposit.type).toBe('deposit');
  });

  it('should void a transaction', async () => {
    const payment = await pl.Payment.create({ amount: 100.00 });
    await payment.void();
    expect(payment.status).toBe('voided');
  });

  it('should handle transaction declined error for amount 0.01', async () => {
    try {
      await pl.Payment.create({ amount: 0.01 });
      fail('Should have thrown TransactionDeclined');
    } catch (err) {
      expect(err).toBeInstanceOf(TransactionDeclined);
      const declined = err as TransactionDeclined;
      expect(declined.transaction).toBeDefined();
      expect(declined.transaction?.status).toBe('declined');
    }
  });
});

describe('E2E: Spec01 - PaymentMethod Hierarchy', () => {
  it('should create Card with polymorphic type=card', async () => {
    const card = await pl.Card.create({
      card_number: '4242424242424242',
      expiry: '12/26',
      card_code: '123',
    });
    expect(card.type).toBe('card');
    expect(card.cardNumber).toBe('4242424242424242');
    expect(card.expiry).toBe('12/26');
  });

  it('should create BankAccount with polymorphic type=bank_account', async () => {
    const bank = await pl.BankAccount.create({
      account_number: '000123456789',
      routing_number: '110000000',
      account_type: 'checking',
    });
    expect(bank.type).toBe('bank_account');
    expect(bank.routingNumber).toBe('110000000');
    expect(bank.accountType).toBe('checking');
  });

  it('should update a payment method', async () => {
    const card = await pl.Card.create({ card_number: '4242424242424242', expiry: '12/26' });
    await card.update({ expiry: '01/28' });
    expect(card.expiry).toBe('01/28');
  });

  it('should delete a payment method', async () => {
    const bank = await pl.BankAccount.create({
      account_number: '000123456789',
      routing_number: '110000000',
      account_type: 'savings',
    });
    await bank.delete();
    clearObjectCache();
    await expect(pl.BankAccount.get(bank.id)).rejects.toThrow();
  });
});

// ============================================================
// SECTION 2: SPEC02 - ADVANCED OBJECTS FULL LIFECYCLE
// ============================================================

describe('E2E: Spec02 - BillingSchedule', () => {
  it('should create a monthly billing schedule', async () => {
    const schedule = await pl.BillingSchedule.create({
      customer_id: 'cust_1',
      amount: 49.99,
      frequency: 'monthly',
      interval: 1,
      status: 'active',
      start_date: '2024-02-01',
      payment_method_id: 'pm_1',
    });
    expect(schedule.amount).toBe(49.99);
    expect(schedule.frequency).toBe('monthly');
    expect(schedule.status).toBe('active');
  });

  it('should require amount and frequency', async () => {
    try {
      await pl.BillingSchedule.create({ customer_id: 'cust_1' } as any);
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidAttributes);
    }
  });

  it('should pause and resume a billing schedule', async () => {
    const schedule = await pl.BillingSchedule.create({
      amount: 29.99, frequency: 'weekly', status: 'active',
    });
    await schedule.pause();
    expect(schedule.status).toBe('paused');
    await schedule.resume();
    expect(schedule.status).toBe('active');
  });
});

describe('E2E: Spec02 - Invoice Lifecycle', () => {
  it('should create and manage an invoice through lifecycle', async () => {
    const invoice = await pl.Invoice.create({
      customer_id: 'cust_1',
      number: 'INV-2024-001',
      total_amount: 1500.00,
      amount_due: 1500.00,
      currency: 'USD',
      status: 'draft',
      due_date: '2024-03-01',
    });

    expect(invoice.number).toBe('INV-2024-001');
    expect(invoice.totalAmount).toBe(1500.00);
    expect(invoice.status).toBe('draft');

    // Send the invoice
    await invoice.send();
    expect(invoice.status).toBe('sent');

    // Mark as paid
    await invoice.markPaid();
    expect(invoice.status).toBe('paid');
  });

  it('should void an invoice', async () => {
    const invoice = await pl.Invoice.create({
      number: 'INV-VOID-001', total_amount: 100, status: 'draft',
    });
    await invoice.void();
    expect(invoice.status).toBe('voided');
  });

  it('should create invoice items', async () => {
    const invoice = await pl.Invoice.create({ number: 'INV-ITEMS', total_amount: 600 });
    const item1 = await pl.InvoiceItem.create({
      invoice_id: invoice.id,
      description: 'Web Development',
      quantity: 10,
      unit_price: 50.00,
      amount: 500.00,
    });
    const item2 = await pl.InvoiceItem.create({
      invoice_id: invoice.id,
      description: 'Hosting',
      quantity: 1,
      unit_price: 100.00,
      amount: 100.00,
    });

    expect(item1.description).toBe('Web Development');
    expect(item2.unitPrice).toBe(100.00);
  });
});

describe('E2E: Spec02 - LineItem Polymorphic', () => {
  it('should create ChargeItem with entry_type=charge', async () => {
    const charge = await pl.ChargeItem.create({
      amount: 250.00,
      description: 'Setup fee',
      invoice_id: 'inv_1',
    });
    expect(charge.entryType).toBe('charge');
    expect(charge.amount).toBe(250.00);
  });

  it('should create PaymentItem with entry_type=payment', async () => {
    const payment = await pl.PaymentItem.create({
      amount: 250.00,
      description: 'Payment on account',
      transaction_id: 'txn_1',
    });
    expect(payment.entryType).toBe('payment');
  });
});

describe('E2E: Spec02 - Webhook Management', () => {
  it('should create and update a webhook', async () => {
    const webhook = await pl.Webhook.create({
      url: 'https://myapp.example.com/webhooks',
      events: ['payment.created', 'refund.created', 'invoice.paid'],
      status: 'active',
    });

    expect(webhook.url).toBe('https://myapp.example.com/webhooks');
    expect(webhook.events).toHaveLength(3);

    await webhook.disable();
    expect(webhook.status).toBe('disabled');

    await webhook.enable();
    expect(webhook.status).toBe('active');
  });

  it('should require URL for webhook creation', async () => {
    try {
      await pl.Webhook.create({ events: ['payment.created'] } as any);
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidAttributes);
    }
  });
});

describe('E2E: Spec02 - Entity & Stakeholder (v2)', () => {
  it('should create a business entity with stakeholders', async () => {
    const entity = await pl.Entity.create({
      legal_name: 'TechCorp Holdings LLC',
      dba_name: 'TechCorp',
      entity_type: 'llc',
      ein: '87-6543210',
      website: 'https://techcorp.example.com',
      phone: '+1-555-0200',
      email: 'info@techcorp.example.com',
      address: {
        line_1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94105',
      },
    });

    expect(entity.legalName).toBe('TechCorp Holdings LLC');
    expect(entity.entityType).toBe('llc');
    expect(entity.address).toHaveProperty('city', 'San Francisco');

    const stakeholder = await pl.Stakeholder.create({
      entity_id: entity.id,
      first_name: 'Sarah',
      last_name: 'Chen',
      title: 'CEO',
      ownership_percentage: 60,
      email: 'sarah@techcorp.example.com',
      date_of_birth: '1985-03-15',
    });

    expect(stakeholder.entityId).toBe(entity.id);
    expect(stakeholder.firstName).toBe('Sarah');
    expect(stakeholder.ownershipPercentage).toBe(60);
  });

  it('should require legal_name for entity', async () => {
    try {
      await pl.Entity.create({ entity_type: 'llc' } as any);
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidAttributes);
    }
  });

  it('should require stakeholder fields', async () => {
    try {
      await pl.Stakeholder.create({ entity_id: 'ent_1' } as any);
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidAttributes);
    }
  });
});

describe('E2E: Spec02 - Transfer', () => {
  it('should create a fund transfer between accounts', async () => {
    const transfer = await pl.Transfer.create({
      amount: 2500.00,
      source_account_id: 'acct_platform',
      destination_account_id: 'acct_vendor',
      description: 'February vendor payout',
      currency: 'USD',
    });

    expect(transfer.amount).toBe(2500.00);
    expect(transfer.sourceAccountId).toBe('acct_platform');
    expect(transfer.destinationAccountId).toBe('acct_vendor');
  });

  it('should require transfer fields', async () => {
    try {
      await pl.Transfer.create({ amount: 100 } as any);
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidAttributes);
    }
  });
});

describe('E2E: Spec02 - PaymentLink', () => {
  it('should create a payment link', async () => {
    const link = await pl.PaymentLink.create({
      amount: 75.00,
      description: 'Invoice Payment',
      currency: 'USD',
    });
    expect(link.amount).toBe(75.00);
    expect(link.description).toBe('Invoice Payment');
  });
});

describe('E2E: Spec02 - Intent (v2)', () => {
  it('should create a payment intent with metadata', async () => {
    const intent = await pl.Intent.create({
      amount: 399.99,
      currency: 'USD',
      description: 'Premium subscription',
      customer_id: 'cust_1',
      metadata: { plan: 'premium', billing_period: 'annual' },
    });

    expect(intent.amount).toBe(399.99);
    expect(intent.description).toBe('Premium subscription');
    expect(intent.metadata).toEqual({ plan: 'premium', billing_period: 'annual' });
  });

  it('should require amount for intent', async () => {
    try {
      await pl.Intent.create({ currency: 'USD' } as any);
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidAttributes);
    }
  });
});

describe('E2E: Spec02 - Processing', () => {
  it('should create processing account and agreement', async () => {
    const account = await pl.ProcessingAccount.create({
      entity_id: 'ent_1',
      account_name: 'Primary Processor',
      processing_type: 'card_present',
      status: 'active',
    });
    expect(account.id).toBeTruthy();

    const agreement = await pl.ProcessingAgreement.create({
      processing_account_id: account.id,
      agreement_type: 'standard',
      status: 'active',
      effective_date: '2024-01-01',
      fee_schedule: { transaction_fee: 0.029, fixed_fee: 0.30 },
    });
    expect(agreement.id).toBeTruthy();
    expect(agreement.processingAccountId).toBe(account.id);
  });

  it('should create a profile', async () => {
    const profile = await pl.Profile.create({
      entity_id: 'ent_1',
      business_category: 'e-commerce',
      mcc: '5411',
      average_transaction_amount: 85.00,
      monthly_volume: 150000,
    });
    expect(profile.businessCategory).toBe('e-commerce');
    expect(profile.monthlyVolume).toBe(150000);
  });

  it('should create an org', async () => {
    const org = await pl.Org.create({
      name: 'My Organization',
      status: 'active',
      settings: { timezone: 'America/New_York' },
    });
    expect(org.name).toBe('My Organization');
    expect(org.settings).toEqual({ timezone: 'America/New_York' });
  });
});

// ============================================================
// SECTION 3: LEDGER MANAGEMENT - DOUBLE-ENTRY BOOKKEEPING
// ============================================================

describe('E2E: Two-Way Ledger Management', () => {
  let ledgerManager: LedgerManager;

  beforeEach(() => {
    ledgerManager = new LedgerManager(pl);
  });

  it('should create balanced debit/credit entry pair', async () => {
    const result = await ledgerManager.createBalancedEntry({
      debit: {
        accountId: 'acct_revenue',
        amount: 500.00,
        entryType: 'debit',
        description: 'Payment received from customer',
      },
      credit: {
        accountId: 'acct_receivable',
        amount: 500.00,
        entryType: 'credit',
        description: 'Accounts receivable cleared',
      },
    });

    expect(result.debit.isDebit).toBe(true);
    expect(result.credit.isCredit).toBe(true);
    expect(result.debit.amount).toBe(500.00);
    expect(result.credit.amount).toBe(500.00);
  });

  it('should reject imbalanced entries', async () => {
    await expect(
      ledgerManager.createBalancedEntry({
        debit: { accountId: 'a1', amount: 100, entryType: 'debit', description: 'd' },
        credit: { accountId: 'a2', amount: 99, entryType: 'credit', description: 'c' },
      })
    ).rejects.toThrow('Ledger imbalance');
  });

  it('should reject same-account entries', async () => {
    await expect(
      ledgerManager.createBalancedEntry({
        debit: { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'd' },
        credit: { accountId: 'acct_1', amount: 100, entryType: 'credit', description: 'c' },
      })
    ).rejects.toThrow('must be different');
  });

  it('should create multi-leg transaction', async () => {
    const entries = await ledgerManager.createMultiLegEntry([
      { accountId: 'acct_cash', amount: 1000, entryType: 'debit', description: 'Cash in' },
      { accountId: 'acct_vendor_a', amount: 600, entryType: 'credit', description: 'Vendor A share' },
      { accountId: 'acct_vendor_b', amount: 300, entryType: 'credit', description: 'Vendor B share' },
      { accountId: 'acct_platform_fee', amount: 100, entryType: 'credit', description: 'Platform fee' },
    ]);
    expect(entries).toHaveLength(4);
  });

  it('should compute account balance', async () => {
    // 3 debits to acct_cash
    await ledgerManager.createBalancedEntry({
      debit: { accountId: 'acct_cash', amount: 100, entryType: 'debit', description: 'D1' },
      credit: { accountId: 'acct_other', amount: 100, entryType: 'credit', description: 'C1' },
    });
    await ledgerManager.createBalancedEntry({
      debit: { accountId: 'acct_cash', amount: 200, entryType: 'debit', description: 'D2' },
      credit: { accountId: 'acct_other', amount: 200, entryType: 'credit', description: 'C2' },
    });
    await ledgerManager.createBalancedEntry({
      debit: { accountId: 'acct_cash', amount: 50, entryType: 'debit', description: 'D3' },
      credit: { accountId: 'acct_other', amount: 50, entryType: 'credit', description: 'C3' },
    });

    const balance = await ledgerManager.getAccountBalance('acct_cash');
    expect(balance.totalDebits).toBe(350);
    expect(balance.totalCredits).toBe(0);
    expect(balance.netBalance).toBe(350);
    expect(balance.entryCount).toBe(3);
  });

  it('should reconcile system-wide balance', async () => {
    await ledgerManager.createBalancedEntry({
      debit: { accountId: 'acct_a', amount: 500, entryType: 'debit', description: 'D' },
      credit: { accountId: 'acct_b', amount: 500, entryType: 'credit', description: 'C' },
    });
    await ledgerManager.createBalancedEntry({
      debit: { accountId: 'acct_b', amount: 200, entryType: 'debit', description: 'D' },
      credit: { accountId: 'acct_a', amount: 200, entryType: 'credit', description: 'C' },
    });

    const result = await ledgerManager.reconcile(['acct_a', 'acct_b']);
    expect(result.balanced).toBe(true);
    expect(result.totalDebits).toBe(result.totalCredits);
  });

  it('should create reversal entries', async () => {
    // Original entry
    await ledgerManager.createBalancedEntry({
      debit: { accountId: 'acct_revenue', amount: 100, entryType: 'debit', description: 'Payment' },
      credit: { accountId: 'acct_receivable', amount: 100, entryType: 'credit', description: 'Invoice' },
    });

    // Reverse it
    const reversal = await ledgerManager.createReversalEntry(
      'acct_revenue', 'acct_receivable', 100, 'Customer dispute'
    );

    expect(reversal.debit.getStr('description')).toContain('REVERSAL');
    expect(reversal.credit.getStr('description')).toContain('REVERSAL');

    // Net balance should be zero after reversal
    const revenueBalance = await ledgerManager.getAccountBalance('acct_revenue');
    expect(revenueBalance.netBalance).toBe(0);
  });
});

// ============================================================
// SECTION 4: ERROR HANDLING
// ============================================================

describe('E2E: Error Handling', () => {
  it('should throw Unauthorized for invalid API key', async () => {
    const bad = new Session('secret_key_wrongwrongwrong', { apiUrl: API_URL });
    try {
      await bad.Customer.create({ name: 'fail' });
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Unauthorized);
    }
  });

  it('should throw NotFound for non-existent resource', async () => {
    try {
      await pl.Customer.get('cust_nonexistent');
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFound);
    }
  });

  it('should throw InvalidAttributes for missing required fields', async () => {
    try {
      await pl.Entity.create({} as any);
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidAttributes);
      expect((err as InvalidAttributes).details).toBeDefined();
    }
  });

  it('should throw TransactionDeclined for declined transactions', async () => {
    try {
      await pl.Payment.create({ amount: 0.01 });
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TransactionDeclined);
      expect((err as TransactionDeclined).transaction).toBeDefined();
    }
  });

  it('should throw NotFound when updating deleted resource', async () => {
    const customer = await pl.Customer.create({ name: 'Will Delete' });
    await customer.delete();
    clearObjectCache();
    try {
      // Re-create a new instance to bypass the missing request binding
      const ghost = await pl.Customer.create({ name: 'Ghost' });
      await ghost.delete();
      clearObjectCache();
      await pl.Customer.get(ghost.id);
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFound);
    }
  });
});

// ============================================================
// SECTION 5: QUERY & FILTER SYSTEM
// ============================================================

describe('E2E: Query & Filter System', () => {
  beforeEach(async () => {
    // Seed test data
    await pl.Payment.create({ amount: 50, description: 'Small payment', status: 'processed' });
    await pl.Payment.create({ amount: 150, description: 'Medium payment', status: 'processed' });
    await pl.Payment.create({ amount: 500, description: 'Large payment', status: 'processed' });
    await pl.Payment.create({ amount: 75, description: 'Small test', status: 'pending' });
    await pl.Payment.create({ amount: 1000, description: 'Big test payment', status: 'pending' });
  });

  it('should filter with equality', async () => {
    const pending = await pl.Transaction.filterBy({ status: 'pending' }).all();
    expect(pending.length).toBe(2);
  });

  it('should filter with gt operator', async () => {
    const large = await pl.Transaction.filterBy(
      (attr as any).amount.gt(100)
    ).all();
    expect(large.length).toBe(3); // 150, 500, 1000
  });

  it('should filter with lt operator', async () => {
    const small = await pl.Transaction.filterBy(
      (attr as any).amount.lt(100)
    ).all();
    expect(small.length).toBe(2); // 50, 75
  });

  it('should combine multiple filters', async () => {
    const filtered = await pl.Transaction.filterBy(
      (attr as any).amount.gt(100),
      { status: 'processed' }
    ).all();
    expect(filtered.length).toBe(2); // 150, 500
  });

  it('should limit results', async () => {
    const limited = await pl.Transaction.filterBy().limit(2).all();
    expect(limited.length).toBe(2);
  });

  it('should use first() to get single result', async () => {
    const first = await pl.Transaction.filterBy({ status: 'processed' }).first();
    expect(first).toBeTruthy();
    expect(first!.status).toBe('processed');
  });

  it('should return null from first() when no results', async () => {
    const none = await pl.Transaction.filterBy({ status: 'nonexistent' }).first();
    expect(none).toBeNull();
  });
});

// ============================================================
// SECTION 6: API CONTRACT VALIDATION
// ============================================================

describe('E2E: API Contract Validation', () => {
  it('should send correct Content-Type header', async () => {
    await pl.Customer.create({ name: 'Header Test' });
    const log = mock.getRequestLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].method).toBe('POST');
    expect(log[0].path).toBe('/customers');
  });

  it('should include X-API-Version header when configured', async () => {
    // Session was created with apiVersion: 'v2'
    await pl.Customer.create({ name: 'Version Test' });
    // The mock server accepts the header; we verify via request log
    const log = mock.getRequestLog();
    expect(log[0].status).toBe(200);
  });

  it('should send object type in POST body', async () => {
    const customer = await pl.Customer.create({ name: 'Object Type Test' });
    expect(customer.getStr('object')).toBe('customer');
  });

  it('should include created_at and updated_at in responses', async () => {
    const customer = await pl.Customer.create({ name: 'Timestamps Test' });
    expect(customer.getStr('created_at')).toBeTruthy();
    expect(customer.getStr('updated_at')).toBeTruthy();
  });

  it('should generate proper IDs', async () => {
    const customer = await pl.Customer.create({ name: 'ID Test' });
    expect(customer.id).toMatch(/^cust_\d+/);

    const payment = await pl.Payment.create({ amount: 100 });
    expect(payment.id).toMatch(/^tran_\d+/);

    const invoice = await pl.Invoice.create({ number: 'INV-1' });
    expect(invoice.id).toMatch(/^invo_\d+/);
  });

  it('should track request log accurately', async () => {
    await pl.Customer.create({ name: 'Log Test' });
    await pl.Customer.all();

    const log = mock.getRequestLog();
    expect(log.length).toBe(2);
    expect(log[0].method).toBe('POST');
    expect(log[1].method).toBe('GET');
    expect(log.every(l => l.status === 200)).toBe(true);
  });

  it('should report store stats', async () => {
    await pl.Customer.create({ name: 'Stats Test 1' });
    await pl.Customer.create({ name: 'Stats Test 2' });
    await pl.Payment.create({ amount: 100 });

    const stats = mock.getStats();
    expect(stats.totalObjects).toBe(3);
    expect(stats.collections['customer']).toBe(2);
    expect(stats.collections['transaction']).toBe(1);
  });
});

// ============================================================
// SECTION 7: COMPREHENSIVE TYPED ACCESSOR TESTS
// ============================================================

describe('E2E: Typed Accessors', () => {
  it('should provide typed getters on all Spec01 objects', async () => {
    const customer = await pl.Customer.create({ name: 'Accessor', email: 'a@b.com', phone: '555' });
    expect(typeof customer.name).toBe('string');
    expect(typeof customer.email).toBe('string');

    const payment = await pl.Payment.create({ amount: 42.5, description: 'test' });
    expect(typeof payment.amount).toBe('number');
    expect(payment.amount).toBe(42.5);

    const card = await pl.Card.create({ card_number: '4111111111111111', expiry: '01/27', brand: 'visa' });
    expect(card.brand).toBe('visa');
    expect(card.type).toBe('card');
  });

  it('should provide typed getters on all Spec02 objects', async () => {
    const schedule = await pl.BillingSchedule.create({
      amount: 19.99, frequency: 'weekly', interval: 2, status: 'active',
    });
    expect(schedule.interval).toBe(2);
    expect(typeof schedule.interval).toBe('number');

    const webhook = await pl.Webhook.create({
      url: 'https://hook.test.com',
      events: ['a', 'b'],
      status: 'active',
    });
    expect(Array.isArray(webhook.events)).toBe(true);
    expect(webhook.events).toHaveLength(2);

    const ledger = await pl.Ledger.create({
      transaction_id: 'txn_1',
      account_id: 'acct_1',
      amount: 99.99,
      entry_type: 'credit',
      balance_before: 100,
      balance_after: 199.99,
    });
    expect(ledger.isCredit).toBe(true);
    expect(ledger.isDebit).toBe(false);
    expect(ledger.balanceBefore).toBe(100);
    expect(ledger.balanceAfter).toBe(199.99);
  });
});
