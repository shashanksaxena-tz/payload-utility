import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail, badge, money, filterBar, paginationBar } from '../components.js';

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

const PAGE_SIZE = 25;

export async function paymentsPage(el) {
  let activeTab = 'payments';
  let currentFilter = null;
  let currentPage = 0;

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
        <p style="margin-bottom:12px;color:var(--c-text-secondary);font-size:12px">
          Transactions include payments, refunds, credits, and deposits. Each type shares
          the <code>/transactions</code> endpoint with a <code>type</code> discriminator.
        </p>
        <div class="tabs" id="txn-tabs">
          ${TYPES.map(t => `<button class="tab ${t === activeTab ? 'active' : ''}" data-tab="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
        </div>
        <div id="filter-area"></div>
        <div id="table-area">
          <div class="empty-state"><p>Loading transactions...</p></div>
        </div>
        <div id="pagination-area"></div>
      </div>`;

    document.getElementById('filter-area').innerHTML = filterBar(
      [
        { key: 'amount', label: 'Amount' },
        { key: 'status', label: 'Status' },
        { key: 'description', label: 'Description' },
        { key: 'customer_id', label: 'Customer ID' },
      ],
      (f) => { currentFilter = f; currentPage = 0; loadTab(); }
    );
  }

  async function loadTab() {
    const area = document.getElementById('table-area');
    const pgArea = document.getElementById('pagination-area');
    area.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
    try {
      const params = { limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE, orderBy: '-created_at' };
      if (currentFilter) {
        params[`filter.${currentFilter.field}.${currentFilter.op}`] = currentFilter.value;
      }
      const items = await api.list(activeTab, params);
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
      pgArea.innerHTML = paginationBar(currentPage, PAGE_SIZE, items.length, (page) => {
        currentPage = page;
        loadTab();
      });
    } catch (e) {
      area.innerHTML = `<div class="empty-state"><p style="color:var(--c-danger)">Failed to load ${activeTab}: ${e.error || e.message}</p>
        <p style="margin-top:8px"><button class="btn btn-outline btn-sm" onclick="location.reload()">Retry</button></p></div>`;
      pgArea.innerHTML = '';
    }
  }

  render();
  await loadTab();

  el.addEventListener('click', async e => {
    // Tab switch
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      activeTab = tab.dataset.tab;
      currentFilter = null;
      currentPage = 0;
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
