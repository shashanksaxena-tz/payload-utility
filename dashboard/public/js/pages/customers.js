import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail, badge } from '../components.js';

const FIELDS = [
  { name: 'name',  label: 'Name',  required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone' },
];

export async function customersPage(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Customers</h2>
        <button class="btn btn-primary" id="btn-new">+ New Customer</button>
      </div>
      <div id="table-area"></div>
    </div>`;

  async function load() {
    const area = document.getElementById('table-area');
    try {
      const items = await api.list('customers', { limit: 100, orderBy: '-created_at' });
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
    } catch (e) {
      area.innerHTML = `<p style="color:var(--c-danger)">${e.error || e.message}</p>`;
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
