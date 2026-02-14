
const http = require('http');

const RESOURCES = [
  'customers', 'payments', 'refunds', 'credits', 'deposits', 
  'cards', 'bank-accounts', 'billing-schedules', 'billing-charges', 
  'invoices', 'invoice-items', 'charge-items', 'payment-items', 
  'entities', 'stakeholders', 'webhooks', 'webhook-logs', 
  'payment-links', 'intents', 'transfers', 'ledger-entries', 
  'processing-accounts', 'processing-agreements', 'profiles', 
  'orgs', 'accounts', 'client-tokens'
];

async function testEndpoint(resource) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/${resource}?limit=1`,
      method: 'GET',
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ resource, status: res.statusCode, data: data.substring(0, 500) }); // Truncate data
      });
    });

    req.on('error', (e) => {
      resolve({ resource, status: 0, error: e.message });
    });
    
    req.end();
  });
}

(async () => {
  console.log('--- STARTING COMPREHENSIVE READ TEST ---');
  const results = [];
  
  // 1. Test GET Lists
  for (const r of RESOURCES) {
    const res = await testEndpoint(r);
    results.push(res);
    console.log(`${res.status === 200 ? '✅' : '❌'} ${r}: ${res.status}`);
    if (res.status !== 200) console.log(`   -> Response: ${res.data}`);
  }
  
  // 2. Report Summary
  const success = results.filter(r => r.status === 200);
  const failed = results.filter(r => r.status !== 200);
  
  console.log('\n--- REPORT ---');
  console.log(`Total: ${results.length}`);
  console.log(`Success: ${success.length}`);
  console.log(`Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log('\nFailures:');
    failed.forEach(f => console.log(`- ${f.resource}: ${f.status} ${f.data}`));
  }
})();
