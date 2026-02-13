import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail, badge, filterBar, paginationBar } from '../components.js';

const FIELDS = [
  { name: 'name',  label: 'Name',  required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone' },
];

const PAGE_SIZE = 25;

export async function customersPage(el) {
  let currentFilter = null;
  let currentPage = 0;

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Customers</h2>
        <button class="btn btn-primary" id="btn-new">+ New Customer</button>
      </div>
      <p style="margin-bottom:12px;color:var(--c-text-secondary);font-size:12px">
        In Payload V2, customers are Account objects with <code>type=customer</code>.
        This page manages customer accounts.
      </p>
      <div id="filter-area"></div>
      <div id="table-area">
        <div class="empty-state"><p>Loading customers...</p></div>
      </div>
      <div id="pagination-area"></div>
    </div>`;

  document.getElementById('filter-area').innerHTML = filterBar(
    [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status' },
    ],
    (f) => { currentFilter = f; currentPage = 0; load(); }
  );

  async function load() {
    const area = document.getElementById('table-area');
    const pgArea = document.getElementById('pagination-area');
    area.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
    try {
      const params = { limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE, orderBy: '-created_at' };
      if (currentFilter) {
        params[`filter.${currentFilter.field}.${currentFilter.op}`] = currentFilter.value;
      }
      const items = await api.list('customers', params);
      area.innerHTML = dataTable(
        [
          { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'status', label: 'Status' },
        ],
        items,
        [
          { name: 'view', label: 'View', cls: 'btn-outline' },
          { name: 'edit', label: 'Edit', cls: 'btn-outline' },
          { name: 'delete', label: 'Delete', cls: 'btn-danger btn-sm' },
        ]
      );
      pgArea.innerHTML = paginationBar(currentPage, PAGE_SIZE, items.length, (page) => {
        currentPage = page;
        load();
      });
    } catch (e) {
      area.innerHTML = `<div class="empty-state"><p style="color:var(--c-danger)">Failed to load customers: ${e.error || e.message}</p>
        <p style="margin-top:8px"><button class="btn btn-outline btn-sm" onclick="location.reload()">Retry</button></p></div>`;
      pgArea.innerHTML = '';
    }
  }

  await load();

  el.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'view') {
      try {
        const item = await api.get('customers', id);
        openModal('Customer Details', kvDetail(item));
      } catch (e) { toast(e.error || e.message, 'error'); }
    }

    if (action === 'edit') {
      try {
        const item = await api.get('customers', id);
        openModal('Edit Customer',
          buildForm(FIELDS, item) +
          `<div class="form-actions"><button class="btn btn-primary" id="btn-save-edit">Save</button></div>`
        );
        document.getElementById('btn-save-edit').onclick = async () => {
          try {
            await api.update('customers', id, readForm(FIELDS));
            toast('Customer updated', 'success');
            closeModal();
            await load();
          } catch (e) { toast(e.error || e.message, 'error'); }
        };
      } catch (e) { toast(e.error || e.message, 'error'); }
    }

    if (action === 'delete') {
      if (!confirm('Delete this customer?')) return;
      try {
        await api.del('customers', id);
        toast('Customer deleted', 'success');
        await load();
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
  });

  document.getElementById('btn-new').onclick = () => {
    openModal('New Customer',
      buildForm(FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save-new">Create</button></div>`
    );
    document.getElementById('btn-save-new').onclick = async () => {
      try {
        await api.create('customers', readForm(FIELDS));
        toast('Customer created', 'success');
        closeModal();
        await load();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
}
