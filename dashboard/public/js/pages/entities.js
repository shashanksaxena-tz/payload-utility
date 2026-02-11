import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail } from '../components.js';

const ENTITY_FIELDS = [
  { name: 'legal_name', label: 'Legal Name', required: true },
  { name: 'dba_name', label: 'DBA Name' },
  { name: 'entity_type', label: 'Type', type: 'select', options: [
    { value: 'llc', label: 'LLC' },
    { value: 'corporation', label: 'Corporation' },
    { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
    { value: 'partnership', label: 'Partnership' },
  ]},
  { name: 'ein', label: 'EIN' },
  { name: 'phone', label: 'Phone' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'website', label: 'Website' },
];

const STAKEHOLDER_FIELDS = [
  { name: 'entity_id', label: 'Entity ID', required: true },
  { name: 'first_name', label: 'First Name', required: true },
  { name: 'last_name', label: 'Last Name', required: true },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'title', label: 'Title' },
  { name: 'ownership_percentage', label: 'Ownership %', type: 'number' },
];

const PROC_ACCT_FIELDS = [
  { name: 'entity_id', label: 'Entity ID', required: true },
  { name: 'account_name', label: 'Account Name', required: true },
  { name: 'processing_type', label: 'Processing Type', type: 'select', options: [
    { value: 'card', label: 'Card' },
    { value: 'ach', label: 'ACH' },
  ]},
];

const AGREEMENT_FIELDS = [
  { name: 'processing_account_id', label: 'Processing Account ID', required: true },
  { name: 'agreement_type', label: 'Agreement Type', default: 'standard' },
  { name: 'effective_date', label: 'Effective Date', type: 'date', required: true },
];

const PROFILE_FIELDS = [
  { name: 'entity_id', label: 'Entity ID', required: true },
  { name: 'business_category', label: 'Business Category' },
  { name: 'mcc', label: 'MCC Code' },
  { name: 'average_transaction_amount', label: 'Avg Transaction', type: 'number' },
  { name: 'monthly_volume', label: 'Monthly Volume', type: 'number' },
];

export async function entitiesPage(el) {
  let activeTab = 'entities';

  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Entities & Business Onboarding</h2>
          <div class="btn-group">
            <button class="btn btn-primary" id="btn-new-entity">+ Entity</button>
            <button class="btn btn-outline" id="btn-new-stakeholder">+ Stakeholder</button>
            <button class="btn btn-outline" id="btn-new-proc">+ Processing Acct</button>
            <button class="btn btn-outline" id="btn-new-agreement">+ Agreement</button>
            <button class="btn btn-outline" id="btn-new-profile">+ Profile</button>
          </div>
        </div>
        <div class="tabs">
          <button class="tab ${activeTab === 'entities' ? 'active' : ''}" data-tab="entities">Entities</button>
          <button class="tab ${activeTab === 'stakeholders' ? 'active' : ''}" data-tab="stakeholders">Stakeholders</button>
          <button class="tab ${activeTab === 'processing' ? 'active' : ''}" data-tab="processing">Processing</button>
          <button class="tab ${activeTab === 'profiles' ? 'active' : ''}" data-tab="profiles">Profiles</button>
        </div>
        <div id="table-area"></div>
      </div>`;
  }

  async function loadTab() {
    const area = document.getElementById('table-area');
    area.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
    try {
      if (activeTab === 'entities') {
        const items = await api.list('entities', { limit: 100 });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'legal_name', label: 'Legal Name' },
            { key: 'dba_name', label: 'DBA' },
            { key: 'entity_type', label: 'Type' },
            { key: 'status', label: 'Status' },
          ],
          items,
          [
            { name: 'view', label: 'View', cls: 'btn-outline' },
            { name: 'delete', label: 'Delete', cls: 'btn-danger btn-sm' },
          ]
        );
      } else if (activeTab === 'stakeholders') {
        const items = await api.list('stakeholders', { limit: 100 });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'entity_id', label: 'Entity' },
            { key: 'first_name', label: 'First' },
            { key: 'last_name', label: 'Last' },
            { key: 'title', label: 'Title' },
            { key: 'ownership_percentage', label: 'Ownership %' },
          ],
          items,
          [{ name: 'view', label: 'View', cls: 'btn-outline' }]
        );
      } else if (activeTab === 'processing') {
        const accts = await api.list('processing-accounts', { limit: 100 });
        const agreements = await api.list('processing-agreements', { limit: 100 });
        area.innerHTML = '<h3 style="margin-bottom:12px">Processing Accounts</h3>' +
          dataTable(
            [
              { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
              { key: 'entity_id', label: 'Entity' },
              { key: 'account_name', label: 'Name' },
              { key: 'processing_type', label: 'Type' },
              { key: 'status', label: 'Status' },
            ],
            accts, [{ name: 'view', label: 'View', cls: 'btn-outline' }]
          ) +
          '<h3 style="margin:20px 0 12px">Processing Agreements</h3>' +
          dataTable(
            [
              { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
              { key: 'processing_account_id', label: 'Processing Acct' },
              { key: 'agreement_type', label: 'Type' },
              { key: 'effective_date', label: 'Effective' },
              { key: 'status', label: 'Status' },
            ],
            agreements, [{ name: 'view', label: 'View', cls: 'btn-outline' }]
          );
      } else {
        const items = await api.list('profiles', { limit: 100 });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'entity_id', label: 'Entity' },
            { key: 'business_category', label: 'Category' },
            { key: 'mcc', label: 'MCC' },
            { key: 'monthly_volume', label: 'Monthly Volume' },
          ],
          items, [{ name: 'view', label: 'View', cls: 'btn-outline' }]
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
        const rMap = { entities:'entities', stakeholders:'stakeholders', processing:'processing-accounts', profiles:'profiles' };
        const item = await api.get(rMap[activeTab] || 'entities', id);
        openModal('Details', kvDetail(item));
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
    if (action === 'delete') {
      if (!confirm('Delete?')) return;
      try {
        await api.del('entities', id);
        toast('Deleted', 'success');
        await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
  });

  function createModal(title, fields, resource) {
    openModal(title, buildForm(fields) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create(resource, readForm(fields));
        toast('Created', 'success');
        closeModal(); render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  }

  document.getElementById('btn-new-entity').onclick = () => createModal('New Entity', ENTITY_FIELDS, 'entities');
  document.getElementById('btn-new-stakeholder').onclick = () => createModal('New Stakeholder', STAKEHOLDER_FIELDS, 'stakeholders');
  document.getElementById('btn-new-proc').onclick = () => {
    openModal('New Processing Account', buildForm(PROC_ACCT_FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('processing-accounts', readForm(PROC_ACCT_FIELDS));
        toast('Processing account created', 'success');
        closeModal(); activeTab = 'processing'; render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
  document.getElementById('btn-new-agreement').onclick = () => {
    openModal('New Processing Agreement', buildForm(AGREEMENT_FIELDS) +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('processing-agreements', readForm(AGREEMENT_FIELDS));
        toast('Agreement created', 'success');
        closeModal(); activeTab = 'processing'; render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
  document.getElementById('btn-new-profile').onclick = () => {
    activeTab = 'profiles'; render(); loadTab();
    createModal('New Profile', PROFILE_FIELDS, 'profiles');
  };
}
