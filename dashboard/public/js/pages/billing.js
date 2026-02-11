import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail, money, badge } from '../components.js';

const SCHEDULE_FIELDS = [
  { name: 'customer_id', label: 'Customer ID', required: true },
  { name: 'payment_method_id', label: 'Payment Method ID', required: true },
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'frequency', label: 'Frequency', type: 'select', options: [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ]},
  { name: 'start_date', label: 'Start Date', type: 'date', required: true },
  { name: 'description', label: 'Description' },
];

export async function billingPage(el) {
  let activeTab = 'schedules';

  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Billing</h2>
          <button class="btn btn-primary" id="btn-new">+ New Schedule</button>
        </div>
        <div class="tabs">
          <button class="tab ${activeTab === 'schedules' ? 'active' : ''}" data-tab="schedules">Schedules</button>
          <button class="tab ${activeTab === 'charges' ? 'active' : ''}" data-tab="charges">Charges</button>
        </div>
        <div id="table-area"></div>
      </div>`;
  }

  async function loadTab() {
    const area = document.getElementById('table-area');
    area.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
    try {
      if (activeTab === 'schedules') {
        const items = await api.list('billing-schedules', { limit: 100, orderBy: '-created_at' });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'amount', label: 'Amount', render: v => money(v) },
            { key: 'frequency', label: 'Frequency' },
            { key: 'status', label: 'Status' },
            { key: 'next_charge_date', label: 'Next Charge' },
            { key: 'description', label: 'Description' },
          ],
          items,
          [
            { name: 'view', label: 'View', cls: 'btn-outline' },
            { name: 'pause', label: 'Pause', cls: 'btn-outline' },
            { name: 'resume', label: 'Resume', cls: 'btn-outline' },
            { name: 'cancel', label: 'Cancel', cls: 'btn-danger btn-sm' },
          ]
        );
      } else {
        const items = await api.list('billing-charges', { limit: 100, orderBy: '-created_at' });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'billing_schedule_id', label: 'Schedule' },
            { key: 'amount', label: 'Amount', render: v => money(v) },
            { key: 'status', label: 'Status' },
            { key: 'charge_date', label: 'Charge Date' },
            { key: 'attempt_count', label: 'Attempts' },
          ],
          items,
          [{ name: 'view', label: 'View', cls: 'btn-outline' }]
        );
      }
    } catch (e) {
      area.innerHTML = `<p style="color:var(--c-danger)">${e.error || e.message}</p>`;
    }
  }

  render();
  await loadTab();

  el.addEventListener('click', async e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      activeTab = tab.dataset.tab;
      el.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
      await loadTab();
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { id, action } = btn.dataset;

    if (action === 'view') {
      try {
        const resource = activeTab === 'schedules' ? 'billing-schedules' : 'billing-charges';
        const item = await api.get(resource, id);
        openModal('Details', kvDetail(item));
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
    if (['pause','resume','cancel'].includes(action)) {
      if (action === 'cancel' && !confirm('Cancel this billing schedule?')) return;
      try {
        await api.action('billing-schedules', id, action);
        toast(`Schedule ${action}d`, 'success');
        await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
  });

  document.getElementById('btn-new').onclick = () => {
    openModal('New Billing Schedule', buildForm(SCHEDULE_FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create Schedule</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('billing-schedules', readForm(SCHEDULE_FIELDS));
        toast('Billing schedule created', 'success');
        closeModal();
        activeTab = 'schedules'; render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
}
