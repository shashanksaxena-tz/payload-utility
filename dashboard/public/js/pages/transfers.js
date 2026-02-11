import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail, money } from '../components.js';

const FIELDS = [
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'source_account_id', label: 'Source Account ID', required: true },
  { name: 'destination_account_id', label: 'Destination Account ID', required: true },
  { name: 'description', label: 'Description' },
  { name: 'currency', label: 'Currency', default: 'USD' },
];

export async function transfersPage(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Transfers</h2>
        <button class="btn btn-primary" id="btn-new">+ New Transfer</button>
      </div>
      <div id="table-area"></div>
    </div>`;

  async function load() {
    const area = document.getElementById('table-area');
    try {
      const items = await api.list('transfers', { limit: 100, orderBy: '-created_at' });
      area.innerHTML = dataTable(
        [
          { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
          { key: 'amount', label: 'Amount', render: v => money(v) },
          { key: 'source_account_id', label: 'Source' },
          { key: 'destination_account_id', label: 'Destination' },
          { key: 'status', label: 'Status' },
          { key: 'description', label: 'Description' },
        ],
        items,
        [
          { name: 'view', label: 'View', cls: 'btn-outline' },
          { name: 'delete', label: 'Delete', cls: 'btn-danger btn-sm' },
        ]
      );
    } catch (e) {
      area.innerHTML = `<p style="color:var(--c-danger)">${e.error || e.message}</p>`;
    }
  }

  await load();

  el.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { id, action } = btn.dataset;
    if (action === 'view') {
      try {
        const item = await api.get('transfers', id);
        openModal('Transfer Details', kvDetail(item));
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
    if (action === 'delete') {
      if (!confirm('Delete this transfer?')) return;
      try {
        await api.del('transfers', id);
        toast('Deleted', 'success');
        await load();
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
  });

  document.getElementById('btn-new').onclick = () => {
    openModal('New Transfer', buildForm(FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('transfers', readForm(FIELDS));
        toast('Transfer created', 'success');
        closeModal();
        await load();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
}
