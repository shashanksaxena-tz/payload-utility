import { api } from '../api.js';
import { toast } from '../components.js';

export async function dashboardPage(el) {
  el.innerHTML = '<div class="stats-grid" id="stats-grid"></div><div class="card"><div class="card-header"><h2>Quick Actions</h2></div><div class="btn-group" id="quick-actions"></div></div>';

  const grid = document.getElementById('stats-grid');
  grid.innerHTML = '<div class="stat-card"><div class="stat-label">Loading...</div></div>';

  try {
    const stats = await api.stats();
    const labels = {
      Customer: 'Customers', Payment: 'Payments', Invoice: 'Invoices',
      BillingSchedule: 'Billing Schedules', Webhook: 'Webhooks',
      Entity: 'Entities', Transfer: 'Transfers',
    };
    grid.innerHTML = Object.entries(labels).map(([key, label]) => `
      <div class="stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${stats[key] ?? '—'}</div>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = `<div class="stat-card"><div class="stat-label">Could not load stats</div><div class="stat-value">—</div></div>`;
  }

  const qa = document.getElementById('quick-actions');
  qa.innerHTML = `
    <button class="btn btn-primary" onclick="location.hash='customers'">New Customer</button>
    <button class="btn btn-primary" onclick="location.hash='payments'">New Payment</button>
    <button class="btn btn-primary" onclick="location.hash='invoices'">New Invoice</button>
    <button class="btn btn-primary" onclick="location.hash='billing'">New Billing Schedule</button>
    <button class="btn btn-outline" onclick="location.hash='ledger'">Open Ledger</button>
    <button class="btn btn-outline" onclick="location.hash='settings'">Settings</button>
  `;
}
