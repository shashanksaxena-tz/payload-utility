import { api } from '../api.js';
import { toast, money, badge } from '../components.js';

export async function dashboardPage(el) {
  el.innerHTML = `
    <div class="stats-grid" id="stats-grid">
      <div class="stat-card"><div class="stat-label">Loading stats...</div><div class="stat-value">-</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card" style="margin-bottom:0">
        <div class="card-header"><h2>Quick Actions</h2></div>
        <div class="btn-group" style="flex-wrap:wrap">
          <button class="btn btn-primary" onclick="location.hash='customers'">New Customer</button>
          <button class="btn btn-primary" onclick="location.hash='payments'">New Payment</button>
          <button class="btn btn-primary" onclick="location.hash='invoices'">New Invoice</button>
          <button class="btn btn-outline" onclick="location.hash='billing'">Billing Schedules</button>
          <button class="btn btn-outline" onclick="location.hash='simulate'">Simulate Payment</button>
          <button class="btn btn-outline" onclick="location.hash='reports'">View Reports</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:0">
        <div class="card-header"><h2>System Status</h2></div>
        <div id="system-status">
          <p style="color:var(--c-text-secondary)">Checking connection...</p>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card" style="margin-bottom:0">
        <div class="card-header"><h2>Recent Payments</h2></div>
        <div id="recent-payments">
          <p style="color:var(--c-text-secondary)">Loading...</p>
        </div>
      </div>
      <div class="card" style="margin-bottom:0">
        <div class="card-header"><h2>Recent Invoices</h2></div>
        <div id="recent-invoices">
          <p style="color:var(--c-text-secondary)">Loading...</p>
        </div>
      </div>
    </div>`;

  // Load stats
  const grid = document.getElementById('stats-grid');
  try {
    const stats = await api.stats();
    const items = [
      { key: 'Customer', label: 'Customers', color: '' },
      { key: 'Payment', label: 'Payments', color: '' },
      { key: 'Invoice', label: 'Invoices', color: '' },
      { key: 'BillingSchedule', label: 'Billing Schedules', color: '' },
      { key: 'Webhook', label: 'Webhooks', color: '' },
      { key: 'Entity', label: 'Entities', color: '' },
      { key: 'Transfer', label: 'Transfers', color: '' },
    ];
    grid.innerHTML = items.map(item => `
      <div class="stat-card">
        <div class="stat-label">${item.label}</div>
        <div class="stat-value">${stats[item.key] ?? '-'}</div>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = `
      <div class="stat-card"><div class="stat-label">Stats unavailable</div><div class="stat-value">-</div></div>
    `;
  }

  // System status
  const statusArea = document.getElementById('system-status');
  try {
    const cfg = await api.getConfig();
    statusArea.innerHTML = `
      <div class="kv-list" style="font-size:13px">
        <div class="kv-key">Connection</div>
        <div class="kv-val">${cfg.initialised
          ? '<span class="badge badge-success">Connected</span>'
          : '<span class="badge badge-danger">Not Connected</span>'}</div>
        <div class="kv-key">API URL</div>
        <div class="kv-val"><code>${cfg.apiUrl || 'Not set'}</code></div>
        <div class="kv-key">API Key</div>
        <div class="kv-val">${cfg.hasKey
          ? '<span class="badge badge-success">Configured</span>'
          : '<span class="badge badge-warning">Missing</span>'}</div>
      </div>
      ${!cfg.initialised ? '<p style="margin-top:12px"><a href="#settings" style="color:var(--c-primary)">Configure API Key in Settings</a></p>' : ''}`;
  } catch {
    statusArea.innerHTML = '<p style="color:var(--c-danger)">Cannot reach dashboard backend</p>';
  }

  // Recent payments
  const paymentsArea = document.getElementById('recent-payments');
  try {
    const payments = await api.list('payments', { limit: 5, orderBy: '-created_at' });
    if (!payments || payments.length === 0) {
      paymentsArea.innerHTML = '<p style="color:var(--c-text-secondary)">No payments yet. <a href="#simulate" style="color:var(--c-primary)">Simulate a payment</a></p>';
    } else {
      paymentsArea.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Amount</th><th>Status</th><th>Description</th></tr></thead><tbody>'
        + payments.map(p => `<tr>
          <td>${money(p.amount)}</td>
          <td>${badge(p.status)}</td>
          <td>${p.description || '-'}</td>
        </tr>`).join('')
        + '</tbody></table></div>'
        + '<p style="margin-top:8px"><a href="#payments" style="color:var(--c-primary);font-size:12px">View all transactions</a></p>';
    }
  } catch {
    paymentsArea.innerHTML = '<p style="color:var(--c-text-secondary)">Could not load payments</p>';
  }

  // Recent invoices
  const invoicesArea = document.getElementById('recent-invoices');
  try {
    const invoices = await api.list('invoices', { limit: 5, orderBy: '-created_at' });
    if (!invoices || invoices.length === 0) {
      invoicesArea.innerHTML = '<p style="color:var(--c-text-secondary)">No invoices yet. <a href="#invoices" style="color:var(--c-primary)">Create an invoice</a></p>';
    } else {
      invoicesArea.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Amount</th><th>Status</th><th>Due Date</th></tr></thead><tbody>'
        + invoices.map(i => `<tr>
          <td>${money(i.total_amount || i.amount_due)}</td>
          <td>${badge(i.status)}</td>
          <td>${i.due_date || '-'}</td>
        </tr>`).join('')
        + '</tbody></table></div>'
        + '<p style="margin-top:8px"><a href="#invoices" style="color:var(--c-primary);font-size:12px">View all invoices</a></p>';
    }
  } catch {
    invoicesArea.innerHTML = '<p style="color:var(--c-text-secondary)">Could not load invoices</p>';
  }
}
