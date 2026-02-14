
const http = require('http');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function post(resource, data) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data);
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/${resource}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = http.request(opts, (res) => {
      let responseBody = '';
      res.on('data', c => responseBody += c);
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(responseBody); } catch (e) { json = { error: 'Invalid JSON', data: responseBody }; }
        resolve({ status: res.statusCode, body: json });
      });
    });

    req.on('error', (e) => resolve({ status: 0, body: { error: e.message } }));
    req.write(body);
    req.end();
  });
}

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

/* ------------------------------------------------------------------ */
/*  Test Script                                                        */
/* ------------------------------------------------------------------ */

(async () => {
  console.log('--- STARTING CREATE ENTITY TEST ---');

  // 1. Create Customer (via Account endpoint logic likely)
  log('👤', 'Creating Customer...');
  // Based on API introspection, email is inside contact_details
  const customerRes = await post('customers', {
    type: 'customer',
    name: 'Test User',
    description: 'Created via integration test',
    contact_details: {
      email: `test_user_${Date.now()}@example.com`
    }
  });

  if (customerRes.status !== 201) {
    log('❌', `Failed to create customer: ${JSON.stringify(customerRes.body)}`);
    // If we can't create a customer, we probably can't do much else that depends on it
    // But we'll try independent ones.
  }
  
  const customerId = customerRes.body.id;
  if(customerId) log('✅', `Created Customer: ${customerId}`);


  // 2. Create Org (Business Entity)
  log('🏢', 'Creating API Org...');
  const orgRes = await post('orgs', {
    type: 'organization',
    name: `Test Org ${Date.now()}`,
    description: 'Test API Org'
  });
  if (orgRes.status === 201) log('✅', `Created Org: ${orgRes.body.id}`);
  else log('❌', `Org failed: ${JSON.stringify(orgRes.body)}`);


  // 3. Create Processing Account (Merchant)
  log('💳', 'Creating Processing Account...');
  const procRes = await post('processing-accounts', {
    type: 'processing',
    name: 'Test Merchant Account', 
    processing: {
       processing_type: 'card'
    }
  });
  if (procRes.status === 201) log('✅', `Created Processing Account: ${procRes.body.id}`);
  else log('❌', `Processing Account failed: ${JSON.stringify(procRes.body)}`);

  
  if (!customerId) {
    console.log('⚠️  Skipping dependent tests (Payment, etc) because Customer creation failed.');
    return;
  }

  // 4. Create Payment Intent (needs customer)
  log('🎯', 'Creating Payment Intent...');
  const intentRes = await post('intents', {
    customer_id: customerId,
    amount: 1500,
    currency: 'USD',
    description: 'Test Intent'
  });
  if (intentRes.status === 201) log('✅', `Created Intent: ${intentRes.body.id}`);
  else log('❌', `Intent failed: ${JSON.stringify(intentRes.body)}`);

  // 5. Create Payment Link
  log('🔗', 'Creating Payment Link...');
  const linkRes = await post('payment-links', {
    amount: 2000,
    currency: 'USD',
    description: 'Test Payment Link',
    title: 'Consultation Fee'
  });
  if (linkRes.status === 201) log('✅', `Created Payment Link: ${linkRes.body.id}`);
  else log('❌', `Payment Link failed: ${JSON.stringify(linkRes.body)}`);

  // 6. Create Invoice
  log('🧾', 'Creating Invoice...');
  const invoiceRes = await post('invoices', {
    customer_id: customerId,
    amount: 5000,
    currency: 'USD',
    due_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], // +7 days
    description: 'Services Rendered'
  });
  if (invoiceRes.status === 201) log('✅', `Created Invoice: ${invoiceRes.body.id}`);
  else log('❌', `Invoice failed: ${JSON.stringify(invoiceRes.body)}`);

  // 7. Create Billing Schedule (Subscription)
  log('📅', 'Creating Billing Schedule...');
  const scheduleRes = await post('billing-schedules', {
    customer_id: customerId,
    amount: 999,
    currency: 'USD',
    interval: 'month',
    start_date: new Date().toISOString().split('T')[0],
    description: 'Monthly Subscription'
  });
  if (scheduleRes.status === 201) log('✅', `Created Billing Schedule: ${scheduleRes.body.id}`);
  else log('❌', `Billing Schedule failed: ${JSON.stringify(scheduleRes.body)}`);

  // 8. Create Webhook
  log('🪝', 'Creating Webhook...');
  const hookRes = await post('webhooks', {
    url: 'https://example.com/webhook',
    events: ['payment.succeeded', 'invoice.paid'],
    description: 'Test Webhook'
  });
  if (hookRes.status === 201) log('✅', `Created Webhook: ${hookRes.body.id}`);
  else log('❌', `Webhook failed: ${JSON.stringify(hookRes.body)}`);

  console.log('--- TEST COMPLETE ---');
})();
