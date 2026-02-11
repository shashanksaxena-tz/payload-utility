import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail, money, badge } from '../components.js';

const INVOICE_FIELDS = [
  { name: 'customer_id', label: 'Customer ID', required: true },
  { name: 'due_date', label: 'Due Date', type: 'date', required: true },
  { name: 'description', label: 'Description' },
  { name: 'currency', label: 'Currency', default: 'USD' },
];

const ITEM_FIELDS = [
  { name: 'invoice_id', label: 'Invoice ID', required: true },
  { name: 'description', label: 'Description', required: true },
  { name: 'quantity', label: 'Quantity', type: 'number', required: true },
  { name: 'unit_price', label: 'Unit Price', type: 'number', required: true },
];

const LINE_ITEM_FIELDS = [
  { name: 'invoice_id', label: 'Invoice ID', required: true },
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'description', label: 'Description' },
  { name: 'transaction_id', label: 'Transaction ID (for payments)' },
];

export async function invoicesPage(el) {
  let activeTab = 'invoices';

  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Invoicing</h2>
          <div class="btn-group">
            <button class="btn btn-primary" id="btn-new-invoice">+ Invoice</button>
            <button class="btn btn-outline" id="btn-new-item">+ Invoice Item</button>
            <button class="btn btn-outline" id="btn-new-charge-item">+ Charge Item</button>
            <button class="btn btn-outline" id="btn-new-payment-item">+ Payment Item</button>
          </div>
        </div>
        <div class="tabs">
          <button class="tab ${activeTab === 'invoices' ? 'active' : ''}" data-tab="invoices">Invoices</button>
          <button class="tab ${activeTab === 'items' ? 'active' : ''}" data-tab="items">Invoice Items</button>
          <button class="tab ${activeTab === 'line-items' ? 'active' : ''}" data-tab="line-items">Line Items</button>
        </div>
        <div id="table-area"></div>
      </div>`;
  }

  async function loadTab() {
    const area = document.getElementById('table-area');
    area.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
    try {
      if (activeTab === 'invoices') {
        const items = await api.list('invoices', { limit: 100, orderBy: '-created_at' });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'number', label: 'Number' },
            { key: 'customer_id', label: 'Customer' },
            { key: 'total_amount', label: 'Total', render: v => money(v) },
            { key: 'amount_due', label: 'Due', render: v => money(v) },
            { key: 'status', label: 'Status' },
            { key: 'due_date', label: 'Due Date' },
          ],
          items,
          [
            { name: 'view', label: 'View', cls: 'btn-outline' },
            { name: 'send', label: 'Send', cls: 'btn-outline' },
            { name: 'mark-paid', label: 'Mark Paid', cls: 'btn-outline' },
            { name: 'void', label: 'Void', cls: 'btn-danger btn-sm' },
          ]
        );
      } else if (activeTab === 'items') {
        const items = await api.list('invoice-items', { limit: 100 });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'invoice_id', label: 'Invoice' },
            { key: 'description', label: 'Description' },
            { key: 'quantity', label: 'Qty' },
            { key: 'unit_price', label: 'Unit Price', render: v => money(v) },
            { key: 'amount', label: 'Total', render: v => money(v) },
          ],
          items,
          [{ name: 'view', label: 'View', cls: 'btn-outline' }]
        );
      } else {
        const charges = await api.list('charge-items', { limit: 50 });
        const pmts = await api.list('payment-items', { limit: 50 });
        const combined = [...charges.map(c => ({...c, _type:'charge'})), ...pmts.map(p => ({...p, _type:'payment'}))];
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: '_type', label: 'Type', render: v => badge(v) },
            { key: 'invoice_id', label: 'Invoice' },
            { key: 'amount', label: 'Amount', render: v => money(v) },
            { key: 'description', label: 'Description' },
          ],
          combined,
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
        const resource = activeTab === 'items' ? 'invoice-items' : 'invoices';
        const item = await api.get(resource, id);
        openModal('Details', kvDetail(item));
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
    if (['send', 'mark-paid', 'void'].includes(action)) {
      try {
        await api.action('invoices', id, action);
        toast(`Invoice ${action.replace('-',' ')}`, 'success');
        await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
  });

  document.getElementById('btn-new-invoice').onclick = () => {
    openModal('New Invoice', buildForm(INVOICE_FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('invoices', readForm(INVOICE_FIELDS));
        toast('Invoice created', 'success');
        closeModal(); activeTab = 'invoices'; render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };

  document.getElementById('btn-new-item').onclick = () => {
    openModal('New Invoice Item', buildForm(ITEM_FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('invoice-items', readForm(ITEM_FIELDS));
        toast('Invoice item added', 'success');
        closeModal(); activeTab = 'items'; render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };

  document.getElementById('btn-new-charge-item').onclick = () => {
    openModal('New Charge Item', buildForm(LINE_ITEM_FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('charge-items', readForm(LINE_ITEM_FIELDS));
        toast('Charge item created', 'success');
        closeModal(); activeTab = 'line-items'; render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };

  document.getElementById('btn-new-payment-item').onclick = () => {
    openModal('New Payment Item', buildForm(LINE_ITEM_FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('payment-items', readForm(LINE_ITEM_FIELDS));
        toast('Payment item created', 'success');
        closeModal(); activeTab = 'line-items'; render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
}
