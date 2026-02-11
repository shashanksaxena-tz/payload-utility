# Payload Utility

## What This System Is

This is a **TypeScript SDK** for the [Payload payment gateway](https://payload.co) built on the **ARM (API Relational Model)** pattern — an ORM-like abstraction over REST APIs. Instead of manually constructing HTTP requests, you work with typed model objects (`Customer`, `Payment`, `Invoice`, etc.) through a `Session` that handles authentication, serialization, and request lifecycle.

The SDK covers two specification levels:

- **Spec01 (Core)** — Fundamental payment processing: customers, transactions (payments, refunds, credits, deposits), payment methods (cards, bank accounts), accounts, access tokens.
- **Spec02 (Advanced)** — Higher-level business operations: recurring billing, invoicing, entities (business onboarding), transfers, webhooks, payment links, processing accounts, and a double-entry ledger system.

---

## Prerequisites

- **Node.js** >= 18.0.0
- **npm**
- A **Payload sandbox API key** (format: `test_secret_key_...` or `secret_key_...`)

---

## Setup (Step by Step)

### Step 1: Install Dependencies

```bash
cd payload-utility
npm install
```

### Step 2: Build the Project

```bash
npm run build
```

This compiles all TypeScript from `src/` into `dist/` with type declaration files. You should see no errors.

### Step 3: Configure Your API Key

```bash
cp .env.example .env
```

Edit `.env`:

```
PAYLOAD_API_KEY=test_secret_key_12iNWc9pk09ixqSR0b5CZGFn9FBkP9nT5AJLY3wFq6u1PA
PAYLOAD_API_URL=https://api.payload.co
PAYLOAD_API_VERSION=v2
MOCK_SERVER_PORT=3100
```

Replace the API key with your own sandbox key.

### Step 4: Verify Everything Works

```bash
npm test
```

Expected output: **207 tests passing, 9 suites, ~80% coverage**. All tests run against an auto-started mock server, so no external connectivity is needed to verify the SDK itself works.

---

## How Authentication Works

Payload uses **HTTP Basic Auth**. The API key is the username, the password is empty:

```
Authorization: Basic base64("your_api_key:")
```

The SDK handles this automatically — you just pass the key to `Session`:

```typescript
const pl = new Session('test_secret_key_...', {
  apiUrl: 'https://api.payload.co',
  apiVersion: 'v2',
});
```

Every operation through `pl.Customer`, `pl.Payment`, etc. includes this auth header automatically.

---

## All Available Commands

| Command | What It Does |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm test` | Run all 207 tests with coverage report |
| `npm run test:unit` | Run only unit tests (no server needed) |
| `npm run test:mock` | Run only integration tests (auto-starts mock server) |
| `npx jest tests/e2e` | Run only E2E tests (auto-starts mock server) |
| `npx jest --verbose` | Run all tests with detailed per-test output |
| `npx jest --watch` | Run tests in watch mode (re-runs on file changes) |
| `npx jest path/to/test.ts` | Run a single test file |
| `npm run start:mock-server` | Start the mock API server standalone on port 3100 |

---

## Testing Against the Real Payload API

The automated test suite runs against the built-in mock server. To test against the **real Payload sandbox API**, you need to create a test script that points to `https://api.payload.co`.

### Create a Test Script

Create a file called `test-real-api.ts` in the project root:

```typescript
import { Session, attr, LedgerManager } from './src';

const API_KEY = process.env.PAYLOAD_API_KEY || 'test_secret_key_YOUR_KEY_HERE';

const pl = new Session(API_KEY, {
  apiUrl: 'https://api.payload.co',
  apiVersion: 'v2',
});

async function run() {
  console.log('=== Payload SDK Real API Test ===\n');

  // -------------------------------------------------------
  // 1. CUSTOMER MANAGEMENT
  // -------------------------------------------------------
  console.log('--- 1. Customer Management ---');

  // Create a customer
  const customer = await pl.Customer.create({
    name: 'Test User',
    email: 'testuser@example.com',
    phone: '555-123-4567',
  });
  console.log('Created customer:', customer.id, customer.get('name'));

  // Retrieve the customer
  const fetched = await pl.Customer.get(customer.id);
  console.log('Fetched customer:', fetched.get('name'), fetched.get('email'));

  // Update the customer
  const updated = await pl.Customer.update(customer.id, {
    name: 'Updated Test User',
  });
  console.log('Updated customer name:', updated.get('name'));

  // List all customers
  const allCustomers = await pl.Customer.all();
  console.log('Total customers:', allCustomers.length);

  // Query with filter
  const filtered = await pl.Customer.filterBy(
    attr.email.eq('testuser@example.com')
  ).all();
  console.log('Filtered customers (by email):', filtered.length);

  // -------------------------------------------------------
  // 2. PAYMENT PROCESSING
  // -------------------------------------------------------
  console.log('\n--- 2. Payment Processing ---');

  // Create a card payment method
  const card = await pl.Card.create({
    card_number: '4242424242424242',  // Payload test card
    expiry: '12/2028',
    card_code: '123',
    customer_id: customer.id,
  });
  console.log('Created card:', card.id, 'last4:', card.get('last_four') || card.get('card_number'));

  // Create a payment
  const payment = await pl.Payment.create({
    amount: 25.00,
    payment_method_id: card.id,
    customer_id: customer.id,
    description: 'SDK test payment',
  });
  console.log('Created payment:', payment.id, 'amount:', payment.amount, 'status:', payment.status);

  // List payments
  const payments = await pl.Payment.all();
  console.log('Total payments:', payments.length);

  // Query high-value payments
  const highPayments = await pl.Payment.filterBy(
    attr.amount.gte(10)
  ).all();
  console.log('Payments >= $10:', highPayments.length);

  // Get first payment matching a filter
  const firstPayment = await pl.Payment.filterBy(
    attr.amount.gt(0)
  ).first();
  console.log('First payment:', firstPayment?.id, firstPayment?.amount);

  // -------------------------------------------------------
  // 3. REFUNDS
  // -------------------------------------------------------
  console.log('\n--- 3. Refunds ---');

  const refund = await pl.Refund.create({
    amount: 5.00,
    linked_transaction_id: payment.id,
    description: 'Partial refund test',
  });
  console.log('Created refund:', refund.id, 'amount:', refund.amount);

  // -------------------------------------------------------
  // 4. BANK ACCOUNTS
  // -------------------------------------------------------
  console.log('\n--- 4. Bank Accounts ---');

  const bankAccount = await pl.BankAccount.create({
    account_number: '1234567890',
    routing_number: '021000021',  // Chase test routing
    account_type: 'checking',
    customer_id: customer.id,
  });
  console.log('Created bank account:', bankAccount.id, bankAccount.get('account_type'));

  // -------------------------------------------------------
  // 5. BILLING SCHEDULES (Recurring Payments)
  // -------------------------------------------------------
  console.log('\n--- 5. Billing Schedules ---');

  const schedule = await pl.BillingSchedule.create({
    customer_id: customer.id,
    amount: 29.99,
    frequency: 'monthly',
    start_date: '2026-03-01',
    payment_method_id: card.id,
    description: 'Monthly subscription',
  });
  console.log('Created billing schedule:', schedule.id, schedule.get('frequency'), '$' + schedule.amount);

  // List billing schedules
  const schedules = await pl.BillingSchedule.all();
  console.log('Total billing schedules:', schedules.length);

  // -------------------------------------------------------
  // 6. INVOICING
  // -------------------------------------------------------
  console.log('\n--- 6. Invoicing ---');

  // Create an invoice
  const invoice = await pl.Invoice.create({
    customer_id: customer.id,
    due_date: '2026-04-01',
    description: 'Consulting services - March 2026',
  });
  console.log('Created invoice:', invoice.id, 'status:', invoice.get('status'));

  // Add line items to the invoice
  const item1 = await pl.InvoiceItem.create({
    invoice_id: invoice.id,
    description: 'Strategy consulting (10 hours)',
    quantity: 10,
    unit_price: 150.00,
  });
  console.log('Added invoice item:', item1.id, '$' + item1.get('unit_price'), 'x', item1.get('quantity'));

  const item2 = await pl.InvoiceItem.create({
    invoice_id: invoice.id,
    description: 'Technical implementation (5 hours)',
    quantity: 5,
    unit_price: 200.00,
  });
  console.log('Added invoice item:', item2.id, '$' + item2.get('unit_price'), 'x', item2.get('quantity'));

  // List invoice items
  const items = await pl.InvoiceItem.filterBy(
    attr.invoice_id.eq(invoice.id)
  ).all();
  console.log('Invoice items:', items.length);

  // List invoices
  const invoices = await pl.Invoice.all();
  console.log('Total invoices:', invoices.length);

  // -------------------------------------------------------
  // 7. ENTITIES (Business Onboarding)
  // -------------------------------------------------------
  console.log('\n--- 7. Entities ---');

  const entity = await pl.Entity.create({
    legal_name: 'Acme Technologies LLC',
    dba_name: 'Acme Tech',
    entity_type: 'llc',
    phone: '555-987-6543',
    email: 'info@acmetech.example.com',
    website: 'https://acmetech.example.com',
  });
  console.log('Created entity:', entity.id, entity.get('legal_name'));

  // Add a stakeholder to the entity
  const stakeholder = await pl.Stakeholder.create({
    entity_id: entity.id,
    first_name: 'John',
    last_name: 'Smith',
    email: 'john@acmetech.example.com',
    title: 'CEO',
    ownership_percentage: 100,
  });
  console.log('Created stakeholder:', stakeholder.id, stakeholder.get('first_name'), stakeholder.get('last_name'));

  // -------------------------------------------------------
  // 8. WEBHOOKS
  // -------------------------------------------------------
  console.log('\n--- 8. Webhooks ---');

  const webhook = await pl.Webhook.create({
    url: 'https://example.com/webhook/payload-events',
    events: ['payment.created', 'payment.updated', 'refund.created'],
  });
  console.log('Created webhook:', webhook.id, 'url:', webhook.get('url'));
  console.log('  Events:', webhook.get('events'));

  // List webhooks
  const webhooks = await pl.Webhook.all();
  console.log('Total webhooks:', webhooks.length);

  // Check webhook logs
  const webhookLogs = await pl.WebhookLog.filterBy(
    attr.webhook_id.eq(webhook.id)
  ).all();
  console.log('Webhook delivery logs:', webhookLogs.length);

  // -------------------------------------------------------
  // 9. PAYMENT LINKS
  // -------------------------------------------------------
  console.log('\n--- 9. Payment Links ---');

  const paymentLink = await pl.PaymentLink.create({
    amount: 50.00,
    description: 'Quick payment link test',
    currency: 'USD',
  });
  console.log('Created payment link:', paymentLink.id, 'url:', paymentLink.get('url'));

  // -------------------------------------------------------
  // 10. INTENTS (Payment Intents)
  // -------------------------------------------------------
  console.log('\n--- 10. Payment Intents ---');

  const intent = await pl.Intent.create({
    amount: 75.00,
    currency: 'USD',
    customer_id: customer.id,
    description: 'Intent for future payment',
  });
  console.log('Created intent:', intent.id, 'amount:', intent.get('amount'), 'client_secret:', intent.get('client_secret'));

  // -------------------------------------------------------
  // 11. TRANSFERS
  // -------------------------------------------------------
  console.log('\n--- 11. Transfers ---');

  const transfer = await pl.Transfer.create({
    amount: 100.00,
    source_account_id: 'acct_source_001',
    destination_account_id: 'acct_dest_001',
    description: 'Platform payout',
  });
  console.log('Created transfer:', transfer.id, '$' + transfer.amount);

  // -------------------------------------------------------
  // 12. DOUBLE-ENTRY LEDGER
  // -------------------------------------------------------
  console.log('\n--- 12. Double-Entry Ledger ---');

  const ledger = new LedgerManager(pl);

  // Create a balanced entry pair (every transaction must balance)
  const entry1 = await ledger.createBalancedEntry({
    debit: {
      accountId: 'acct_revenue',
      amount: 500.00,
      entryType: 'debit',
      description: 'Revenue from sale #1001',
    },
    credit: {
      accountId: 'acct_receivable',
      amount: 500.00,
      entryType: 'credit',
      description: 'Customer receivable #1001',
    },
  });
  console.log('Balanced entry created:');
  console.log('  Debit:', entry1.debit.id, 'acct_revenue', '$500');
  console.log('  Credit:', entry1.credit.id, 'acct_receivable', '$500');

  // Create another entry
  const entry2 = await ledger.createBalancedEntry({
    debit: {
      accountId: 'acct_revenue',
      amount: 250.00,
      entryType: 'debit',
      description: 'Revenue from sale #1002',
    },
    credit: {
      accountId: 'acct_receivable',
      amount: 250.00,
      entryType: 'credit',
      description: 'Customer receivable #1002',
    },
  });
  console.log('Second balanced entry created:');
  console.log('  Debit:', entry2.debit.id, '$250');
  console.log('  Credit:', entry2.credit.id, '$250');

  // Multi-leg transaction (3-way split)
  const multiLeg = await ledger.createMultiLegEntry([
    { accountId: 'acct_platform', amount: 1000, entryType: 'debit', description: 'Platform receives $1000' },
    { accountId: 'acct_merchant', amount: 900, entryType: 'credit', description: 'Merchant gets $900' },
    { accountId: 'acct_fees', amount: 100, entryType: 'credit', description: 'Platform fee $100' },
  ]);
  console.log('Multi-leg entry:', multiLeg.length, 'entries (1 debit, 2 credits)');

  // Check account balance
  const revenueBalance = await ledger.getAccountBalance('acct_revenue');
  console.log('Revenue account balance:');
  console.log('  Total debits:', revenueBalance.totalDebits);
  console.log('  Total credits:', revenueBalance.totalCredits);
  console.log('  Net balance:', revenueBalance.netBalance);
  console.log('  Entry count:', revenueBalance.entryCount);

  // Reconcile across accounts
  const reconciliation = await ledger.reconcile([
    'acct_revenue', 'acct_receivable', 'acct_platform', 'acct_merchant', 'acct_fees',
  ]);
  console.log('Reconciliation result:');
  console.log('  Balanced:', reconciliation.balanced);
  console.log('  Total debits:', reconciliation.totalDebits);
  console.log('  Total credits:', reconciliation.totalCredits);
  console.log('  Difference:', reconciliation.difference);
  if (reconciliation.imbalancedAccounts.length > 0) {
    console.log('  Imbalanced accounts:', reconciliation.imbalancedAccounts);
  }

  // Create a reversal entry
  const reversal = await ledger.createReversalEntry(
    'acct_revenue',
    'acct_receivable',
    250.00,
    'Customer refund for sale #1002',
  );
  console.log('Reversal entry created:');
  console.log('  Debit:', reversal.debit.id, '(acct_receivable gets debited back)');
  console.log('  Credit:', reversal.credit.id, '(acct_revenue gets credited back)');

  // Activity summary
  const activity = await ledger.getActivitySummary('acct_revenue');
  console.log('Revenue account activity:');
  console.log('  Debit entries:', activity.debits.length);
  console.log('  Credit entries:', activity.credits.length);
  console.log('  Net change:', activity.netChange);

  // -------------------------------------------------------
  // 13. PROCESSING ACCOUNTS & AGREEMENTS
  // -------------------------------------------------------
  console.log('\n--- 13. Processing Accounts ---');

  const processingAcct = await pl.ProcessingAccount.create({
    entity_id: entity.id,
    account_name: 'Primary Processing',
    processing_type: 'card',
  });
  console.log('Created processing account:', processingAcct.id);

  const agreement = await pl.ProcessingAgreement.create({
    processing_account_id: processingAcct.id,
    agreement_type: 'standard',
    effective_date: '2026-02-11',
  });
  console.log('Created processing agreement:', agreement.id);

  // -------------------------------------------------------
  // 14. PROFILES & ORGS
  // -------------------------------------------------------
  console.log('\n--- 14. Profiles & Orgs ---');

  const profile = await pl.Profile.create({
    entity_id: entity.id,
    business_category: 'technology',
    mcc: '5734',
    average_transaction_amount: 150,
    monthly_volume: 50000,
  });
  console.log('Created profile:', profile.id, 'category:', profile.get('business_category'));

  const org = await pl.Org.create({
    name: 'Acme Corp Organization',
  });
  console.log('Created org:', org.id, org.get('name'));

  // -------------------------------------------------------
  // 15. QUERY & FILTER SYSTEM
  // -------------------------------------------------------
  console.log('\n--- 15. Advanced Queries ---');

  // Chained filters
  const recentHighPayments = await pl.Payment.filterBy(
    attr.amount.gte(10),
    attr.status.eq('processed'),
  ).orderBy('-created_at').limit(5).all();
  console.log('Recent high payments:', recentHighPayments.length);

  // Contains filter
  const matchingCustomers = await pl.Customer.filterBy(
    attr.name.contains('Test'),
  ).all();
  console.log('Customers with "Test" in name:', matchingCustomers.length);

  // Pagination
  const page1 = await pl.Customer.filterBy().limit(2).offset(0).all();
  const page2 = await pl.Customer.filterBy().limit(2).offset(2).all();
  console.log('Page 1 customers:', page1.length, '| Page 2 customers:', page2.length);

  // -------------------------------------------------------
  // 16. CLEANUP
  // -------------------------------------------------------
  console.log('\n--- 16. Cleanup ---');

  await pl.Webhook.delete(webhook.id);
  console.log('Deleted webhook:', webhook.id);

  await pl.Customer.delete(customer.id);
  console.log('Deleted customer:', customer.id);

  console.log('\n=== All Tests Complete ===');
}

run().catch((err) => {
  console.error('Error:', err.message || err);
  if (err.statusCode) console.error('  Status:', err.statusCode);
  if (err.details) console.error('  Details:', JSON.stringify(err.details));
  process.exit(1);
});
```

### Run It

```bash
npx ts-node test-real-api.ts
```

Or with the env variable directly:

```bash
PAYLOAD_API_KEY=test_secret_key_YOUR_KEY npx ts-node test-real-api.ts
```

---

## What Each Feature Does (In Detail)

### 1. Customer Management

**What it is:** The `Customer` object represents a person or company you are charging.

**Endpoint:** `POST/GET/PUT/DELETE /customers`

**Operations:**
| Operation | Code | What Happens |
|-----------|------|-------------|
| Create | `pl.Customer.create({ name, email, phone })` | Creates a customer record in Payload. Returns an object with a unique `id`. |
| Get | `pl.Customer.get('cust_...')` | Fetches a single customer by ID. |
| Update | `pl.Customer.update('cust_...', { name: 'New Name' })` | Partially updates the customer. Only the fields you pass are changed. |
| Delete | `pl.Customer.delete('cust_...')` | Deletes the customer record. |
| List All | `pl.Customer.all()` | Returns an array of all customers. |
| Filter | `pl.Customer.filterBy(attr.email.eq('x@y.com')).all()` | Queries customers with server-side filtering. |
| First Match | `pl.Customer.filterBy(attr.name.contains('Jane')).first()` | Returns the first matching customer or `null`. |

**Key fields:** `name`, `email`, `phone`, `status`, `created_at`

---

### 2. Transactions (Payments, Refunds, Credits, Deposits)

**What it is:** `Transaction` is the base type for all money movement. Subtypes (`Payment`, `Refund`, `Credit`, `Deposit`) share the same `/transactions` endpoint but are distinguished by a `type` field.

**Endpoint:** `POST/GET/PUT/DELETE /transactions`

**How polymorphism works:** When you call `pl.Payment.create(...)`, the SDK automatically adds `{ type: 'payment' }` to the request body. When you call `pl.Payment.all()`, it automatically filters `?type=payment`.

| Subtype | Type Value | Purpose |
|---------|-----------|---------|
| `Payment` | `type: 'payment'` | Charge a customer's payment method |
| `Refund` | `type: 'refund'` | Return money from a previous payment |
| `Credit` | `type: 'credit'` | Credit funds to a customer |
| `Deposit` | `type: 'deposit'` | Record a deposit |

**Creating a payment:**
```typescript
const payment = await pl.Payment.create({
  amount: 50.00,
  customer_id: 'cust_...',
  payment_method_id: 'pmth_...',
  description: 'Order #1234',
});
// payment.id => 'txn_...'
// payment.amount => 50
// payment.status => 'processed' (or 'declined')
// payment.type => 'payment'
```

**Creating a refund (linked to original payment):**
```typescript
const refund = await pl.Refund.create({
  amount: 10.00,
  linked_transaction_id: payment.id,
  description: 'Partial refund',
});
```

**Voiding a transaction:**
```typescript
await payment.void();  // Instance method - marks the transaction void
```

---

### 3. Payment Methods (Cards & Bank Accounts)

**What it is:** `PaymentMethod` is the base type. `Card` and `BankAccount` are polymorphic subtypes sharing `/payment_methods` with a `type` discriminator.

**Endpoint:** `POST/GET/PUT/DELETE /payment_methods`

**Creating a card:**
```typescript
const card = await pl.Card.create({
  card_number: '4242424242424242',  // Sandbox test number
  expiry: '12/2028',
  card_code: '123',
  customer_id: 'cust_...',
});
// card.type => 'card'
// card.lastFour => '4242' (or via card.get('last_four'))
// card.brand => 'visa'
```

**Creating a bank account:**
```typescript
const bank = await pl.BankAccount.create({
  account_number: '1234567890',
  routing_number: '021000021',
  account_type: 'checking',  // or 'savings'
  customer_id: 'cust_...',
});
// bank.type => 'bank_account'
```

**Test card numbers for sandbox:**
| Card Number | Brand | Result |
|-------------|-------|--------|
| `4242424242424242` | Visa | Approved |
| `5555555555554444` | Mastercard | Approved |
| `4000000000000002` | Visa | Declined (check Payload docs for test numbers) |

---

### 4. Billing Schedules (Recurring Payments)

**What it is:** Automated recurring charges on a customer's payment method. You define the amount, frequency, and start date, and Payload generates `BillingCharge` records on each cycle.

**Endpoint:** `/billing_schedules`

**Creating a recurring subscription:**
```typescript
const schedule = await pl.BillingSchedule.create({
  customer_id: 'cust_...',
  payment_method_id: 'pmth_...',
  amount: 29.99,
  frequency: 'monthly',    // 'daily', 'weekly', 'monthly', 'yearly'
  start_date: '2026-03-01',
  description: 'Pro Plan - Monthly',
});
// schedule.status => 'active'
// schedule.nextChargeDate => '2026-03-01'
```

**Instance methods:**
```typescript
await schedule.pause();   // Pauses the schedule (no more charges until resumed)
await schedule.resume();  // Resumes a paused schedule
await schedule.cancel();  // Cancels the schedule permanently
```

**Billing Charges (auto-generated):**
```typescript
const charges = await pl.BillingCharge.filterBy(
  attr.billing_schedule_id.eq(schedule.id)
).all();
// Each charge has: amount, status, charge_date, attempt_count, transaction_id
```

---

### 5. Invoicing

**What it is:** Create professional invoices with line items, track payment status, and manage the invoice lifecycle.

**Endpoints:** `/invoices`, `/invoice_items`, `/line_items`

**Full invoice workflow:**
```typescript
// Step 1: Create invoice
const invoice = await pl.Invoice.create({
  customer_id: 'cust_...',
  due_date: '2026-04-01',
  description: 'March 2026 services',
});

// Step 2: Add line items
await pl.InvoiceItem.create({
  invoice_id: invoice.id,
  description: 'Consulting (10 hrs @ $150)',
  quantity: 10,
  unit_price: 150.00,
});

await pl.InvoiceItem.create({
  invoice_id: invoice.id,
  description: 'Development (5 hrs @ $200)',
  quantity: 5,
  unit_price: 200.00,
});

// Step 3: Send to customer
await invoice.send();  // status changes to 'sent'

// Step 4: When paid
await invoice.markPaid();  // status changes to 'paid'

// Step 5: Or void if needed
await invoice.void();  // status changes to 'void'
```

**Invoice fields:** `customer_id`, `number`, `status`, `total_amount`, `amount_due`, `amount_paid`, `currency`, `due_date`, `issued_date`, `description`

**Line Items (ChargeItem / PaymentItem):**
```typescript
// ChargeItem — represents a charge on the invoice
const charge = await pl.ChargeItem.create({
  invoice_id: invoice.id,
  amount: 100,
  description: 'Service fee',
});

// PaymentItem — represents a payment applied to the invoice
const pmt = await pl.PaymentItem.create({
  invoice_id: invoice.id,
  amount: 100,
  transaction_id: 'txn_...',
  description: 'Payment received',
});
```

---

### 6. Entities (Business Onboarding / KYB)

**What it is:** An `Entity` represents a business you are onboarding onto the platform — used for marketplace/platform models where sub-merchants need to be registered.

**Endpoint:** `/entities`

```typescript
const entity = await pl.Entity.create({
  legal_name: 'Acme Technologies LLC',
  dba_name: 'Acme Tech',
  entity_type: 'llc',  // 'llc', 'corporation', 'sole_proprietorship', 'partnership'
  ein: '12-3456789',
  phone: '555-987-6543',
  email: 'info@acmetech.example.com',
  website: 'https://acmetech.example.com',
  address: {
    street: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
  },
});
```

**Stakeholders (entity owners/officers):**
```typescript
const stakeholder = await pl.Stakeholder.create({
  entity_id: entity.id,
  first_name: 'John',
  last_name: 'Smith',
  email: 'john@acmetech.example.com',
  title: 'CEO',
  ownership_percentage: 100,
  date_of_birth: '1985-06-15',
  ssn: '123-45-6789',  // For KYC verification
});
```

**Processing Accounts (merchant processing setup):**
```typescript
const processingAcct = await pl.ProcessingAccount.create({
  entity_id: entity.id,
  account_name: 'Card Processing',
  processing_type: 'card',
});

const agreement = await pl.ProcessingAgreement.create({
  processing_account_id: processingAcct.id,
  agreement_type: 'standard',
  effective_date: '2026-02-11',
});
```

**Profiles (business risk profile):**
```typescript
const profile = await pl.Profile.create({
  entity_id: entity.id,
  business_category: 'technology',
  mcc: '5734',  // Merchant Category Code
  average_transaction_amount: 150,
  monthly_volume: 50000,
});
```

---

### 7. Transfers

**What it is:** Move funds between accounts (e.g., platform to merchant payouts).

**Endpoint:** `/transfers`

```typescript
const transfer = await pl.Transfer.create({
  amount: 500.00,
  source_account_id: 'acct_platform',
  destination_account_id: 'acct_merchant',
  description: 'Weekly payout',
  currency: 'USD',
});
// transfer.status => 'pending' or 'completed'
```

---

### 8. Webhooks

**What it is:** Register URLs to receive real-time event notifications when things happen (payments, refunds, etc.).

**Endpoint:** `/webhooks`, `/webhook_logs`

```typescript
// Register a webhook
const webhook = await pl.Webhook.create({
  url: 'https://yourapp.example.com/webhooks/payload',
  events: ['payment.created', 'payment.updated', 'refund.created', 'invoice.paid'],
});

// Enable/disable
await webhook.enable();
await webhook.disable();

// Check delivery logs
const logs = await pl.WebhookLog.filterBy(
  attr.webhook_id.eq(webhook.id)
).all();
// Each log has: event_type, url, request_body, response_status, response_body, success, attempt_number
```

**Common event types:** `payment.created`, `payment.updated`, `refund.created`, `invoice.paid`, `invoice.sent`, `billing_schedule.charged`, `transfer.completed`

---

### 9. Payment Links

**What it is:** Generate shareable URLs that customers can click to make a payment without needing a full checkout integration.

**Endpoint:** `/payment_links`

```typescript
const link = await pl.PaymentLink.create({
  amount: 75.00,
  description: 'Invoice #1234 payment',
  currency: 'USD',
});
console.log('Send this to customer:', link.get('url'));
// e.g. https://pay.payload.co/link/pl_...
```

---

### 10. Payment Intents

**What it is:** Represents the intent to collect a payment. Used in client-side integrations where the payment is confirmed on the frontend.

**Endpoint:** `/intents`

```typescript
const intent = await pl.Intent.create({
  amount: 99.99,
  currency: 'USD',
  customer_id: 'cust_...',
  description: 'Premium upgrade',
});
// intent.clientSecret => 'pi_secret_...' (pass to frontend JS SDK)
```

---

### 11. Double-Entry Ledger System

**What it is:** A full double-entry bookkeeping system. Every financial event creates a pair of entries — a debit and a credit — that must balance. This is the standard accounting method used by all financial systems to ensure accuracy.

**How double-entry works:**
- Every transaction creates at least 2 ledger entries
- Total debits must always equal total credits
- Each entry is posted to a specific "account" (revenue, receivable, fees, etc.)
- The system can be reconciled at any time to verify integrity

**Endpoint:** `/transaction_ledgers` (via the `Ledger` model and `LedgerManager` class)

**The LedgerManager provides 8 operations:**

#### a) Create Balanced Entry (Pair)
The most common operation — creates one debit and one credit entry that must have equal amounts:
```typescript
const ledger = new LedgerManager(pl);

const { debit, credit } = await ledger.createBalancedEntry({
  debit: {
    accountId: 'acct_revenue',
    amount: 100.00,
    entryType: 'debit',
    description: 'Revenue from order #1001',
  },
  credit: {
    accountId: 'acct_receivable',
    amount: 100.00,
    entryType: 'credit',
    description: 'AR for order #1001',
  },
});
```

**Validation rules:**
- Debit amount must equal credit amount (rejects if different)
- Both amounts must be positive (no negative entries)
- Must use two different accounts (cannot debit and credit the same account)

#### b) Multi-Leg Entry
For transactions that split across more than 2 accounts:
```typescript
// Platform takes $1000, splits: $900 to merchant, $100 platform fee
const entries = await ledger.createMultiLegEntry([
  { accountId: 'acct_platform', amount: 1000, entryType: 'debit', description: 'Received' },
  { accountId: 'acct_merchant', amount: 900, entryType: 'credit', description: 'Merchant share' },
  { accountId: 'acct_fees', amount: 100, entryType: 'credit', description: 'Platform fee' },
]);
// Total debits ($1000) == Total credits ($900 + $100) ✓
```

**Validation:** Minimum 2 entries required. Total debits must equal total credits.

#### c) Get Account Balance
```typescript
const balance = await ledger.getAccountBalance('acct_revenue');
// Returns:
// {
//   accountId: 'acct_revenue',
//   totalDebits: 750.00,
//   totalCredits: 250.00,
//   netBalance: 500.00,     // debits - credits
//   entryCount: 6
// }
```

#### d) Reconciliation
Verifies the entire system is in balance across all accounts:
```typescript
const result = await ledger.reconcile([
  'acct_revenue', 'acct_receivable', 'acct_fees', 'acct_merchant'
]);
// Returns:
// {
//   balanced: true,        // SYSTEM IS IN BALANCE
//   totalDebits: 1750.00,
//   totalCredits: 1750.00,
//   difference: 0,
//   accountBalances: [...], // Per-account breakdown
//   imbalancedAccounts: []  // Empty = all good
// }
```

#### e) Reversal Entry
Standard accounting practice for correcting entries (not deleting — creating a counter-entry):
```typescript
const { debit, credit } = await ledger.createReversalEntry(
  'acct_revenue',      // original debit account
  'acct_receivable',   // original credit account
  100.00,              // amount to reverse
  'Customer refund',   // reason
);
// This SWAPS the accounts: credits acct_revenue, debits acct_receivable
// Description prefix: "REVERSAL: Customer refund"
```

#### f) Activity Summary
```typescript
const activity = await ledger.getActivitySummary('acct_revenue', '2026-01-01', '2026-12-31');
// Returns:
// {
//   accountId: 'acct_revenue',
//   debits: [{ amount, description, createdAt }, ...],
//   credits: [{ amount, description, createdAt }, ...],
//   totalDebits: 750,
//   totalCredits: 250,
//   netChange: 500
// }
```

---

### 12. Query & Filter System

The `attr` proxy provides a fluent query builder:

```typescript
import { attr } from 'payload-utility';

// Simple equality
attr.status.eq('active')

// Comparison operators
attr.amount.gt(100)     // Greater than
attr.amount.lt(500)     // Less than
attr.amount.gte(100)    // Greater than or equal
attr.amount.lte(500)    // Less than or equal
attr.status.ne('void')  // Not equal

// String matching
attr.name.contains('Acme')

// Nested fields
attr.payment_method.type.eq('card')

// Combining filters (AND logic)
const results = await pl.Payment.filterBy(
  attr.amount.gte(50),
  attr.status.eq('processed'),
  attr.type.eq('payment'),
).orderBy('-created_at')  // '-' prefix = descending
  .limit(10)
  .offset(0)
  .all();
```

**Available operators:**
| Method | API Operator | Example |
|--------|-------------|---------|
| `.eq(val)` | `field=val` | Exact match |
| `.ne(val)` | `field!=val` | Not equal |
| `.gt(val)` | `field>val` | Greater than |
| `.lt(val)` | `field<val` | Less than |
| `.gte(val)` | `field>=val` | Greater or equal |
| `.lte(val)` | `field<=val` | Less or equal |
| `.contains(val)` | `field?*val` | Substring match |

---

### 13. Accounts, Access Tokens & Orgs

```typescript
// List accounts
const accounts = await pl.Account.all();

// Create a client token (for frontend SDK auth)
const token = await pl.ClientToken.create({
  type: 'client',
});
// token.get('token') => 'client_key_...'
// token.get('expires_at') => '2026-...'

// Organization management
const org = await pl.Org.create({ name: 'My Organization' });
// Uses special endpoint: /accounts/orgs
```

---

## Error Handling

The SDK throws typed exceptions mapped to HTTP status codes:

```typescript
import {
  Unauthorized,
  NotFound,
  InvalidAttributes,
  TransactionDeclined,
  BadRequest,
  Forbidden,
  TooManyRequests,
} from 'payload-utility';

try {
  await pl.Payment.create({ amount: 0.01 });
} catch (err) {
  if (err instanceof TransactionDeclined) {
    console.log('Payment declined:', err.message);
    console.log('Details:', err.details);  // { decline_code: 'insufficient_funds' }
  } else if (err instanceof InvalidAttributes) {
    console.log('Validation error:', err.message);
    console.log('Fields:', err.details);  // { amount: ['is required'] }
  } else if (err instanceof Unauthorized) {
    console.log('Bad API key');
  } else if (err instanceof NotFound) {
    console.log('Object not found');
  } else if (err instanceof TooManyRequests) {
    console.log('Rate limited - slow down');
  }
}
```

| Exception | HTTP Status | When |
|-----------|------------|------|
| `Unauthorized` | 401 | Invalid or missing API key |
| `Forbidden` | 403 | Key doesn't have permission |
| `NotFound` | 404 | Object ID doesn't exist |
| `BadRequest` | 400 | Malformed request |
| `InvalidAttributes` | 400 | Missing/invalid fields |
| `TransactionDeclined` | 400 | Processor declined the charge |
| `TooManyRequests` | 429 | Rate limit exceeded |
| `InternalServerError` | 500 | Payload server error |
| `ServiceUnavailable` | 503 | Payload is down |

---

## Architecture

```
payload-utility/
├── src/
│   ├── core/                 # ARM Framework
│   │   ├── session.ts        # Session: binds API key → all model operations
│   │   ├── model.ts          # Model base class, ModelOperations, QueryBuilder
│   │   ├── request.ts        # HTTP client (Basic Auth, JSON, error mapping)
│   │   ├── attr.ts           # Proxy-based filter builder (attr.field.op(val))
│   │   ├── exceptions.ts     # Typed HTTP error hierarchy
│   │   └── utils.ts          # URL building, key validation, helpers
│   ├── spec01/               # Core Payment Objects
│   │   ├── customer.ts       # Customer
│   │   ├── transaction.ts    # Transaction (base)
│   │   ├── payment.ts        # Payment extends Transaction
│   │   ├── refund.ts         # Refund extends Transaction
│   │   ├── credit.ts         # Credit extends Transaction
│   │   ├── deposit.ts        # Deposit extends Transaction
│   │   ├── payment-method.ts # PaymentMethod (base)
│   │   ├── card.ts           # Card extends PaymentMethod
│   │   ├── bank-account.ts   # BankAccount extends PaymentMethod
│   │   ├── account.ts        # Account
│   │   └── access-token.ts   # AccessToken, ClientToken
│   ├── spec02/               # Advanced Objects
│   │   ├── billing-schedule.ts
│   │   ├── billing-charge.ts
│   │   ├── invoice.ts
│   │   ├── invoice-item.ts
│   │   ├── line-item.ts      # LineItem, ChargeItem, PaymentItem
│   │   ├── webhook.ts
│   │   ├── webhook-log.ts
│   │   ├── entity.ts
│   │   ├── stakeholder.ts
│   │   ├── transfer.ts
│   │   ├── processing-account.ts
│   │   ├── processing-agreement.ts
│   │   ├── payment-link.ts
│   │   ├── intent.ts
│   │   ├── ledger.ts
│   │   ├── profile.ts
│   │   └── org.ts
│   ├── ledger/
│   │   └── ledger-manager.ts # Double-entry bookkeeping engine
│   └── index.ts              # Public API exports
├── tests/
│   ├── unit/                 # Pure unit tests (no server)
│   │   ├── core/             # utils, attr, exceptions, model
│   │   ├── spec01/           # Spec01 object specs
│   │   ├── spec02/           # Spec02 object specs
│   │   └── ledger/           # LedgerManager logic
│   ├── mock/
│   │   ├── mock-server.ts    # Contract-faithful Payload API simulator
│   │   └── integration.test.ts
│   └── e2e/
│       └── full-e2e.test.ts  # 67 E2E tests across all features
├── package.json
├── tsconfig.json
├── jest.config.js
├── .env.example
└── .gitignore
```

### How the ARM Pattern Works

```
Your Code                     SDK                           Payload API
─────────                     ───                           ───────────
pl.Payment.create({      →   ModelOperations.create()   →   POST /transactions
  amount: 50               - adds { type: 'payment' }       { type: 'payment',
})                          - serializes to JSON               amount: 50 }
                            - adds Basic Auth header
                            - sends HTTP request          ←  { id: 'txn_...',
                         ←   - maps response to                type: 'payment',
                              Payment instance                 amount: 50,
                            - caches in identity map           status: 'processed' }
```

---

## Testing Against Mock Server (No API Key Needed)

If you want to test locally without hitting the real API at all, use the mock server:

### Start the Mock Server

```bash
npm run start:mock-server
```

Output: `Mock Payload API server listening on port 3100`

### Interact via curl

```bash
# Set up auth (built-in test key)
AUTH="Authorization: Basic $(echo -n 'secret_key_test1234567890:' | base64)"

# Create customer
curl -s -X POST http://localhost:3100/customers \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"name":"Jane","email":"jane@test.com"}' | jq

# Create payment
curl -s -X POST http://localhost:3100/transactions \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"type":"payment","amount":50}' | jq

# List with filters
curl -s "http://localhost:3100/transactions?amount>=10&limit=5" \
  -H "$AUTH" | jq

# Diagnostics
curl -s http://localhost:3100/_meta/stats | jq
curl -s http://localhost:3100/_meta/log | jq
curl -s -X POST http://localhost:3100/_meta/reset | jq
```

### Or Point the SDK at the Mock Server

```typescript
const pl = new Session('secret_key_test1234567890', {
  apiUrl: 'http://localhost:3100',
});
// Now all pl.Customer.create(), pl.Payment.all(), etc. hit the mock
```
