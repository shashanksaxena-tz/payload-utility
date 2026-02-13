import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail, money } from '../components.js';

const FIELDS = [
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'description', label: 'Description' },
  { name: 'currency', label: 'Currency', default: 'USD' },
];

export async function paymentLinksPage(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Payment Links</h2>
        <button class="btn btn-primary" id="btn-new">+ New Payment Link</button>
      </div>
      <p style="margin-bottom:12px;color:var(--c-text-secondary);font-size:12px">
        Generate shareable URLs that customers can click to make a payment without a full checkout integration.
        Try the <a href="#simulate" style="color:var(--c-primary)">Simulate</a> page for a step-by-step demo.
      </p>
      <div id="table-area">
        <div class="empty-state"><p>Loading...</p></div>
      </div>
    </div>`;

  async function load() {
    const area = document.getElementById('table-area');
    area.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
    try {
      const items = await api.list('payment-links', { limit: 20, orderBy: '-created_at' });
      area.innerHTML = dataTable(
        [
          { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
          { key: 'amount', label: 'Amount', render: v => money(v) },
          { key: 'currency', label: 'Currency' },
          { key: 'description', label: 'Description' },
          { key: 'url', label: 'URL', render: v => v ? `<a href="${v}" target="_blank" style="color:var(--c-primary)">${v}</a>` : '-' },
          { key: 'status', label: 'Status' },
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
        const item = await api.get('payment-links', id);
        openModal('Payment Link Details', kvDetail(item));
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
    if (action === 'delete') {
      if (!confirm('Delete this payment link?')) return;
      try {
        await api.del('payment-links', id);
        toast('Deleted', 'success');
        await load();
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
  });

  document.getElementById('btn-new').onclick = () => {
    openModal('New Payment Link', buildForm(FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('payment-links', readForm(FIELDS));
        toast('Payment link created', 'success');
        closeModal();
        await load();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
}
