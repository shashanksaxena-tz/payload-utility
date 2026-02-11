import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail, badge } from '../components.js';

export async function accountsPage(el) {
  let activeTab = 'accounts';

  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Accounts & Access Tokens</h2>
          <div class="btn-group">
            <button class="btn btn-primary" id="btn-new-token">+ New Client Token</button>
            <button class="btn btn-outline" id="btn-new-org">+ New Org</button>
          </div>
        </div>
        <div class="tabs">
          <button class="tab ${activeTab === 'accounts' ? 'active' : ''}" data-tab="accounts">Accounts</button>
          <button class="tab ${activeTab === 'tokens' ? 'active' : ''}" data-tab="tokens">Client Tokens</button>
          <button class="tab ${activeTab === 'orgs' ? 'active' : ''}" data-tab="orgs">Organizations</button>
        </div>
        <div id="table-area"></div>
      </div>`;
  }

  async function loadTab() {
    const area = document.getElementById('table-area');
    area.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
    try {
      if (activeTab === 'accounts') {
        const items = await api.list('accounts', { limit: 100 });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'status', label: 'Status' },
            { key: 'created_at', label: 'Created' },
          ],
          items,
          [{ name: 'view', label: 'View', cls: 'btn-outline' }]
        );
      } else if (activeTab === 'tokens') {
        const items = await api.list('client-tokens', { limit: 100 });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'type', label: 'Type' },
            { key: 'token', label: 'Token', render: v => v ? `<code style="font-size:11px">${String(v).slice(0,16)}...</code>` : '-' },
            { key: 'expires_at', label: 'Expires' },
            { key: 'created_at', label: 'Created' },
          ],
          items,
          [
            { name: 'view', label: 'View', cls: 'btn-outline' },
            { name: 'delete', label: 'Delete', cls: 'btn-danger btn-sm' },
          ]
        );
      } else {
        const items = await api.list('orgs', { limit: 100 });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${v}</code>` },
            { key: 'name', label: 'Name' },
            { key: 'status', label: 'Status' },
            { key: 'created_at', label: 'Created' },
          ],
          items,
          [
            { name: 'view', label: 'View', cls: 'btn-outline' },
            { name: 'delete', label: 'Delete', cls: 'btn-danger btn-sm' },
          ]
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
        const rMap = { accounts: 'accounts', tokens: 'client-tokens', orgs: 'orgs' };
        const item = await api.get(rMap[activeTab], id);
        openModal('Details', kvDetail(item));
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
    if (action === 'delete') {
      if (!confirm('Delete?')) return;
      try {
        const rMap = { tokens: 'client-tokens', orgs: 'orgs' };
        await api.del(rMap[activeTab], id);
        toast('Deleted', 'success');
        await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
  });

  document.getElementById('btn-new-token').onclick = () => {
    openModal('New Client Token', buildForm([
      { name: 'type', label: 'Token Type', default: 'client' },
    ]) + `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create Token</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        const item = await api.create('client-tokens', readForm([{ name: 'type' }]));
        toast('Client token created', 'success');
        closeModal();
        activeTab = 'tokens'; render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };

  document.getElementById('btn-new-org').onclick = () => {
    openModal('New Organization', buildForm([
      { name: 'name', label: 'Organization Name', required: true },
    ]) + `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create Org</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      try {
        await api.create('orgs', readForm([{ name: 'name' }]));
        toast('Organization created', 'success');
        closeModal();
        activeTab = 'orgs'; render(); await loadTab();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
}
