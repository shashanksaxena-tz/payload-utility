import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail, money } from '../components.js';

const FIELDS = [
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'currency', label: 'Currency', default: 'USD' },
  { name: 'customer_id', label: 'Customer ID' },
  { name: 'description', label: 'Description' },
];

export async function intentsPage(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Payment Intents</h2>
        <button class="btn btn-primary" id="btn-new">+ New Intent</button>
      </div>
      <p style="margin-bottom:16px;color:var(--c-text-secondary);font-size:12px">
        Payment intents represent the intent to collect a payment. The <code>client_secret</code> is passed
        to the frontend JS SDK to confirm payment on the client side. This is used for SCA-compliant flows.
      </p>
      <div id="table-area">
        <div class="empty-state"><p>Loading...</p></div>
      </div>
    </div>`;

  async function load() {
    const area = document.getElementById('table-area');
    area.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
    try {
      const items = await api.list('intents', { limit: 20, orderBy: '-created_at' });
      area.innerHTML = dataTable(
        [
          { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
          { key: 'amount', label: 'Amount', render: v => money(v) },
          { key: 'currency', label: 'Currency' },
          { key: 'customer_id', label: 'Customer' },
          { key: 'status', label: 'Status' },
          { key: 'client_secret', label: 'Client Secret', render: v => v ? `<code style="font-size:11px">${v}</code>` : '-' },
          { key: 'description', label: 'Description' },
        ],
        items,
        [
          { name: 'view', label: 'View', cls: 'btn-outline' },
          { name: 'delete', label: 'Delete', cls: 'btn-danger btn-sm' },
        ]
      );
    } catch (e) {
      area.innerHTML = `<div class="empty-state"><p style="color:var(--c-danger)">Failed to load: ${e.error || e.message}</p></div>`;
    }
  }

  await load();

  el.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { id, action } = btn.dataset;
    if (action === 'view') {
      try {
        const item = await api.get('intents', id);
        openModal('Intent Details', kvDetail(item));
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
    if (action === 'delete') {
      if (!confirm('Delete this intent?')) return;
      try {
        await api.del('intents', id);
        toast('Intent deleted', 'success');
        await load();
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
  });

  document.getElementById('btn-new').onclick = () => {
    openModal('New Payment Intent', buildForm(FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create Intent</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('intents', readForm(FIELDS));
        toast('Intent created', 'success');
        closeModal();
        await load();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
}
