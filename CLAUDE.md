# Payload Utility

## Project Overview
ARM-based TypeScript SDK for the Payload payment gateway (payload.co). Implements Spec01 (core payment objects) and Spec02 (advanced billing, invoicing, entities, webhooks, ledger).

## Prerequisites
- Node.js >= 18.0.0
- npm

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Project
```bash
npm run build
```
This compiles TypeScript from `src/` into `dist/` with declaration files.

### 3. Configure Environment
```bash
cp .env.example .env
```
Edit `.env` with your credentials:
```
PAYLOAD_API_KEY=secret_key_your_key_here
PAYLOAD_API_URL=https://api.payload.co
PAYLOAD_API_VERSION=v2
MOCK_SERVER_PORT=3100
```

## Commands
- `npm run build` - Compile TypeScript to dist/
- `npm test` - Run all tests with coverage
- `npm run test:unit` - Run unit tests only
- `npm run test:mock` - Run integration tests with mock server
- `npm run start:mock-server` - Start the mock Payload API server standalone

## Running Tests

### Run All Tests (Unit + Integration + E2E)
```bash
npm test
```
This runs all 207 tests across 9 suites with coverage reporting.

### Run Only Unit Tests
```bash
npm run test:unit
```
Covers: core utilities, attr proxy, exceptions, model framework, spec01 objects, spec02 objects, ledger manager.

### Run Only Integration Tests (Mock Server)
```bash
npm run test:mock
```
Spins up the mock server automatically, runs CRUD lifecycle tests against it, then shuts it down.

### Run Only E2E Tests
```bash
npx jest tests/e2e
```
Comprehensive end-to-end tests covering all 22 object types, error handling, query filters, ledger management, and API contract validation.

### Run a Specific Test File
```bash
npx jest tests/unit/core/attr.test.ts
npx jest tests/unit/ledger/ledger-manager.test.ts
```

### Run Tests in Watch Mode
```bash
npx jest --watch
```

### Run Tests with Verbose Output
```bash
npx jest --verbose
```

## Manual Testing with the Mock Server

The mock server simulates the full Payload API locally. You can start it standalone and interact with it using `curl` or any HTTP client.

### Start the Mock Server
```bash
npm run start:mock-server
```
The server starts on port 3100 by default (configurable via `MOCK_SERVER_PORT` in `.env`).

### Authenticate
All requests require Basic Auth with your API key as the username and an empty password:
```bash
# Using the built-in test key
AUTH="Authorization: Basic $(echo -n 'secret_key_test1234567890:' | base64)"
```

### Create a Customer
```bash
curl -s -X POST http://localhost:3100/customers \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe", "email": "jane@example.com"}' | jq
```

### Create a Payment
```bash
curl -s -X POST http://localhost:3100/transactions \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"type": "payment", "amount": 99.99, "description": "Test payment"}' | jq
```

### List All Customers
```bash
curl -s http://localhost:3100/customers \
  -H "$AUTH" | jq
```

### Get a Specific Object by ID
```bash
curl -s http://localhost:3100/customers/cust_000001 \
  -H "$AUTH" | jq
```

### Update an Object
```bash
curl -s -X PUT http://localhost:3100/customers/cust_000001 \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Smith"}' | jq
```

### Delete an Object
```bash
curl -s -X DELETE http://localhost:3100/customers/cust_000001 \
  -H "$AUTH" | jq
```

### Query with Filters
```bash
# Filter by field value
curl -s "http://localhost:3100/transactions?type=payment" \
  -H "$AUTH" | jq

# Greater-than filter
curl -s "http://localhost:3100/transactions?amount>=50" \
  -H "$AUTH" | jq

# Pagination
curl -s "http://localhost:3100/customers?limit=5&offset=0&order_by=-created_at" \
  -H "$AUTH" | jq
```

### Spec02 Objects
```bash
# Create a Billing Schedule
curl -s -X POST http://localhost:3100/billing_schedules \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"amount": 29.99, "frequency": "monthly", "description": "Subscription"}' | jq

# Create an Invoice
curl -s -X POST http://localhost:3100/invoices \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "cust_000001", "due_date": "2026-03-01"}' | jq

# Create a Webhook
curl -s -X POST http://localhost:3100/webhooks \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/hook", "events": ["payment.created"]}' | jq

# Create an Entity
curl -s -X POST http://localhost:3100/entities \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"legal_name": "Acme Corp", "entity_type": "llc"}' | jq
```

### Test Error Handling
```bash
# 401 - Invalid API key
curl -s -X GET http://localhost:3100/customers \
  -H "Authorization: Basic $(echo -n 'bad_key:' | base64)" | jq

# 404 - Not found
curl -s http://localhost:3100/customers/nonexistent \
  -H "$AUTH" | jq

# 400 - Missing required fields
curl -s -X POST http://localhost:3100/billing_schedules \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{}' | jq

# 400 - Transaction declined (amount = 0.01 triggers decline)
curl -s -X POST http://localhost:3100/transactions \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.01, "type": "payment"}' | jq
```

### Mock Server Diagnostics
```bash
# View store statistics (object counts per collection)
curl -s http://localhost:3100/_meta/stats | jq

# View request log (all requests made)
curl -s http://localhost:3100/_meta/log | jq

# Reset the server (clear all data)
curl -s -X POST http://localhost:3100/_meta/reset | jq
```

## Programmatic Usage

### Basic Session Setup
```typescript
import { Session, attr } from 'payload-utility';

const pl = new Session('secret_key_your_key_here', {
  apiUrl: 'https://api.payload.co',  // or http://localhost:3100 for mock
  apiVersion: 'v2',
});
```

### Spec01 - Core Operations
```typescript
// Create a customer
const customer = await pl.Customer.create({
  name: 'Jane Doe',
  email: 'jane@example.com',
});

// Create a payment
const payment = await pl.Payment.create({
  amount: 100.00,
  payment_method: { type: 'card' },
});

// Query with filters
const highPayments = await pl.Payment.query({
  filters: [attr.amount.gt(50)],
  limit: 10,
});

// Get a single result
const first = await pl.Customer.first({
  filters: [attr.email.eq('jane@example.com')],
});

// Update
await pl.Customer.update(customer.id, { name: 'Jane Smith' });

// Delete
await pl.Customer.delete(customer.id);
```

### Spec02 - Advanced Operations
```typescript
// Billing
const schedule = await pl.BillingSchedule.create({
  amount: 29.99,
  frequency: 'monthly',
});

// Invoicing
const invoice = await pl.Invoice.create({
  customer_id: customer.id,
  due_date: '2026-03-01',
});

// Webhooks
const webhook = await pl.Webhook.create({
  url: 'https://example.com/hook',
  events: ['payment.created'],
});

// Entities & Transfers
const entity = await pl.Entity.create({
  legal_name: 'Acme Corp',
  entity_type: 'llc',
});
```

### Ledger Management (Double-Entry Bookkeeping)
```typescript
import { LedgerManager } from 'payload-utility';

const ledger = new LedgerManager(pl);

// Create balanced debit/credit pair
await ledger.createBalancedEntry({
  debit: { accountId: 'acct_revenue', amount: 100, entryType: 'debit', description: 'Sale revenue' },
  credit: { accountId: 'acct_receivable', amount: 100, entryType: 'credit', description: 'Customer receivable' },
});

// Multi-leg transaction
await ledger.createMultiLegEntry([
  { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'Leg 1' },
  { accountId: 'acct_2', amount: 60, entryType: 'credit', description: 'Leg 2' },
  { accountId: 'acct_3', amount: 40, entryType: 'credit', description: 'Leg 3' },
]);

// Check account balance
const balance = await ledger.getAccountBalance('acct_revenue');

// System-wide reconciliation
const result = await ledger.reconcile();
console.log(result.balanced); // true if debits == credits
```

## Architecture
- `src/core/` - ARM framework (Session, Model, Request, Attr, Exceptions)
- `src/spec01/` - Core objects (Transaction, Payment, Customer, PaymentMethod)
- `src/spec02/` - Advanced objects (Billing, Invoice, Entity, Transfer, Webhook, Ledger)
- `src/ledger/` - Two-way (double-entry) ledger management
- `tests/unit/` - Unit tests (core, spec01, spec02, ledger)
- `tests/mock/` - Integration tests with mock server
- `tests/e2e/` - End-to-end tests covering full object lifecycles

## Key Patterns
- Polymorphic spec merging via prototype chain (Payment extends Transaction)
- WeakMap-based per-class spec caching
- Proxy-based Attr filter builder for query construction
- Session-scoped ModelOperations binding

## Supported API Objects

### Spec01 (Core)
Account, Customer, Transaction, Payment, Refund, Credit, Deposit, PaymentMethod, Card, BankAccount, AccessToken, ClientToken

### Spec02 (Advanced)
BillingSchedule, BillingCharge, Invoice, InvoiceItem, LineItem (ChargeItem/PaymentItem), Webhook, WebhookLog, Entity, Stakeholder, Transfer, ProcessingAccount, ProcessingAgreement, PaymentLink, Intent, Ledger, Profile, Org

## Testing Against Real Payload API
To test against the real Payload sandbox API instead of the mock server:
1. Set your sandbox API key in `.env`
2. Ensure `PAYLOAD_API_URL=https://api.payload.co`
3. Update test files to use the real URL, or pass it via `SessionConfig.apiUrl`

Note: The E2E test suite (`tests/e2e/full-e2e.test.ts`) is configured to run against the mock server by default. To switch to the real API, update the `apiUrl` in the test's Session constructor.
