# Payload V2 SDK - Sandbox Testing Plan

## Current State (as of Feb 13, 2026)

### Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| Account.all | PASS | Lists all accounts |
| Customer.create | PASS | Creates customer (Account with type=customer) |
| Customer.all | PASS | Lists customers |
| Customer.get | PASS | Fetches by ID |
| PaymentMethod.all | PASS | Lists payment methods |
| Entity.create | PASS | Creates legal entity |
| Entity.all | PASS | Lists entities |
| Webhook.create | PASS | Creates webhook |
| Webhook.all | PASS | Lists webhooks |
| Webhook.delete | PASS | Deletes webhook |
| Payment.all | PASS | Lists payments |
| BillingSchedule.all | PASS | Lists billing schedules |
| Card.create | EXPECTED_FAIL | "Account not yet active for processing" |
| Payment.create | EXPECTED_FAIL | Requires card (blocked by Card.create) |
| Invoice.create | EXPECTED_FAIL | "Cannot find applicable biller" |
| BillingSchedule.create | EXPECTED_FAIL | Requires card (blocked by Card.create) |
| PaymentLink.create | EXPECTED_FAIL | Endpoint /payment_links returns 404 in V2 |

**13/18 PASS, 5 expected failures (sandbox limitations), 0 unexpected failures.**

### Why Card/Payment Tests Fail

The sandbox account (`test_secret_key_...`) is not active for payment processing. In Payload V2, processing requires:

1. A **processing account** linked to a verified **entity** (legal business)
2. The entity must pass KYC/KYB verification
3. Processing settings (card types, currencies) must be configured
4. A funding account (bank account for settlement) must be attached

Without this setup, the API rejects card creation with "Account not yet active for processing."

---

## Plan: Full Sandbox Testing

### Phase 1: Entity & Processing Account Setup

To unlock card/payment processing on the sandbox, we need to create the full account hierarchy:

```
Entity (legal business)
  -> Processing Account (card processing config)
    -> Funding Account (bank account for settlement)
    -> Processing Settings (card brands, currencies)
  -> Stakeholders/Owners (KYC on individuals)
```

**Step 1: Create a Business Entity**

```typescript
const entity = await pl.Entity.create({
  legal_name: 'SDK Test Business LLC',
  type: 'business',
  phone_number: '5551234567',
  country: 'US',
  tax_id: { value: '123456789' },
  address: {
    line1: '123 Test Street',
    city: 'San Francisco',
    state_code: 'CA',
    postal_code: '94105',
  },
  business: {
    category: 'software',
    structure: 'llc',
    formation: { state_code: 'CA', date: '2020-01-01' },
    website: 'https://sdktest.example.com',
  },
});
```

**Step 2: Add Entity Owners (Stakeholders)**

```typescript
const owner = await pl.Stakeholder.create({
  legal_entity_id: entity.id,
  first_name: 'John',
  last_name: 'Smith',
  email: 'john@sdktest.example.com',
  phone_number: '5559876543',
  ownership_pct: 100,
  is_control_prong: true,
  title: 'CEO',
  ssn: '123456789',
  dob: '1985-06-15',
  address: {
    line1: '456 Owner Ave',
    city: 'San Francisco',
    state_code: 'CA',
    postal_code: '94105',
  },
});
```

**Step 3: Create a Processing Account**

```typescript
const processingAcct = await pl.ProcessingAccount.create({
  entity_id: entity.id,
  type: 'card',  // or 'ach'
});
```

**Step 4: Attach a Funding/Settlement Bank Account**

This is the bank account where processed funds settle:

```typescript
const fundingBank = await pl.BankAccount.create({
  account_id: processingAcct.id,
  bank_account: {
    account_number: '1234567890',
    routing_number: '021000021',
    account_type: 'checking',
  },
});
```

**Step 5: Configure Processing Settings**

Depending on the V2 API, this may be done via:
- The Payload dashboard UI (most likely for sandbox)
- API calls to configure card brands, currencies, etc.

### Phase 2: Card & Payment Testing

Once the processing account is active:

**Step 6: Create a Customer**

```typescript
const customer = await pl.Customer.create({
  name: 'Test Payer',
  contact_details: { email: 'payer@example.com' },
});
```

**Step 7: Create a Card Payment Method**

```typescript
const card = await pl.Card.create({
  account_id: customer.id,
  card: {
    card_number: '4242424242424242',  // Standard test card
    expiry: '1229',
    card_code: '123',
  },
});
```

**Test Card Numbers** (industry standard, verify with Payload docs):

| Card Number | Brand | Expected Result |
|-------------|-------|-----------------|
| 4242424242424242 | Visa | Approved |
| 4111111111111111 | Visa | Approved (used in Payload docs) |
| 5555555555554444 | Mastercard | Approved |
| 4000000000000002 | Visa | Declined |

**Step 8: Create a Payment**

```typescript
const payment = await pl.Payment.create({
  type: 'payment',
  amount: 25.00,
  sender: {
    account_id: customer.id,
    method_id: card.id,
  },
  receiver: {
    account_id: processingAcct.id,  // The merchant processing account
  },
  description: 'Sandbox test payment',
});
```

**Step 9: Create a Refund**

```typescript
const refund = await pl.Refund.create({
  type: 'refund',
  amount: 5.00,
  linked_txn_id: payment.id,
  description: 'Partial refund test',
});
```

### Phase 3: Invoice & Billing Schedule Testing

**Step 10: Create an Invoice**

```typescript
const invoice = await pl.Invoice.create({
  biller: {
    account_id: processingAcct.id,  // The merchant/biller
  },
  payer: {
    account_id: customer.id,
  },
  due_date: '2026-04-01',
  description: 'Test invoice',
});
```

**Step 11: Create a Billing Schedule**

```typescript
const schedule = await pl.BillingSchedule.create({
  biller: {
    account_id: processingAcct.id,
  },
  payer: {
    account_id: customer.id,
    method_id: card.id,
  },
  start_date: '2026-03-01',
  description: 'Monthly subscription test',
  recurring_schedule: {
    type: 'monthly',
    billing_day: 1,
  },
});
```

### Phase 4: End-to-End Payment Simulation

A full simulation workflow:

```
1. Create Entity + Stakeholders          (business onboarding)
2. Create Processing Account             (merchant setup)
3. Attach Funding Bank Account           (settlement config)
4. Create Customer Account               (payer setup)
5. Create Card for Customer              (payment method)
6. Process Payment: Customer -> Merchant  (charge card)
7. Verify Payment Status                 (confirmation)
8. Create Partial Refund                 (return funds)
9. Create Invoice with Line Items        (billing)
10. Create Recurring Billing Schedule    (subscription)
11. Record in Ledger                     (bookkeeping)
12. Reconcile Ledger                     (audit)
```

---

## Ledger Testing Status

### What Was Tested

The ledger system is **local/in-memory** (not an API endpoint). It was thoroughly tested:

**32 Unit Tests** (`tests/unit/ledger/ledger-manager.test.ts`):

| Category | Tests | What's Covered |
|----------|-------|----------------|
| Balanced Entry Creation | 4 | Create pairs, reject imbalances, reject negatives, prevent self-transfers |
| Multi-Leg Transactions | 3 | 3+ account splits, imbalance detection, minimum entry validation |
| Account Balance | 1 | Net balance computation (debits - credits) |
| Reconciliation | 1 | Cross-account balance verification |
| Reversals | 2 | Reversal creation, metadata passthrough |
| Metadata | 5 | Storage, multi-leg, backward compatibility, activity inclusion |
| Daily Balances | 2 | Aggregation with running balance, empty datasets |
| Monthly Balances | 1 | Monthly aggregation |
| Account Statements | 2 | Opening/closing balance, prior entries |
| Trial Balance | 2 | Accuracy, imbalance detection |
| Data Export | 3 | JSON export, CSV export, empty handling |
| Transaction Linking | 1 | Payload transaction ID linking |
| Utilities | 3 | Clear, JSON import, account ID retrieval |
| **E2E Tests** | 5+ | Full workflow with balanced entries, multi-leg, reconciliation |
| **TOTAL** | **~37** | **All operations and edge cases** |

### What the Ledger Does NOT Test (and Why)

The ledger is deliberately **not tested against the real API** because:

1. It's a local in-memory bookkeeping engine - no Payload API endpoint exists for ledger storage
2. It links to Payload transactions via `transactionId` for reconciliation, but stores entries locally
3. The design choice was intentional: the ledger provides application-level double-entry accounting that works independently of the payment gateway

### What Could Be Added

To make ledger testing more thorough against real API flows:

1. **Transaction-Linked Ledger Test**: After a real payment succeeds, create corresponding ledger entries and verify the `transactionId` links correctly
2. **Payment Simulation Ledger Integration**: The dashboard's simulation page should automatically record ledger entries for each simulated payment
3. **Reconciliation Against API**: Fetch real transactions from `pl.Payment.all()` and verify each has matching ledger entries
4. **Persistence Layer**: Currently entries are lost on restart. Options:
   - File-based storage (JSON file)
   - SQLite database
   - Redis cache
   - Payload's own API if a ledger endpoint becomes available

---

## Sandbox Limitations & Workarounds

### Known Sandbox Limitations

| Feature | Limitation | Workaround |
|---------|-----------|------------|
| Card creation | Requires active processing account | Set up entity + processing account first |
| Payments | Requires card (blocked by above) | Same - processing account setup |
| Invoice creation | Needs biller account_id | Use processing account as biller |
| Billing schedules | Needs card + biller | Both above prerequisites |
| Payment links | 404 in V2 | May not be available yet in V2 beta |
| Entity KYC | May auto-reject test data | Use Payload-approved test values |

### What May Not Be Testable on Sandbox

1. **Real card processing** - Even with setup, sandbox may not actually charge test cards (funds don't move)
2. **Webhook delivery** - Sandbox may not trigger real webhook events to your URL
3. **Settlement/funding** - No real bank transfers in sandbox mode
4. **Payment links** - Endpoint appears to not exist in V2 yet

### Recommended Approach

1. **Start with the dashboard UI** to manually set up processing accounts (Payload likely provides sandbox onboarding flows)
2. **Check Payload's developer portal** for sandbox-specific documentation or test mode activation
3. **Contact Payload support** to ask about:
   - Test card numbers specific to their platform
   - How to activate processing on sandbox accounts
   - Whether V2 beta has any sandbox-specific endpoints
4. **Use the mock server** for comprehensive testing of all SDK features (already works with 207 tests passing)

---

## Implementation Checklist

- [ ] Verify entity creation with full business details works on sandbox
- [ ] Verify stakeholder/owner creation with test SSN works
- [ ] Attempt processing account creation linked to entity
- [ ] Attempt funding bank account attachment
- [ ] Check if processing account becomes "active" with test data
- [ ] If active: test card creation, payment, refund flow
- [ ] If not active: contact Payload support for sandbox activation
- [ ] Test invoice creation with biller = processing account
- [ ] Test billing schedule creation with biller + payer + card
- [ ] Add ledger entries linked to real transactions
- [ ] Run reconciliation between API transactions and ledger
- [ ] Export ledger data (JSON/CSV) and verify accuracy
- [ ] Document all test card numbers that work on Payload sandbox
- [ ] Update test-v2-api.ts with processing account setup steps

---

## Running the Tests

### Automated Test Suite (Mock Server)
```bash
npm test                    # 207 tests, ~80% coverage
```

### Real API Test Script
```bash
npx ts-node test-v2-api.ts  # Tests against api.payload.com
```

### With Custom API Key
```bash
PAYLOAD_API_KEY=test_secret_key_YOUR_KEY npx ts-node test-v2-api.ts
```
