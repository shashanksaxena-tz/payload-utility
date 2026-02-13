import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail } from '../components.js';

const CARD_FIELDS = [
  { name: 'card_number', label: 'Card Number', required: true, placeholder: '4242424242424242' },
  { name: 'expiry', label: 'Expiry', required: true, placeholder: '12/2028' },
  { name: 'card_code', label: 'CVV', required: true, placeholder: '123' },
  { name: 'customer_id', label: 'Customer ID' },
];

const BANK_FIELDS = [
  { name: 'account_number', label: 'Account Number', required: true },
  { name: 'routing_number', label: 'Routing Number', required: true },
  { name: 'account_type', label: 'Account Type', type: 'select', options: [
    { value: 'checking', label: 'Checking' },
    { value: 'savings', label: 'Savings' },
  ]},
  { name: 'customer_id', label: 'Customer ID' },
];

export async function paymentMethodsPage(el) {
  let activeTab = 'cards';

  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Payment Methods</h2>
          <div class="btn-group">
            <button class="btn btn-primary" id="btn-new-card">+ Card</button>
            <button class="btn btn-outline" id="btn-new-bank">+ Bank Account</button>
          </div>
        </div>
        <p style="margin-bottom:12px;color:var(--c-text-secondary);font-size:12px">
          Payment methods (Cards and Bank Accounts) are polymorphic subtypes sharing the
          <code>/payment_methods</code> endpoint. Use test card <code>4242424242424242</code> in sandbox.
        </p>
        <div class="tabs" id="pm-tabs">
          <button class="tab ${activeTab === 'cards' ? 'active' : ''}" data-tab="cards">Cards</button>
          <button class="tab ${activeTab === 'bank-accounts' ? 'active' : ''}" data-tab="bank-accounts">Bank Accounts</button>
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
      const items = await api.list(activeTab, { limit: 20 });
      const cols = activeTab === 'cards'
        ? [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'last_four', label: 'Last 4', render: (v, r) => v || (r.card_number ? r.card_number.slice(-4) : '-') },
            { key: 'brand', label: 'Brand' },
            { key: 'expiry', label: 'Expiry' },
            { key: 'status', label: 'Status' },
          ]
        : [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'account_type', label: 'Type' },
            { key: 'routing_number', label: 'Routing' },
            { key: 'status', label: 'Status' },
          ];
      area.innerHTML = dataTable(cols, items, [
        { name: 'view', label: 'View', cls: 'btn-outline' },
        { name: 'delete', label: 'Delete', cls: 'btn-danger btn-sm' },
      ]);
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
        const item = await api.get(activeTab, id);
        openModal('Payment Method Details', kvDetail(item));
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
    if (action === 'delete') {
      if (!confirm('Delete this payment method?')) return;
      try {
        await api.del(activeTab, id);
        toast('Deleted', 'success');
        await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
  });

  document.getElementById('btn-new-card').onclick = () => {
    openModal('New Card', buildForm(CARD_FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create Card</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('cards', readForm(CARD_FIELDS));
        toast('Card created', 'success');
        closeModal();
        activeTab = 'cards'; render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };

  document.getElementById('btn-new-bank').onclick = () => {
    openModal('New Bank Account', buildForm(BANK_FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create Bank Account</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('bank-accounts', readForm(BANK_FIELDS));
        toast('Bank account created', 'success');
        closeModal();
        activeTab = 'bank-accounts'; render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
}
