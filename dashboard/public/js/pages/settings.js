import { api } from '../api.js';
import { toast, buildForm, readForm } from '../components.js';

export async function settingsPage(el) {
  let config = {};
  try { config = await api.getConfig(); } catch {}

  el.innerHTML = `
    <div class="card" style="max-width:600px">
      <div class="card-header"><h2>API Configuration</h2></div>
      <p style="margin-bottom:16px;color:var(--c-text-secondary)">
        Configure the Payload API connection. The SDK session is initialised with these credentials.
        ${config.initialised
          ? '<br><span class="badge badge-success">Connected</span>'
          : '<br><span class="badge badge-danger">Not connected</span>'}
      </p>
      ${buildForm([
        { name: 'apiKey', label: 'API Key', required: true, placeholder: 'test_secret_key_...' },
        { name: 'apiUrl', label: 'API URL', default: config.apiUrl || 'https://api.payload.co' },
      ])}
      <div class="form-actions">
        <button class="btn btn-primary" id="btn-save">Save & Connect</button>
      </div>
    </div>

    <div class="card" style="max-width:600px">
      <div class="card-header"><h2>SDK Objects Reference</h2></div>
      <p style="margin-bottom:12px;color:var(--c-text-secondary)">All API resources available through this dashboard:</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Resource</th><th>SDK Model</th><th>Endpoint</th></tr></thead>
          <tbody>
            <tr><td>Customers</td><td><code>Customer</code></td><td><code>/customers</code></td></tr>
            <tr><td>Payments</td><td><code>Payment</code></td><td><code>/transactions</code></td></tr>
            <tr><td>Refunds</td><td><code>Refund</code></td><td><code>/transactions</code></td></tr>
            <tr><td>Credits</td><td><code>Credit</code></td><td><code>/transactions</code></td></tr>
            <tr><td>Deposits</td><td><code>Deposit</code></td><td><code>/transactions</code></td></tr>
            <tr><td>Cards</td><td><code>Card</code></td><td><code>/payment_methods</code></td></tr>
            <tr><td>Bank Accounts</td><td><code>BankAccount</code></td><td><code>/payment_methods</code></td></tr>
            <tr><td>Billing Schedules</td><td><code>BillingSchedule</code></td><td><code>/billing_schedules</code></td></tr>
            <tr><td>Billing Charges</td><td><code>BillingCharge</code></td><td><code>/billing_charges</code></td></tr>
            <tr><td>Invoices</td><td><code>Invoice</code></td><td><code>/invoices</code></td></tr>
            <tr><td>Invoice Items</td><td><code>InvoiceItem</code></td><td><code>/invoice_items</code></td></tr>
            <tr><td>Charge Items</td><td><code>ChargeItem</code></td><td><code>/line_items</code></td></tr>
            <tr><td>Payment Items</td><td><code>PaymentItem</code></td><td><code>/line_items</code></td></tr>
            <tr><td>Entities</td><td><code>Entity</code></td><td><code>/entities</code></td></tr>
            <tr><td>Stakeholders</td><td><code>Stakeholder</code></td><td><code>/stakeholders</code></td></tr>
            <tr><td>Webhooks</td><td><code>Webhook</code></td><td><code>/webhooks</code></td></tr>
            <tr><td>Webhook Logs</td><td><code>WebhookLog</code></td><td><code>/webhook_logs</code></td></tr>
            <tr><td>Payment Links</td><td><code>PaymentLink</code></td><td><code>/payment_links</code></td></tr>
            <tr><td>Intents</td><td><code>Intent</code></td><td><code>/intents</code></td></tr>
            <tr><td>Transfers</td><td><code>Transfer</code></td><td><code>/transfers</code></td></tr>
            <tr><td>Ledger Entries</td><td><code>Ledger</code></td><td><code>/transaction_ledgers</code></td></tr>
            <tr><td>Processing Accounts</td><td><code>ProcessingAccount</code></td><td><code>/processing_accounts</code></td></tr>
            <tr><td>Processing Agreements</td><td><code>ProcessingAgreement</code></td><td><code>/processing_agreements</code></td></tr>
            <tr><td>Profiles</td><td><code>Profile</code></td><td><code>/profiles</code></td></tr>
            <tr><td>Orgs</td><td><code>Org</code></td><td><code>/accounts/orgs</code></td></tr>
            <tr><td>Accounts</td><td><code>Account</code></td><td><code>/accounts</code></td></tr>
            <tr><td>Client Tokens</td><td><code>ClientToken</code></td><td><code>/access_tokens</code></td></tr>
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('btn-save').onclick = async () => {
    const data = readForm([
      { name: 'apiKey' },
      { name: 'apiUrl' },
    ]);
    if (!data.apiKey) return toast('API key is required', 'error');
    try {
      await api.setConfig(data);
      toast('Connected successfully!', 'success');
      // Refresh status indicator
      const ind = document.getElementById('status-indicator');
      ind.textContent = 'Connected';
      ind.className = 'ok';
    } catch (e) {
      toast(e.error || e.message, 'error');
    }
  };
}
