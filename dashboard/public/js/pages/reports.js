import { api } from '../api.js';
import { toast, dataTable, buildForm, readForm, money, badge } from '../components.js';

/* ================================================================== */
/*  Reports Page                                                       */
/*  - Transaction Summary                                              */
/*  - Revenue Report                                                   */
/*  - Invoice Aging                                                    */
/*  - Payment Method Analytics                                         */
/*  - Export to CSV                                                    */
/* ================================================================== */

function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`Downloaded ${filename}`, 'success');
}

function arrayToCSV(headers, rows) {
  const escape = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  let csv = headers.map(escape).join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(escape).join(',') + '\n';
  });
  return csv;
}

function formatDate(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return d; }
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

export async function reportsPage(el) {
  let activeTab = 'transaction-summary';

  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Reports</h2>
        </div>
        <div class="tabs" style="flex-wrap:wrap">
          <button class="tab ${activeTab === 'transaction-summary' ? 'active' : ''}" data-tab="transaction-summary">Transaction Summary</button>
          <button class="tab ${activeTab === 'revenue' ? 'active' : ''}" data-tab="revenue">Revenue</button>
          <button class="tab ${activeTab === 'invoice-aging' ? 'active' : ''}" data-tab="invoice-aging">Invoice Aging</button>
          <button class="tab ${activeTab === 'payment-methods' ? 'active' : ''}" data-tab="payment-methods">Payment Methods</button>
        </div>
        <div id="report-content"></div>
      </div>`;
  }

  async function loadContent() {
    const area = document.getElementById('report-content');
    area.innerHTML = '<div class="empty-state"><p>Loading report...</p></div>';

    if (activeTab === 'transaction-summary') {
      await renderTransactionSummary(area);
    } else if (activeTab === 'revenue') {
      await renderRevenueReport(area);
    } else if (activeTab === 'invoice-aging') {
      await renderInvoiceAging(area);
    } else if (activeTab === 'payment-methods') {
      await renderPaymentMethodAnalytics(area);
    }
  }

  /* ---- Transaction Summary ---- */
  async function renderTransactionSummary(area) {
    try {
      const [payments, refunds, credits, deposits] = await Promise.all([
        api.list('payments', { limit: 100 }).catch(() => []),
        api.list('refunds', { limit: 100 }).catch(() => []),
        api.list('credits', { limit: 100 }).catch(() => []),
        api.list('deposits', { limit: 100 }).catch(() => []),
      ]);

      const allTxns = [
        ...payments.map(t => ({ ...t, _type: 'payment' })),
        ...refunds.map(t => ({ ...t, _type: 'refund' })),
        ...credits.map(t => ({ ...t, _type: 'credit' })),
        ...deposits.map(t => ({ ...t, _type: 'deposit' })),
      ];

      // Aggregate by status
      const byStatus = {};
      allTxns.forEach(t => {
        const s = t.status || 'unknown';
        if (!byStatus[s]) byStatus[s] = { count: 0, total: 0 };
        byStatus[s].count++;
        byStatus[s].total += Number(t.amount) || 0;
      });

      // Aggregate by type
      const byType = {};
      allTxns.forEach(t => {
        if (!byType[t._type]) byType[t._type] = { count: 0, total: 0 };
        byType[t._type].count++;
        byType[t._type].total += Number(t.amount) || 0;
      });

      const totalAmount = allTxns.reduce((s, t) => s + (Number(t.amount) || 0), 0);

      area.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Transactions</div>
            <div class="stat-value">${allTxns.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Volume</div>
            <div class="stat-value">${money(totalAmount)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Payments</div>
            <div class="stat-value">${payments.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Refunds</div>
            <div class="stat-value">${refunds.length}</div>
          </div>
        </div>

        <div class="report-section" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div class="card" style="margin-bottom:0">
            <h3 style="margin-bottom:12px">By Type</h3>
            ${dataTable(
              [
                { key: 'type', label: 'Type', render: v => badge(v) },
                { key: 'count', label: 'Count' },
                { key: 'total', label: 'Total Amount', render: v => money(v) },
                { key: 'avg', label: 'Average', render: v => money(v) },
              ],
              Object.entries(byType).map(([type, d]) => ({
                type,
                count: d.count,
                total: d.total,
                avg: d.count > 0 ? d.total / d.count : 0,
              }))
            )}
          </div>
          <div class="card" style="margin-bottom:0">
            <h3 style="margin-bottom:12px">By Status</h3>
            ${dataTable(
              [
                { key: 'status', label: 'Status' },
                { key: 'count', label: 'Count' },
                { key: 'total', label: 'Total Amount', render: v => money(v) },
              ],
              Object.entries(byStatus).map(([status, d]) => ({
                status,
                count: d.count,
                total: d.total,
              }))
            )}
          </div>
        </div>

        <div style="margin-top:20px">
          <button class="btn btn-outline" id="btn-export-txn-summary">Export as CSV</button>
        </div>`;

      document.getElementById('btn-export-txn-summary').onclick = () => {
        const headers = ['ID', 'Type', 'Amount', 'Status', 'Description', 'Created'];
        const rows = allTxns.map(t => [
          t.id, t._type, t.amount, t.status, t.description || '', t.created_at || '',
        ]);
        downloadCSV('transaction_summary.csv', arrayToCSV(headers, rows));
      };
    } catch (e) {
      area.innerHTML = `<p style="color:var(--c-danger)">Failed to load transaction summary: ${e.error || e.message}</p>`;
    }
  }

  /* ---- Revenue Report ---- */
  async function renderRevenueReport(area) {
    try {
      const payments = await api.list('payments', { limit: 100 }).catch(() => []);
      const refunds = await api.list('refunds', { limit: 100 }).catch(() => []);

      const processedPayments = payments.filter(p => (p.status || '').toLowerCase() === 'processed');
      const processedRefunds = refunds.filter(r => (r.status || '').toLowerCase() === 'processed');

      const grossRevenue = processedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalRefunds = processedRefunds.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const netRevenue = grossRevenue - totalRefunds;
      const avgPayment = processedPayments.length > 0 ? grossRevenue / processedPayments.length : 0;
      const refundRate = payments.length > 0 ? ((refunds.length / payments.length) * 100).toFixed(1) : '0';

      area.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Gross Revenue</div>
            <div class="stat-value" style="color:var(--c-success)">${money(grossRevenue)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Refunds</div>
            <div class="stat-value" style="color:var(--c-danger)">${money(totalRefunds)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Net Revenue</div>
            <div class="stat-value">${money(netRevenue)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Avg Payment</div>
            <div class="stat-value">${money(avgPayment)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Processed Payments</div>
            <div class="stat-value">${processedPayments.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Refund Rate</div>
            <div class="stat-value">${refundRate}%</div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-bottom:12px">Recent Processed Payments</h3>
          ${dataTable(
            [
              { key: 'id', label: 'ID', render: v => '<code>' + v + '</code>' },
              { key: 'amount', label: 'Amount', render: v => money(v) },
              { key: 'status', label: 'Status' },
              { key: 'description', label: 'Description' },
              { key: 'created_at', label: 'Date', render: v => formatDate(v) },
            ],
            processedPayments.slice(0, 10)
          )}
        </div>

        <div style="margin-top:20px">
          <button class="btn btn-outline" id="btn-export-revenue">Export Revenue Report CSV</button>
        </div>`;

      document.getElementById('btn-export-revenue').onclick = () => {
        const headers = ['Metric', 'Value'];
        const rows = [
          ['Gross Revenue', grossRevenue],
          ['Total Refunds', totalRefunds],
          ['Net Revenue', netRevenue],
          ['Average Payment', avgPayment.toFixed(2)],
          ['Total Payments', processedPayments.length],
          ['Total Refunds Count', processedRefunds.length],
          ['Refund Rate', refundRate + '%'],
        ];
        downloadCSV('revenue_report.csv', arrayToCSV(headers, rows));
      };
    } catch (e) {
      area.innerHTML = `<p style="color:var(--c-danger)">Failed to load revenue report: ${e.error || e.message}</p>`;
    }
  }

  /* ---- Invoice Aging ---- */
  async function renderInvoiceAging(area) {
    try {
      const invoices = await api.list('invoices', { limit: 100 }).catch(() => []);
      const now = new Date();

      const buckets = {
        current: { label: 'Current (not due)', invoices: [] },
        '1-30': { label: '1-30 Days Overdue', invoices: [] },
        '31-60': { label: '31-60 Days Overdue', invoices: [] },
        '61-90': { label: '61-90 Days Overdue', invoices: [] },
        '90+': { label: '90+ Days Overdue', invoices: [] },
        paid: { label: 'Paid', invoices: [] },
        void: { label: 'Voided', invoices: [] },
      };

      invoices.forEach(inv => {
        const status = (inv.status || '').toLowerCase();
        if (status === 'paid') {
          buckets.paid.invoices.push(inv);
        } else if (status === 'void' || status === 'voided') {
          buckets.void.invoices.push(inv);
        } else if (inv.due_date) {
          const daysOverdue = daysBetween(inv.due_date, now.toISOString());
          if (daysOverdue <= 0) buckets.current.invoices.push(inv);
          else if (daysOverdue <= 30) buckets['1-30'].invoices.push(inv);
          else if (daysOverdue <= 60) buckets['31-60'].invoices.push(inv);
          else if (daysOverdue <= 90) buckets['61-90'].invoices.push(inv);
          else buckets['90+'].invoices.push(inv);
        } else {
          buckets.current.invoices.push(inv);
        }
      });

      const totalOutstanding = invoices
        .filter(i => !['paid', 'void', 'voided'].includes((i.status || '').toLowerCase()))
        .reduce((s, i) => s + (Number(i.amount_due || i.total_amount) || 0), 0);

      const totalOverdue = [...buckets['1-30'].invoices, ...buckets['31-60'].invoices,
        ...buckets['61-90'].invoices, ...buckets['90+'].invoices]
        .reduce((s, i) => s + (Number(i.amount_due || i.total_amount) || 0), 0);

      area.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Invoices</div>
            <div class="stat-value">${invoices.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Outstanding Amount</div>
            <div class="stat-value">${money(totalOutstanding)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Overdue Amount</div>
            <div class="stat-value" style="color:var(--c-danger)">${money(totalOverdue)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Paid Count</div>
            <div class="stat-value" style="color:var(--c-success)">${buckets.paid.invoices.length}</div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-bottom:12px">Aging Summary</h3>
          ${dataTable(
            [
              { key: 'bucket', label: 'Aging Bucket' },
              { key: 'count', label: 'Count' },
              { key: 'total', label: 'Total Amount', render: v => money(v) },
            ],
            Object.entries(buckets)
              .filter(([key]) => !['paid', 'void'].includes(key))
              .map(([, b]) => ({
                bucket: b.label,
                count: b.invoices.length,
                total: b.invoices.reduce((s, i) => s + (Number(i.amount_due || i.total_amount) || 0), 0),
              }))
          )}
        </div>

        <div class="card">
          <h3 style="margin-bottom:12px">Overdue Invoices</h3>
          ${dataTable(
            [
              { key: 'id', label: 'ID', render: v => '<code>' + v + '</code>' },
              { key: 'number', label: 'Number' },
              { key: 'customer_id', label: 'Customer' },
              { key: 'total_amount', label: 'Total', render: v => money(v) },
              { key: 'amount_due', label: 'Due', render: v => money(v) },
              { key: 'due_date', label: 'Due Date', render: v => formatDate(v) },
              { key: 'days_overdue', label: 'Days Overdue', render: v =>
                '<span style="color:var(--c-danger);font-weight:600">' + v + '</span>' },
              { key: 'status', label: 'Status' },
            ],
            [...buckets['1-30'].invoices, ...buckets['31-60'].invoices,
              ...buckets['61-90'].invoices, ...buckets['90+'].invoices]
              .map(i => ({
                ...i,
                days_overdue: daysBetween(i.due_date, now.toISOString()),
              }))
              .sort((a, b) => b.days_overdue - a.days_overdue)
          )}
        </div>

        <div style="margin-top:20px">
          <button class="btn btn-outline" id="btn-export-aging">Export Aging Report CSV</button>
        </div>`;

      document.getElementById('btn-export-aging').onclick = () => {
        const headers = ['ID', 'Number', 'Customer', 'Total Amount', 'Amount Due', 'Due Date', 'Status', 'Days Overdue'];
        const rows = invoices.map(i => {
          const daysOverdue = i.due_date ? Math.max(0, daysBetween(i.due_date, now.toISOString())) : 0;
          return [i.id, i.number || '', i.customer_id || '', i.total_amount || '', i.amount_due || '', i.due_date || '', i.status || '', daysOverdue];
        });
        downloadCSV('invoice_aging.csv', arrayToCSV(headers, rows));
      };
    } catch (e) {
      area.innerHTML = `<p style="color:var(--c-danger)">Failed to load invoice aging: ${e.error || e.message}</p>`;
    }
  }

  /* ---- Payment Method Analytics ---- */
  async function renderPaymentMethodAnalytics(area) {
    try {
      const [cards, bankAccounts] = await Promise.all([
        api.list('cards', { limit: 100 }).catch(() => []),
        api.list('bank-accounts', { limit: 100 }).catch(() => []),
      ]);

      const totalMethods = cards.length + bankAccounts.length;

      // Card brand breakdown
      const byBrand = {};
      cards.forEach(c => {
        const brand = c.brand || 'unknown';
        if (!byBrand[brand]) byBrand[brand] = 0;
        byBrand[brand]++;
      });

      // Bank account type breakdown
      const byAcctType = {};
      bankAccounts.forEach(b => {
        const t = b.account_type || 'unknown';
        if (!byAcctType[t]) byAcctType[t] = 0;
        byAcctType[t]++;
      });

      area.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Payment Methods</div>
            <div class="stat-value">${totalMethods}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Cards</div>
            <div class="stat-value">${cards.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Bank Accounts</div>
            <div class="stat-value">${bankAccounts.length}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div class="card" style="margin-bottom:0">
            <h3 style="margin-bottom:12px">Cards by Brand</h3>
            ${Object.keys(byBrand).length > 0 ? dataTable(
              [
                { key: 'brand', label: 'Card Brand' },
                { key: 'count', label: 'Count' },
                { key: 'pct', label: 'Percentage' },
              ],
              Object.entries(byBrand).map(([brand, count]) => ({
                brand: brand.charAt(0).toUpperCase() + brand.slice(1),
                count,
                pct: cards.length > 0 ? ((count / cards.length) * 100).toFixed(1) + '%' : '0%',
              })).sort((a, b) => b.count - a.count)
            ) : '<p style="color:var(--c-text-secondary)">No cards found</p>'}
          </div>
          <div class="card" style="margin-bottom:0">
            <h3 style="margin-bottom:12px">Bank Accounts by Type</h3>
            ${Object.keys(byAcctType).length > 0 ? dataTable(
              [
                { key: 'type', label: 'Account Type' },
                { key: 'count', label: 'Count' },
                { key: 'pct', label: 'Percentage' },
              ],
              Object.entries(byAcctType).map(([type, count]) => ({
                type: type.charAt(0).toUpperCase() + type.slice(1),
                count,
                pct: bankAccounts.length > 0 ? ((count / bankAccounts.length) * 100).toFixed(1) + '%' : '0%',
              })).sort((a, b) => b.count - a.count)
            ) : '<p style="color:var(--c-text-secondary)">No bank accounts found</p>'}
          </div>
        </div>

        <div style="margin-top:20px">
          <button class="btn btn-outline" id="btn-export-pm">Export Payment Methods CSV</button>
        </div>`;

      document.getElementById('btn-export-pm').onclick = () => {
        const headers = ['ID', 'Type', 'Brand/Account Type', 'Last Four', 'Status', 'Customer ID'];
        const rows = [
          ...cards.map(c => [c.id, 'card', c.brand || '', c.last_four || '', c.status || '', c.customer_id || '']),
          ...bankAccounts.map(b => [b.id, 'bank_account', b.account_type || '', '', b.status || '', b.customer_id || '']),
        ];
        downloadCSV('payment_methods.csv', arrayToCSV(headers, rows));
      };
    } catch (e) {
      area.innerHTML = `<p style="color:var(--c-danger)">Failed to load payment method analytics: ${e.error || e.message}</p>`;
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
    }
  });
}
