import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, openModal, closeModal, kvDetail, money, badge } from '../components.js';

function renderMetadata(val) {
  if (!val || (typeof val === 'object' && Object.keys(val).length === 0)) return '-';
  if (typeof val === 'string') {
    try { val = JSON.parse(val); } catch { return val; }
  }
  return Object.entries(val).map(([k, v]) =>
    `<span class="badge badge-neutral" style="margin-right:4px">${k}: ${v}</span>`
  ).join('');
}

function parseMetadataField(id) {
  const raw = (document.getElementById(id)?.value || '').trim();
  if (!raw) return undefined;
  try { return JSON.parse(raw); }
  catch {
    // Try key=value,key=value format
    const obj = {};
    raw.split(',').forEach(pair => {
      const [k, ...v] = pair.split('=');
      if (k && v.length) obj[k.trim()] = v.join('=').trim();
    });
    return Object.keys(obj).length ? obj : undefined;
  }
}

export async function ledgerPage(el) {
  let activeTab = 'entries';

  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Double-Entry Ledger</h2>
          <div class="btn-group">
            <button class="btn btn-primary" id="btn-balanced">+ Balanced Entry</button>
            <button class="btn btn-outline" id="btn-multileg">+ Multi-Leg Entry</button>
            <button class="btn btn-outline" id="btn-reversal">+ Reversal</button>
          </div>
        </div>
        <div class="tabs">
          <button class="tab ${activeTab === 'entries' ? 'active' : ''}" data-tab="entries">All Entries</button>
          <button class="tab ${activeTab === 'balance' ? 'active' : ''}" data-tab="balance">Account Balance</button>
          <button class="tab ${activeTab === 'reconcile' ? 'active' : ''}" data-tab="reconcile">Reconciliation</button>
          <button class="tab ${activeTab === 'activity' ? 'active' : ''}" data-tab="activity">Activity Summary</button>
          <button class="tab ${activeTab === 'validate' ? 'active' : ''}" data-tab="validate">Validate Transaction</button>
        </div>
        <div id="ledger-content"></div>
      </div>`;
  }

  async function loadContent() {
    const area = document.getElementById('ledger-content');
    area.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';

    if (activeTab === 'entries') {
      try {
        const items = await api.list('ledger-entries', { limit: 100, orderBy: '-created_at' });
        area.innerHTML = dataTable(
          [
            { key: 'id', label: 'ID', render: v => `<code>${(v||'').slice(0,12)}</code>` },
            { key: 'account_id', label: 'Account' },
            { key: 'entry_type', label: 'Type', render: v => v === 'debit'
              ? '<span class="badge badge-info">DEBIT</span>'
              : '<span class="badge badge-warning">CREDIT</span>' },
            { key: 'amount', label: 'Amount', render: v => money(v) },
            { key: 'description', label: 'Description' },
            { key: 'reference', label: 'Reference' },
            { key: 'metadata', label: 'Metadata', render: v => renderMetadata(v) },
            { key: 'created_at', label: 'Created' },
          ],
          items,
          [{ name: 'view', label: 'View', cls: 'btn-outline' }]
        );
      } catch (e) {
        area.innerHTML = `<p style="color:var(--c-danger)">${e.error || e.message}</p>`;
      }
    }

    if (activeTab === 'balance') {
      area.innerHTML = `
        <div style="max-width:400px;margin-bottom:20px">
          ${buildForm([{ name: 'acct_id', label: 'Account ID', required: true, placeholder: 'acct_revenue' }])}
          <div class="form-actions"><button class="btn btn-primary" id="btn-check-bal">Check Balance</button></div>
        </div>
        <div id="balance-result"></div>`;
      document.getElementById('btn-check-bal').onclick = async () => {
        const acctId = document.getElementById('f-acct_id').value.trim();
        if (!acctId) return toast('Enter an account ID', 'error');
        const res = document.getElementById('balance-result');
        try {
          const bal = await api.ledger.balance(acctId);
          res.innerHTML = `
            <div class="stats-grid">
              <div class="stat-card"><div class="stat-label">Total Debits</div><div class="stat-value">${money(bal.totalDebits)}</div></div>
              <div class="stat-card"><div class="stat-label">Total Credits</div><div class="stat-value">${money(bal.totalCredits)}</div></div>
              <div class="stat-card"><div class="stat-label">Net Balance</div><div class="stat-value">${money(bal.netBalance)}</div></div>
              <div class="stat-card"><div class="stat-label">Entry Count</div><div class="stat-value">${bal.entryCount}</div></div>
            </div>`;
        } catch (e) {
          res.innerHTML = `<p style="color:var(--c-danger)">${e.error || e.message}</p>`;
        }
      };
    }

    if (activeTab === 'reconcile') {
      area.innerHTML = `
        <div style="max-width:500px;margin-bottom:20px">
          ${buildForm([{ name: 'acct_ids', label: 'Account IDs (comma-separated)', required: true, placeholder: 'acct_revenue,acct_receivable,acct_fees', full: true }])}
          <div class="form-actions"><button class="btn btn-primary" id="btn-reconcile">Reconcile</button></div>
        </div>
        <div id="reconcile-result"></div>`;
      document.getElementById('btn-reconcile').onclick = async () => {
        const ids = document.getElementById('f-acct_ids').value.split(',').map(s => s.trim()).filter(Boolean);
        if (ids.length === 0) return toast('Enter at least one account ID', 'error');
        const res = document.getElementById('reconcile-result');
        try {
          const r = await api.ledger.reconcile(ids);
          res.innerHTML = `
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">System Balanced</div>
                <div class="stat-value" style="color:${r.balanced ? 'var(--c-success)' : 'var(--c-danger)'}">${r.balanced ? 'YES' : 'NO'}</div>
              </div>
              <div class="stat-card"><div class="stat-label">Total Debits</div><div class="stat-value">${money(r.totalDebits)}</div></div>
              <div class="stat-card"><div class="stat-label">Total Credits</div><div class="stat-value">${money(r.totalCredits)}</div></div>
              <div class="stat-card"><div class="stat-label">Difference</div><div class="stat-value">${money(r.difference)}</div></div>
            </div>
            ${r.imbalancedAccounts && r.imbalancedAccounts.length > 0
              ? `<p style="color:var(--c-danger);margin-top:12px">Imbalanced accounts: ${r.imbalancedAccounts.join(', ')}</p>`
              : ''}
            ${r.accountBalances ? '<h3 style="margin:16px 0 8px">Per-Account Balances</h3>' +
              dataTable(
                [
                  { key: 'accountId', label: 'Account' },
                  { key: 'totalDebits', label: 'Debits', render: v => money(v) },
                  { key: 'totalCredits', label: 'Credits', render: v => money(v) },
                  { key: 'netBalance', label: 'Net', render: v => money(v) },
                  { key: 'entryCount', label: 'Entries' },
                ],
                r.accountBalances
              ) : ''}`;
        } catch (e) {
          res.innerHTML = `<p style="color:var(--c-danger)">${e.error || e.message}</p>`;
        }
      };
    }

    if (activeTab === 'activity') {
      area.innerHTML = `
        <div style="max-width:500px;margin-bottom:20px">
          ${buildForm([
            { name: 'activity_acct', label: 'Account ID', required: true, placeholder: 'acct_revenue' },
            { name: 'start_date', label: 'Start Date', type: 'date' },
            { name: 'end_date', label: 'End Date', type: 'date' },
          ])}
          <div class="form-actions"><button class="btn btn-primary" id="btn-activity">Get Activity</button></div>
        </div>
        <div id="activity-result"></div>`;
      document.getElementById('btn-activity').onclick = async () => {
        const acctId = document.getElementById('f-activity_acct').value.trim();
        if (!acctId) return toast('Enter an account ID', 'error');
        const start = document.getElementById('f-start_date').value || undefined;
        const end = document.getElementById('f-end_date').value || undefined;
        const res = document.getElementById('activity-result');
        try {
          const a = await api.ledger.activity(acctId, start, end);
          res.innerHTML = `
            <div class="stats-grid">
              <div class="stat-card"><div class="stat-label">Total Debits</div><div class="stat-value">${money(a.totalDebits)}</div></div>
              <div class="stat-card"><div class="stat-label">Total Credits</div><div class="stat-value">${money(a.totalCredits)}</div></div>
              <div class="stat-card"><div class="stat-label">Net Change</div><div class="stat-value">${money(a.netChange)}</div></div>
            </div>
            <div class="ledger-panel">
              <div class="card">
                <h3 style="margin-bottom:8px">Debit Entries (${a.debits.length})</h3>
                ${a.debits.length ? dataTable(
                  [
                    { key: 'amount', label: 'Amount', render: v => money(v) },
                    { key: 'description', label: 'Description' },
                    { key: 'metadata', label: 'Metadata', render: v => renderMetadata(v) },
                    { key: 'createdAt', label: 'Date' },
                  ], a.debits
                ) : '<p style="color:var(--c-text-secondary)">None</p>'}
              </div>
              <div class="card">
                <h3 style="margin-bottom:8px">Credit Entries (${a.credits.length})</h3>
                ${a.credits.length ? dataTable(
                  [
                    { key: 'amount', label: 'Amount', render: v => money(v) },
                    { key: 'description', label: 'Description' },
                    { key: 'metadata', label: 'Metadata', render: v => renderMetadata(v) },
                    { key: 'createdAt', label: 'Date' },
                  ], a.credits
                ) : '<p style="color:var(--c-text-secondary)">None</p>'}
              </div>
            </div>`;
        } catch (e) {
          res.innerHTML = `<p style="color:var(--c-danger)">${e.error || e.message}</p>`;
        }
      };
    }

    if (activeTab === 'validate') {
      area.innerHTML = `
        <div style="max-width:400px;margin-bottom:20px">
          ${buildForm([{ name: 'txn_id', label: 'Transaction ID', required: true }])}
          <div class="form-actions">
            <button class="btn btn-outline" id="btn-txn-entries">View Entries</button>
            <button class="btn btn-primary" id="btn-txn-validate">Validate Balance</button>
          </div>
        </div>
        <div id="validate-result"></div>`;
      document.getElementById('btn-txn-validate').onclick = async () => {
        const txnId = document.getElementById('f-txn_id').value.trim();
        if (!txnId) return toast('Enter a transaction ID', 'error');
        try {
          const r = await api.ledger.txnValidate(txnId);
          document.getElementById('validate-result').innerHTML =
            `<p style="font-size:18px;font-weight:600;color:${r.balanced ? 'var(--c-success)' : 'var(--c-danger)'}">
              ${r.balanced ? 'Transaction is BALANCED' : 'Transaction is IMBALANCED'}</p>`;
        } catch (e) { toast(e.error || e.message, 'error'); }
      };
      document.getElementById('btn-txn-entries').onclick = async () => {
        const txnId = document.getElementById('f-txn_id').value.trim();
        if (!txnId) return toast('Enter a transaction ID', 'error');
        try {
          const entries = await api.ledger.txnEntries(txnId);
          document.getElementById('validate-result').innerHTML = dataTable(
            [
              { key: 'id', label: 'ID', render: v => `<code>${(v||'').slice(0,12)}</code>` },
              { key: 'account_id', label: 'Account' },
              { key: 'entry_type', label: 'Type' },
              { key: 'amount', label: 'Amount', render: v => money(v) },
              { key: 'description', label: 'Description' },
              { key: 'metadata', label: 'Metadata', render: v => renderMetadata(v) },
            ], entries
          );
        } catch (e) { toast(e.error || e.message, 'error'); }
      };
    }
  }

  render();
  await loadContent();

  el.addEventListener('click', async e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      activeTab = tab.dataset.tab;
      el.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
      await loadContent();
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (btn && btn.dataset.action === 'view') {
      try {
        const item = await api.get('ledger-entries', btn.dataset.id);
        openModal('Ledger Entry', kvDetail(item));
      } catch (e) { toast(e.error || e.message, 'error'); }
    }
  });

  /* ---- Balanced Entry modal ---- */
  document.getElementById('btn-balanced').onclick = () => {
    const fields = [
      { name: 'debit_account', label: 'Debit Account ID', required: true, placeholder: 'acct_revenue' },
      { name: 'credit_account', label: 'Credit Account ID', required: true, placeholder: 'acct_receivable' },
      { name: 'amount', label: 'Amount', type: 'number', required: true },
      { name: 'debit_desc', label: 'Debit Description' },
      { name: 'credit_desc', label: 'Credit Description' },
      { name: 'debit_ref', label: 'Debit Reference', placeholder: 'order_1234' },
      { name: 'credit_ref', label: 'Credit Reference', placeholder: 'inv_5678' },
    ];
    openModal('New Balanced Entry', buildForm(fields) +
      `<div class="form-group full" style="margin-top:12px">
        <label for="f-balanced-meta" style="font-size:12px;font-weight:600;color:var(--c-text-secondary);text-transform:uppercase;letter-spacing:.3px">METADATA (optional)</label>
        <input type="text" id="f-balanced-meta" placeholder='{"project":"alpha","cost_center":"eng"} or key=val,key=val'>
        <p style="font-size:11px;color:var(--c-text-secondary);margin-top:2px">JSON object or key=value pairs. Applied to both entries.</p>
      </div>` +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create Entry Pair</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      const d = readForm(fields);
      const meta = parseMetadataField('f-balanced-meta');
      try {
        await api.ledger.balancedEntry({
          debit:  { accountId: d.debit_account,  amount: d.amount, entryType: 'debit',  description: d.debit_desc  || '', reference: d.debit_ref || '', ...(meta ? { metadata: meta } : {}) },
          credit: { accountId: d.credit_account, amount: d.amount, entryType: 'credit', description: d.credit_desc || '', reference: d.credit_ref || '', ...(meta ? { metadata: meta } : {}) },
        });
        toast('Balanced entry created', 'success');
        closeModal(); activeTab = 'entries'; render(); await loadContent();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };

  /* ---- Multi-leg modal ---- */
  document.getElementById('btn-multileg').onclick = () => {
    openModal('Multi-Leg Entry', `
      <p style="margin-bottom:12px;color:var(--c-text-secondary)">Add 2+ entries. Total debits must equal total credits.</p>
      <div id="leg-list"></div>
      <button class="btn btn-outline btn-sm" id="btn-add-leg" style="margin:12px 0">+ Add Leg</button>
      <div class="form-group full" style="margin-top:8px">
        <label style="font-size:12px;font-weight:600;color:var(--c-text-secondary);text-transform:uppercase;letter-spacing:.3px">METADATA (optional, applied to all legs)</label>
        <input type="text" id="ml-metadata" placeholder='{"project":"beta"} or key=val,key=val'>
      </div>
      <div class="form-actions"><button class="btn btn-primary" id="btn-save-ml">Create Entries</button></div>
    `);
    let legCount = 0;
    function addLeg() {
      legCount++;
      const div = document.createElement('div');
      div.className = 'form-grid';
      div.style.marginBottom = '12px';
      div.style.paddingBottom = '12px';
      div.style.borderBottom = '1px solid var(--c-border)';
      div.innerHTML = `
        <div class="form-group"><label>Account ID</label><input id="leg-acct-${legCount}" placeholder="acct_xxx"></div>
        <div class="form-group"><label>Amount</label><input type="number" id="leg-amt-${legCount}" step="0.01"></div>
        <div class="form-group"><label>Type</label><select id="leg-type-${legCount}"><option value="debit">Debit</option><option value="credit">Credit</option></select></div>
        <div class="form-group"><label>Description</label><input id="leg-desc-${legCount}"></div>`;
      document.getElementById('leg-list').appendChild(div);
    }
    addLeg(); addLeg(); // start with 2
    document.getElementById('btn-add-leg').onclick = addLeg;
    document.getElementById('btn-save-ml').onclick = async () => {
      const meta = parseMetadataField('ml-metadata');
      const entries = [];
      for (let i = 1; i <= legCount; i++) {
        const acct = document.getElementById(`leg-acct-${i}`).value.trim();
        const amt = Number(document.getElementById(`leg-amt-${i}`).value);
        const type = document.getElementById(`leg-type-${i}`).value;
        const desc = document.getElementById(`leg-desc-${i}`).value;
        if (acct && amt) entries.push({ accountId: acct, amount: amt, entryType: type, description: desc, ...(meta ? { metadata: meta } : {}) });
      }
      try {
        await api.ledger.multiLegEntry(entries);
        toast('Multi-leg entry created', 'success');
        closeModal(); activeTab = 'entries'; render(); await loadContent();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };

  /* ---- Reversal modal ---- */
  document.getElementById('btn-reversal').onclick = () => {
    const fields = [
      { name: 'originalDebitAccountId', label: 'Original Debit Account', required: true },
      { name: 'originalCreditAccountId', label: 'Original Credit Account', required: true },
      { name: 'amount', label: 'Amount', type: 'number', required: true },
      { name: 'reason', label: 'Reason', required: true },
    ];
    openModal('Create Reversal', buildForm(fields) +
      `<div class="form-group full" style="margin-top:12px">
        <label for="f-rev-meta" style="font-size:12px;font-weight:600;color:var(--c-text-secondary);text-transform:uppercase;letter-spacing:.3px">METADATA (optional)</label>
        <input type="text" id="f-rev-meta" placeholder='{"ticket":"SUP-4321"} or key=val,key=val'>
      </div>` +
      `<div class="form-actions"><button class="btn btn-primary" id="btn-save">Create Reversal</button></div>`);
    document.getElementById('btn-save').onclick = async () => {
      const d = readForm(fields);
      const meta = parseMetadataField('f-rev-meta');
      try {
        await api.ledger.reversal({ ...d, ...(meta ? { metadata: meta } : {}) });
        toast('Reversal created', 'success');
        closeModal(); activeTab = 'entries'; render(); await loadContent();
      } catch (e) { toast(e.error || e.message, 'error'); }
    };
  };
}
