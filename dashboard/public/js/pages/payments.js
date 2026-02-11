import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail, badge, money } from '../components.js';

const TYPES = ['payments', 'refunds', 'credits', 'deposits'];

const PAYMENT_FIELDS = [
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'customer_id', label: 'Customer ID' },
  { name: 'payment_method_id', label: 'Payment Method ID' },
  { name: 'description', label: 'Description' },
];
const REFUND_FIELDS = [
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'linked_transaction_id', label: 'Linked Transaction ID', required: true },
  { name: 'description', label: 'Description' },
];

export async function paymentsPage(el) {
  let activeTab = 'payments';

  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Transactions</h2>
          <div class="btn-group">
            <button class="btn btn-primary" id="btn-new-payment">+ Payment</button>
            <button class="btn btn-outline" id="btn-new-refund">+ Refund</button>
          </div>
        </div>
        <div class="tabs" id="txn-tabs">
          ${TYPES.map(t => `<button class="tab ${t === activeTab ? 'active' : ''}" data-tab="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
        </div>
        <div id="table-area"></div>
      </div>`;
  }

  async function loadTab() {
    const area = document.getElementById('table-area');
    area.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
    try {
      const items = await api.list(activeTab, { limit: 100, orderBy: '-created_at' });
      area.innerHTML = dataTable(
        [
          { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
          { key: 'amount', label: 'Amount', render: v => money(v) },
          { key: 'status', label: 'Status' },
          { key: 'description', label: 'Description' },
          { key: 'created_at', label: 'Created' },
        ],
        items,
        [
          { name: 'view', label: 'View', cls: 'btn-outline' },
          { name: 'void', label: 'Void', cls: 'btn-danger btn-sm' },
        ]
      );
    } catch (e) {
      area.innerHTML = `<p style="color:var(--c-danger)">${e.error || e.message}</p>`;
    }
  }

  render();
  await loadTab();

  el.addEventListener('click', async e => {
    // Tab switch
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
        const item = await api.get(activeTab, id);
        openModal('Transaction Details', kvDetail(item));
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
    if (action === 'void') {
      if (!confirm('Void this transaction?')) return;
      try {
        await api.action(activeTab, id, 'void');
        toast('Transaction voided', 'success');
        await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
  });

  document.getElementById('btn-new-payment').onclick = () => {
    openModal('New Payment',
      buildForm(PAYMENT_FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create Payment</button></div>`
    );
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('payments', readForm(PAYMENT_FIELDS));
        toast('Payment created', 'success');
        closeModal();
        activeTab = 'payments';
        render();
        await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };

  document.getElementById('btn-new-refund').onclick = () => {
    openModal('New Refund',
      buildForm(REFUND_FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create Refund</button></div>`
    );
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('refunds', readForm(REFUND_FIELDS));
        toast('Refund created', 'success');
        closeModal();
        activeTab = 'refunds';
        render();
        await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
}
