# Payload Utility

TypeScript SDK for the [Payload payment gateway](https://payload.com) using the **ARM (API Relational Model)** pattern -- an ORM-like abstraction over REST APIs. Work with typed model objects through a `Session` that handles auth, serialization, and request lifecycle.

- **Spec01 (Core)** -- Customers (accounts with type='customer'), transactions, payment methods, accounts, access tokens
- **Spec02 (Advanced)** -- Billing, invoicing, entities, transfers, webhooks, payment links, processing accounts, ledger

## Setup

```bash
npm install && npm run build
cp .env.example .env  # Edit with your API key
npm test              # 207 tests, 9 suites, ~80% coverage (uses mock server)
```

**`.env` config:**
```
PAYLOAD_API_KEY=test_secret_key_...
PAYLOAD_API_URL=https://api.payload.com
PAYLOAD_API_VERSION=v2.0
MOCK_SERVER_PORT=3100
```

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run all tests with coverage |
| `npm run test:unit` | Unit tests only (no server) |
| `npm run test:mock` | Integration tests (auto-starts mock server) |
| `npx jest tests/e2e` | E2E tests (auto-starts mock server) |
| `npx jest path/to/test.ts` | Single test file |
| `npm run start:mock-server` | Mock API server on port 3100 |

## Authentication

HTTP Basic Auth. API key = username, password = empty. Handled automatically by `Session`:

```typescript
const pl = new Session('test_secret_key_...', {
  apiUrl: 'https://api.payload.com',
  apiVersion: 'v2.0',
});
```

## SDK Models & Endpoints

All models support: `.create()`, `.get(id)`, `.update(id, {})`, `.delete(id)`, `.all()`, `.filterBy().all()`, `.filterBy().first()`

### Spec01 (Core)

| Model | Endpoint | Notes |
|-------|----------|-------|
| `Customer` | `/accounts` | Accounts with `type: 'customer'`. Fields: name, email, phone |
| `Payment` | `/transactions` | Polymorphic, `type: 'payment'`. Fields: amount, customer_id, payment_method_id |
| `Refund` | `/transactions` | `type: 'refund'`. Requires `linked_transaction_id` |
| `Credit` | `/transactions` | `type: 'credit'` |
| `Deposit` | `/transactions` | `type: 'deposit'` |
| `Card` | `/payment_methods` | `type: 'card'`. Fields: card_number, expiry, card_code |
| `BankAccount` | `/payment_methods` | `type: 'bank_account'`. Fields: account_number, routing_number |
| `Account` | `/accounts` | Platform accounts |
| `ClientToken` | `/access_tokens` | Frontend auth tokens |

### Spec02 (Advanced)

| Model | Endpoint | Notes |
|-------|----------|-------|
| `BillingSchedule` | `/billing_schedules` | Recurring. Methods: pause(), resume(), cancel() |
| `BillingCharge` | `/billing_charges` | Auto-generated charge records |
| `Invoice` | `/invoices` | Methods: send(), markPaid(), void() |
| `InvoiceItem` | `/invoice_items` | Line items on invoices |
| `ChargeItem` | `/line_items` | `type: 'charge'` on invoices |
| `PaymentItem` | `/line_items` | `type: 'payment'` on invoices |
| `Entity` | `/entities` | Business onboarding (KYB) |
| `Stakeholder` | `/stakeholders` | Entity owners/officers |
| `Transfer` | `/transfers` | Fund movement between accounts |
| `Webhook` | `/webhooks` | Methods: enable(), disable() |
| `WebhookLog` | `/webhook_logs` | Delivery logs |
| `PaymentLink` | `/payment_links` | Shareable payment URLs |
| `Intent` | `/intents` | Payment intents for frontend |
| `ProcessingAccount` | `/processing_accounts` | Merchant processing setup |
| `ProcessingAgreement` | `/processing_agreements` | Processing terms |
| `Profile` | `/profiles` | Business risk profiles |
| `Org` | `/accounts/orgs` | Organization management |
| `Ledger` | `/transaction_ledgers` | Double-entry ledger entries |

## Query & Filter System

```typescript
import { attr } from 'payload-utility';

// Operators: eq, ne, gt, lt, gte, lte, contains
// Chaining: filterBy(attr.amount.gte(50), attr.status.eq('processed'))
// Sorting: .orderBy('-created_at')  // '-' prefix = descending
// Pagination: .limit(10).offset(0)
```

| Method | API Operator |
|--------|-------------|
| `.eq(val)` | `field=val` |
| `.ne(val)` | `field!=val` |
| `.gt(val)` | `field>val` |
| `.lt(val)` | `field<val` |
| `.gte(val)` | `field>=val` |
| `.lte(val)` | `field<=val` |
| `.contains(val)` | `field?*val` |

## Double-Entry Ledger (LedgerManager)

```typescript
const ledger = new LedgerManager(pl);
```

| Method | Purpose |
|--------|---------|
| `createBalancedEntry({ debit, credit })` | Paired debit/credit (equal amounts, different accounts) |
| `createMultiLegEntry([...])` | N-way split (total debits must equal total credits) |
| `getAccountBalance(accountId)` | Returns totalDebits, totalCredits, netBalance, entryCount |
| `reconcile([accountIds])` | Verifies system balance across accounts |
| `createReversalEntry(debitAcct, creditAcct, amount, reason)` | Counter-entry (swaps accounts, prefixes "REVERSAL:") |
| `getActivitySummary(accountId, startDate?, endDate?)` | Lists all debits/credits with net change |

## Error Handling

| Exception | HTTP Status | When |
|-----------|------------|------|
| `Unauthorized` | 401 | Invalid/missing API key |
| `Forbidden` | 403 | Insufficient permissions |
| `NotFound` | 404 | Object not found |
| `BadRequest` | 400 | Malformed request |
| `InvalidAttributes` | 400 | Missing/invalid fields |
| `TransactionDeclined` | 400 | Processor declined |
| `TooManyRequests` | 429 | Rate limited |
| `InternalServerError` | 500 | Server error |
| `ServiceUnavailable` | 503 | Service down |

## Architecture

```
src/
  core/           # ARM framework: session, model, request, attr, exceptions, utils
  spec01/         # Customer, Transaction (Payment/Refund/Credit/Deposit),
                  #   PaymentMethod (Card/BankAccount), Account, AccessToken
  spec02/         # BillingSchedule, BillingCharge, Invoice, InvoiceItem, LineItem,
                  #   Webhook, WebhookLog, Entity, Stakeholder, Transfer,
                  #   ProcessingAccount, ProcessingAgreement, PaymentLink, Intent,
                  #   Ledger, Profile, Org
  ledger/         # LedgerManager (double-entry bookkeeping engine)
  index.ts        # Public exports
tests/
  unit/           # Pure unit tests (no server)
  mock/           # Mock server + integration tests
  e2e/            # 67 E2E tests across all features
```

**ARM Pattern Flow:**
```
pl.Payment.create({amount:50}) -> ModelOperations.create() -> POST /transactions {type:'payment', amount:50}
                                  adds type, auth, JSON        <- {id:'txn_...', status:'processed'}
                               <- maps to Payment instance
```

## Mock Server

```bash
npm run start:mock-server  # Runs on port 3100
# Test key: secret_key_test1234567890
# Diagnostics: GET /_meta/stats, GET /_meta/log, POST /_meta/reset
```

```typescript
const pl = new Session('secret_key_test1234567890', { apiUrl: 'http://localhost:3100' });
```
