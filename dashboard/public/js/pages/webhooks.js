import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail, badge } from '../components.js';

const WEBHOOK_FIELDS = [
  { name: 'url', label: 'Webhook URL', required: true, placeholder: 'https://example.com/webhook' },
  { name: 'events', label: 'Events (comma-separated)', placeholder: 'payment.created,refund.created', full: true },
];

export async function webhooksPage(el) {
  let activeTab = 'webhooks';

  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Webhooks</h2>
          <button class="btn btn-primary" id="btn-new">+ New Webhook</button>
        </div>
        <p style="margin-bottom:12px;color:var(--c-text-secondary);font-size:12px">
          Register URLs to receive real-time event notifications (payment.created, refund.created, invoice.paid, etc.).
          Delivery logs track each attempt and response status.
        </p>
        <div class="tabs">
          <button class="tab ${activeTab === 'webhooks' ? 'active' : ''}" data-tab="webhooks">Webhooks</button>
          <button class="tab ${activeTab === 'logs' ? 'active' : ''}" data-tab="logs">Delivery Logs</button>
        </div>
        <div id="table-area">
          <div class="empty-state"><p>Loading...</p></div>
        </div>
      </div>`;
  }

  async function loadTab() {
    const area = document.getElementById('table-area');
    area.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
    try {
      if (activeTab === 'webhooks') {
        const items = await api.list('webhooks', { limit: 20 });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'url', label: 'URL' },
            { key: 'events', label: 'Events', render: v => Array.isArray(v) ? v.join(', ') : String(v || '') },
            { key: 'status', label: 'Status' },
          ],
          items,
          [
            { name: 'view', label: 'View', cls: 'btn-outline' },
            { name: 'enable', label: 'Enable', cls: 'btn-outline' },
            { name: 'disable', label: 'Disable', cls: 'btn-outline' },
            { name: 'delete', label: 'Delete', cls: 'btn-danger btn-sm' },
          ]
        );
      } else {
        const items = await api.list('webhook-logs', { limit: 20, orderBy: '-created_at' });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'webhook_id', label: 'Webhook' },
            { key: 'event_type', label: 'Event' },
            { key: 'response_status', label: 'HTTP Status' },
            { key: 'success', label: 'Success', render: v => v ? badge('completed') : badge('failed') },
            { key: 'attempt_number', label: 'Attempt' },
            { key: 'delivered_at', label: 'Delivered' },
          ],
          items,
          [{ name: 'view', label: 'View', cls: 'btn-outline' }]
        );
      }
    } catch (e) {
      area.innerHTML = `<div class="empty-state"><p style="color:var(--c-danger)">Failed to load: ${e.error || e.message}</p></div>`;
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
        const resource = activeTab === 'webhooks' ? 'webhooks' : 'webhook-logs';
        const item = await api.get(resource, id);
        openModal('Details', kvDetail(item));
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
    if (action === 'enable' || action === 'disable') {
      try {
        await api.action('webhooks', id, action);
        toast(`Webhook ${action}d`, 'success');
        await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
    if (action === 'delete') {
      if (!confirm('Delete this webhook?')) return;
      try {
        await api.del('webhooks', id);
        toast('Webhook deleted', 'success');
        await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
  });

  document.getElementById('btn-new').onclick = () => {
    openModal('New Webhook', buildForm(WEBHOOK_FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        const data = readForm(WEBHOOK_FIELDS);
        // Parse comma-separated events into array
        if (typeof data.events === 'string') {
          data.events = data.events.split(',').map(s => s.trim()).filter(Boolean);
        }
        await api.create('webhooks', data);
        toast('Webhook created', 'success');
        closeModal(); activeTab = 'webhooks'; render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
}
