/**
 * test-v2-api.ts - Test all endpoints against the real Payload V2 API.
 *
 * Tests: Account/Customer, PaymentMethod/Card, Transaction/Payment,
 * Invoice, BillingSchedule, Entity, Webhook, PaymentLink.
 */

import { Session, attr } from './src';

const API_KEY = process.env.PAYLOAD_API_KEY || 'test_secret_key_12iNWc9pk09ixqSR0b5CZGFn9FBkP9nT5AJLY3wFq6u1PA';
const API_URL = process.env.PAYLOAD_API_URL || 'https://api.payload.com';

const pl = new Session(API_KEY, {
  apiUrl: API_URL,
});

// Track results
const results: { name: string; status: string; error?: string; response?: unknown }[] = [];

function logResult(name: string, status: string, data?: unknown, error?: string) {
  results.push({ name, status, error, response: data });
  if (status === 'PASS') {
    console.log(`  [PASS] ${name}`);
  } else if (status === 'EXPECTED_FAIL') {
    console.log(`  [EXPECTED_FAIL] ${name}: ${error}`);
  } else {
    console.log(`  [FAIL] ${name}: ${error}`);
  }
  if (data) {
    console.log(`         Response: ${JSON.stringify(data, null, 2).substring(0, 500)}`);
  }
}

async function testAccountCustomer() {
  console.log('\n=== 1. Account (Customer type) ===');

  let customerId = '';

  // Create
  try {
    const customer = await pl.Customer.create({
      name: 'SDK V2 Test User',
      contact_details: {
        email: 'sdkv2test@example.com',
      },
    });
    customerId = customer.id;
    logResult('Customer.create', 'PASS', { id: customer.id, name: customer.name, type: customer.type });
  } catch (err: any) {
    logResult('Customer.create', 'FAIL', err.details, err.message);
  }

  // List
  try {
    const customers = await pl.Customer.all();
    logResult('Customer.all', 'PASS', {
      count: customers.length,
      first_id: customers[0]?.id,
      first_name: customers[0]?.name,
    });
  } catch (err: any) {
    logResult('Customer.all', 'FAIL', err.details, err.message);
  }

  // Get (if we created one)
  if (customerId) {
    try {
      const fetched = await pl.Customer.get(customerId);
      logResult('Customer.get', 'PASS', { id: fetched.id, name: fetched.name });
    } catch (err: any) {
      logResult('Customer.get', 'FAIL', err.details, err.message);
    }
  }

  return customerId;
}

async function testPaymentMethod(accountId: string) {
  console.log('\n=== 2. PaymentMethod (Card) ===');

  let cardId = '';

  // Create card using V2 nested card object format
  try {
    const card = await pl.Card.create({
      account_id: accountId,
      card: {
        card_number: '4242424242424242',
        expiry: '1229',
        card_code: '123',
      },
    });
    cardId = card.id;
    logResult('Card.create', 'PASS', card.toJSON());
  } catch (err: any) {
    // "Account not yet active for processing" is expected for sandbox accounts
    const msg = err.message || '';
    if (msg.includes('not yet active') || msg.includes('not active')) {
      logResult('Card.create', 'EXPECTED_FAIL', err.details, msg + ' (sandbox account limitation)');
    } else {
      logResult('Card.create', 'FAIL', err.details, msg);
    }
  }

  // List all payment methods
  try {
    const methods = await pl.PaymentMethod.all();
    logResult('PaymentMethod.all', 'PASS', { count: methods.length });
  } catch (err: any) {
    logResult('PaymentMethod.all', 'FAIL', err.details, err.message);
  }

  return cardId;
}

async function testTransaction(senderAccountId: string, senderMethodId: string) {
  console.log('\n=== 3. Transaction (Payment) ===');

  let paymentId = '';

  // Create payment with sender/receiver pattern
  try {
    const payment = await pl.Payment.create({
      amount: 10.00,
      sender: {
        account_id: senderAccountId,
        method_id: senderMethodId,
      },
      description: 'SDK V2 test payment',
    });
    paymentId = payment.id;
    logResult('Payment.create', 'PASS', {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      type: payment.type,
    });
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('not yet active') || msg.includes('not active') || msg.includes('processing')) {
      logResult('Payment.create', 'EXPECTED_FAIL', err.details, msg + ' (sandbox limitation)');
    } else {
      logResult('Payment.create', 'FAIL', err.details, msg);
    }
  }

  // List payments
  try {
    const payments = await pl.Payment.all();
    logResult('Payment.all', 'PASS', { count: payments.length });
  } catch (err: any) {
    logResult('Payment.all', 'FAIL', err.details, err.message);
  }

  return paymentId;
}

async function testInvoice(payerAccountId: string) {
  console.log('\n=== 4. Invoice ===');

  let invoiceId = '';

  // Create invoice - biller is auto-resolved from authenticated account
  // Note: This may fail if the sandbox account doesn't have a processing account set up
  try {
    const invoice = await pl.Invoice.create({
      payer: {
        account_id: payerAccountId,
      },
      due_date: '2026-04-01',
      description: 'SDK V2 test invoice',
    });
    invoiceId = invoice.id;
    logResult('Invoice.create', 'PASS', invoice.toJSON());
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('biller') || msg.includes('Cannot find applicable')) {
      logResult('Invoice.create', 'EXPECTED_FAIL', err.details, msg + ' (no processing account for biller)');
    } else {
      logResult('Invoice.create', 'FAIL', err.details, msg);
    }
  }

  // List invoices
  try {
    const invoices = await pl.Invoice.all();
    logResult('Invoice.all', 'PASS', { count: invoices.length });
  } catch (err: any) {
    logResult('Invoice.all', 'FAIL', err.details, err.message);
  }

  return invoiceId;
}

async function testBillingSchedule(payerAccountId: string, payerMethodId: string) {
  console.log('\n=== 5. BillingSchedule ===');

  let scheduleId = '';

  // Create billing schedule - biller auto-resolved
  try {
    const schedule = await pl.BillingSchedule.create({
      payer: {
        account_id: payerAccountId,
        method_id: payerMethodId,
      },
      start_date: '2026-03-01',
      description: 'SDK V2 test billing schedule',
      recurring_schedule: {
        type: 'monthly',
        billing_day: 1,
      },
    });
    scheduleId = schedule.id;
    logResult('BillingSchedule.create', 'PASS', schedule.toJSON());
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('biller') || msg.includes('Cannot find') || msg.includes('not active')) {
      logResult('BillingSchedule.create', 'EXPECTED_FAIL', err.details, msg + ' (sandbox limitation)');
    } else {
      logResult('BillingSchedule.create', 'FAIL', err.details, msg);
    }
  }

  // List billing schedules
  try {
    const schedules = await pl.BillingSchedule.all();
    logResult('BillingSchedule.all', 'PASS', { count: schedules.length });
  } catch (err: any) {
    logResult('BillingSchedule.all', 'FAIL', err.details, err.message);
  }

  return scheduleId;
}

async function testEntity() {
  console.log('\n=== 6. Entity ===');

  let entityId = '';

  // Create entity (individual type - minimal required fields)
  try {
    const entity = await pl.Entity.create({
      legal_name: 'SDK Test Individual',
      type: 'individual',
      phone_number: '5559876543',
      country: 'US',
      tax_id: { value: '123456789' },
    });
    entityId = entity.id;
    logResult('Entity.create', 'PASS', {
      id: entity.id,
      legal_name: entity.legalName,
      type: entity.type,
      country: entity.country,
    });
  } catch (err: any) {
    logResult('Entity.create', 'FAIL', err.details, err.message);
  }

  // List entities
  try {
    const entities = await pl.Entity.all();
    logResult('Entity.all', 'PASS', { count: entities.length, first_id: entities[0]?.id });
  } catch (err: any) {
    logResult('Entity.all', 'FAIL', err.details, err.message);
  }

  return entityId;
}

async function testWebhook() {
  console.log('\n=== 7. Webhook ===');

  let webhookId = '';

  // Create webhook with valid trigger value
  try {
    const webhook = await pl.Webhook.create({
      url: 'https://example.com/webhook/payload-v2-test',
      trigger: 'payment',
    });
    webhookId = webhook.id;
    logResult('Webhook.create', 'PASS', {
      id: webhook.id,
      url: webhook.url,
      trigger: webhook.trigger,
    });
  } catch (err: any) {
    logResult('Webhook.create', 'FAIL', err.details, err.message);
  }

  // List webhooks
  try {
    const webhooks = await pl.Webhook.all();
    logResult('Webhook.all', 'PASS', { count: webhooks.length });
  } catch (err: any) {
    logResult('Webhook.all', 'FAIL', err.details, err.message);
  }

  // Delete webhook (cleanup)
  if (webhookId) {
    try {
      const req = pl.getRequest();
      await req.delete('/webhooks', webhookId);
      logResult('Webhook.delete', 'PASS', { deleted: webhookId });
    } catch (err: any) {
      logResult('Webhook.delete', 'FAIL', err.details, err.message);
    }
  }

  return webhookId;
}

async function testPaymentLink() {
  console.log('\n=== 8. PaymentLink ===');

  // Note: /payment_links endpoint may not be available in V2 API
  try {
    const link = await pl.PaymentLink.create({
      amount: 50.00,
      description: 'SDK V2 test payment link',
    });
    logResult('PaymentLink.create', 'PASS', link.toJSON());
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('Not Found')) {
      logResult('PaymentLink.create', 'EXPECTED_FAIL', null, 'Endpoint /payment_links not available in V2 API');
    } else {
      logResult('PaymentLink.create', 'FAIL', err.details, msg);
    }
  }
}

async function testAccountList() {
  console.log('\n=== 9. Account (list all types) ===');

  try {
    const accounts = await pl.Account.all();
    logResult('Account.all', 'PASS', {
      count: accounts.length,
      types: accounts.map(a => a.type).filter((v, i, a) => a.indexOf(v) === i),
      ids: accounts.slice(0, 3).map(a => a.id),
    });
  } catch (err: any) {
    logResult('Account.all', 'FAIL', err.details, err.message);
  }
}

async function run() {
  console.log('=== Payload SDK V2 API Test Suite ===');
  console.log(`API URL: ${API_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 20)}...`);
  console.log('');

  // Step 1: Test accounts list first to make sure auth + list parsing works
  await testAccountList();

  // Step 2: Create a customer account
  const customerId = await testAccountCustomer();

  // Step 3: Create a card payment method linked to that account
  let cardId = '';
  if (customerId) {
    cardId = await testPaymentMethod(customerId);
  } else {
    console.log('\n  [SKIP] PaymentMethod tests - no customer created');
  }

  // Step 4: Create a payment transaction (requires card, which requires active processing)
  if (customerId && cardId) {
    await testTransaction(customerId, cardId);
  } else {
    console.log('\n=== 3. Transaction (Payment) ===');
    logResult('Payment.create', 'EXPECTED_FAIL', null, 'Requires card payment method (sandbox not active for processing)');
    // Still test list
    try {
      const payments = await pl.Payment.all();
      logResult('Payment.all', 'PASS', { count: payments.length });
    } catch (err: any) {
      logResult('Payment.all', 'FAIL', err.details, err.message);
    }
  }

  // Step 5: Create an invoice
  if (customerId) {
    await testInvoice(customerId);
  } else {
    console.log('\n  [SKIP] Invoice tests - no customer created');
  }

  // Step 6: Create a billing schedule (requires card for payer method_id)
  if (customerId && cardId) {
    await testBillingSchedule(customerId, cardId);
  } else {
    console.log('\n=== 5. BillingSchedule ===');
    logResult('BillingSchedule.create', 'EXPECTED_FAIL', null, 'Requires card payment method (sandbox not active for processing)');
    // Still test list
    try {
      const schedules = await pl.BillingSchedule.all();
      logResult('BillingSchedule.all', 'PASS', { count: schedules.length });
    } catch (err: any) {
      logResult('BillingSchedule.all', 'FAIL', err.details, err.message);
    }
  }

  // Step 7: Test entities
  await testEntity();

  // Step 8: Test webhooks
  await testWebhook();

  // Step 9: Test payment links
  await testPaymentLink();

  // Summary
  console.log('\n\n=== TEST SUMMARY ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const expectedFail = results.filter(r => r.status === 'EXPECTED_FAIL').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Expected failures (sandbox limitations): ${expectedFail}/${results.length}`);
  console.log(`Unexpected failures: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\nUnexpected failures (bugs to fix):');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`  - ${r.name}: ${r.error}`);
      if (r.response) {
        console.log(`    Details: ${JSON.stringify(r.response)}`);
      }
    }
  }

  if (expectedFail > 0) {
    console.log('\nExpected failures (sandbox limitations):');
    for (const r of results.filter(r => r.status === 'EXPECTED_FAIL')) {
      console.log(`  - ${r.name}: ${r.error}`);
    }
  }

  console.log('\n=== Full Results ===');
  for (const r of results) {
    console.log(`[${r.status}] ${r.name}`);
  }
}

run().catch((err) => {
  console.error('Fatal error:', err.message || err);
  if (err.statusCode) console.error('  Status:', err.statusCode);
  if (err.details) console.error('  Details:', JSON.stringify(err.details));
  process.exit(1);
});
