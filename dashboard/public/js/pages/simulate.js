import { api } from '../api.js';
import { toast, money, badge, kvDetail, openModal } from '../components.js';

/* ================================================================== */
/*  Payment Simulation Page                                            */
/*  - End-to-end payment flow simulation                               */
/*  - Payment link demo                                                */
/*  - Step-by-step walkthrough                                         */
/* ================================================================== */

export async function simulatePage(el) {
  let activeTab = 'payment-flow';

  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Payment Simulation</h2>
        </div>
        <div class="tabs">
          <button class="tab ${activeTab === 'payment-flow' ? 'active' : ''}" data-tab="payment-flow">Payment Flow</button>
          <button class="tab ${activeTab === 'payment-link' ? 'active' : ''}" data-tab="payment-link">Payment Link Demo</button>
        </div>
        <div id="sim-content"></div>
      </div>`;
  }

  function loadContent() {
    const area = document.getElementById('sim-content');
    if (activeTab === 'payment-flow') {
      renderPaymentFlow(area);
    } else {
      renderPaymentLinkDemo(area);
    }
  }

  /* ---- End-to-End Payment Flow ---- */
  function renderPaymentFlow(area) {
    area.innerHTML = `
      <div style="max-width:700px">
        <p style="color:var(--c-text-secondary);margin-bottom:20px">
          This simulation walks through a complete payment lifecycle: creating a customer, adding a payment method,
          processing a payment, and optionally issuing a refund. Each step calls the real Payload API through the SDK.
        </p>

        <div class="sim-steps" id="sim-steps">
          <div class="sim-step" id="step-1">
            <div class="sim-step-header">
              <span class="sim-step-num">1</span>
              <span class="sim-step-title">Create Customer</span>
              <span class="sim-step-status" id="step-1-status"></span>
            </div>
            <div class="sim-step-body">
              <div class="form-grid">
                <div class="form-group">
                  <label for="sim-name">Customer Name</label>
                  <input type="text" id="sim-name" value="Test Customer" placeholder="Jane Doe">
                </div>
                <div class="form-group">
                  <label for="sim-email">Email</label>
                  <input type="email" id="sim-email" value="test@example.com" placeholder="jane@example.com">
                </div>
              </div>
              <button class="btn btn-primary" id="btn-step-1" style="margin-top:12px">Create Customer</button>
              <div id="step-1-result" style="margin-top:12px"></div>
            </div>
          </div>

          <div class="sim-step disabled" id="step-2">
            <div class="sim-step-header">
              <span class="sim-step-num">2</span>
              <span class="sim-step-title">Add Payment Method (Card)</span>
              <span class="sim-step-status" id="step-2-status"></span>
            </div>
            <div class="sim-step-body">
              <div class="form-grid">
                <div class="form-group">
                  <label for="sim-card">Card Number</label>
                  <input type="text" id="sim-card" value="4242424242424242" placeholder="4242424242424242">
                </div>
                <div class="form-group">
                  <label for="sim-expiry">Expiry</label>
                  <input type="text" id="sim-expiry" value="12/2028" placeholder="MM/YYYY">
                </div>
                <div class="form-group">
                  <label for="sim-cvv">CVV</label>
                  <input type="text" id="sim-cvv" value="123" placeholder="123">
                </div>
              </div>
              <button class="btn btn-primary" id="btn-step-2" style="margin-top:12px" disabled>Add Card</button>
              <div id="step-2-result" style="margin-top:12px"></div>
            </div>
          </div>

          <div class="sim-step disabled" id="step-3">
            <div class="sim-step-header">
              <span class="sim-step-num">3</span>
              <span class="sim-step-title">Process Payment</span>
              <span class="sim-step-status" id="step-3-status"></span>
            </div>
            <div class="sim-step-body">
              <div class="form-grid">
                <div class="form-group">
                  <label for="sim-amount">Amount ($)</label>
                  <input type="number" id="sim-amount" value="25.00" step="0.01" min="0.01">
                </div>
                <div class="form-group">
                  <label for="sim-desc">Description</label>
                  <input type="text" id="sim-desc" value="Simulation test payment" placeholder="Order #1234">
                </div>
              </div>
              <button class="btn btn-primary" id="btn-step-3" style="margin-top:12px" disabled>Process Payment</button>
              <div id="step-3-result" style="margin-top:12px"></div>
            </div>
          </div>

          <div class="sim-step disabled" id="step-4">
            <div class="sim-step-header">
              <span class="sim-step-num">4</span>
              <span class="sim-step-title">Issue Refund (Optional)</span>
              <span class="sim-step-status" id="step-4-status"></span>
            </div>
            <div class="sim-step-body">
              <div class="form-grid">
                <div class="form-group">
                  <label for="sim-refund-amount">Refund Amount ($)</label>
                  <input type="number" id="sim-refund-amount" value="5.00" step="0.01" min="0.01">
                </div>
              </div>
              <button class="btn btn-outline" id="btn-step-4" style="margin-top:12px" disabled>Issue Partial Refund</button>
              <div id="step-4-result" style="margin-top:12px"></div>
            </div>
          </div>
        </div>

        <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--c-border)">
          <button class="btn btn-outline" id="btn-reset-sim">Reset Simulation</button>
        </div>
      </div>`;

    let customerId = null;
    let cardId = null;
    let paymentId = null;

    function setStatus(step, status, text) {
      const el = document.getElementById(`step-${step}-status`);
      const colors = { pending: 'var(--c-text-secondary)', loading: 'var(--c-primary)', success: 'var(--c-success)', error: 'var(--c-danger)' };
      el.textContent = text;
      el.style.color = colors[status] || '';
    }

    function enableStep(step) {
      document.getElementById(`step-${step}`).classList.remove('disabled');
      document.getElementById(`btn-step-${step}`).disabled = false;
    }

    function showResult(step, html) {
      document.getElementById(`step-${step}-result`).innerHTML = html;
    }

    // Step 1: Create Customer
    document.getElementById('btn-step-1').onclick = async () => {
      setStatus(1, 'loading', 'Creating...');
      try {
        const name = document.getElementById('sim-name').value.trim() || 'Test Customer';
        const email = document.getElementById('sim-email').value.trim() || 'test@example.com';
        const result = await api.create('customers', { name, email });
        customerId = result.id;
        setStatus(1, 'success', 'Created');
        showResult(1, `<div class="kv-list" style="font-size:12px">
          <div class="kv-key">Customer ID</div><div class="kv-val"><code>${result.id}</code></div>
          <div class="kv-key">Name</div><div class="kv-val">${result.name || name}</div>
        </div>`);
        enableStep(2);
      } catch (e) {
        setStatus(1, 'error', 'Failed');
        showResult(1, `<p style="color:var(--c-danger);font-size:13px">${e.error || e.message}</p>`);
      }
    };

    // Step 2: Add Card
    document.getElementById('btn-step-2').onclick = async () => {
      setStatus(2, 'loading', 'Adding card...');
      try {
        const result = await api.create('cards', {
          card_number: document.getElementById('sim-card').value.trim(),
          expiry: document.getElementById('sim-expiry').value.trim(),
          card_code: document.getElementById('sim-cvv').value.trim(),
          customer_id: customerId,
        });
        cardId = result.id;
        setStatus(2, 'success', 'Added');
        showResult(2, `<div class="kv-list" style="font-size:12px">
          <div class="kv-key">Card ID</div><div class="kv-val"><code>${result.id}</code></div>
          <div class="kv-key">Brand</div><div class="kv-val">${result.brand || 'N/A'}</div>
          <div class="kv-key">Last 4</div><div class="kv-val">${result.last_four || (result.card_number ? result.card_number.slice(-4) : 'N/A')}</div>
        </div>`);
        enableStep(3);
      } catch (e) {
        setStatus(2, 'error', 'Failed');
        showResult(2, `<p style="color:var(--c-danger);font-size:13px">${e.error || e.message}</p>`);
      }
    };

    // Step 3: Process Payment
    document.getElementById('btn-step-3').onclick = async () => {
      setStatus(3, 'loading', 'Processing...');
      try {
        const amount = Number(document.getElementById('sim-amount').value) || 25;
        const description = document.getElementById('sim-desc').value.trim() || 'Simulation payment';
        const result = await api.create('payments', {
          amount,
          customer_id: customerId,
          payment_method_id: cardId,
          description,
        });
        paymentId = result.id;
        setStatus(3, 'success', 'Processed');
        showResult(3, `<div class="kv-list" style="font-size:12px">
          <div class="kv-key">Payment ID</div><div class="kv-val"><code>${result.id}</code></div>
          <div class="kv-key">Amount</div><div class="kv-val">${money(result.amount || amount)}</div>
          <div class="kv-key">Status</div><div class="kv-val">${badge(result.status || 'processed')}</div>
        </div>`);
        enableStep(4);
        // Pre-fill refund with half the amount
        document.getElementById('sim-refund-amount').value = (amount / 2).toFixed(2);
      } catch (e) {
        setStatus(3, 'error', 'Failed');
        showResult(3, `<p style="color:var(--c-danger);font-size:13px">${e.error || e.message}</p>`);
      }
    };

    // Step 4: Refund
    document.getElementById('btn-step-4').onclick = async () => {
      setStatus(4, 'loading', 'Refunding...');
      try {
        const refundAmount = Number(document.getElementById('sim-refund-amount').value) || 5;
        const result = await api.create('refunds', {
          amount: refundAmount,
          linked_transaction_id: paymentId,
          description: 'Simulation partial refund',
        });
        setStatus(4, 'success', 'Refunded');
        showResult(4, `<div class="kv-list" style="font-size:12px">
          <div class="kv-key">Refund ID</div><div class="kv-val"><code>${result.id}</code></div>
          <div class="kv-key">Amount</div><div class="kv-val">${money(result.amount || refundAmount)}</div>
          <div class="kv-key">Status</div><div class="kv-val">${badge(result.status || 'processed')}</div>
        </div>`);
      } catch (e) {
        setStatus(4, 'error', 'Failed');
        showResult(4, `<p style="color:var(--c-danger);font-size:13px">${e.error || e.message}</p>`);
      }
    };

    // Reset
    document.getElementById('btn-reset-sim').onclick = () => {
      customerId = null;
      cardId = null;
      paymentId = null;
      renderPaymentFlow(area);
    };
  }

  /* ---- Payment Link Demo ---- */
  function renderPaymentLinkDemo(area) {
    area.innerHTML = `
      <div style="max-width:700px">
        <p style="color:var(--c-text-secondary);margin-bottom:20px">
          Payment links allow you to create a shareable URL that customers can click to make a payment.
          This is useful for invoicing, donations, or any scenario where you need a quick checkout without
          building a full integration.
        </p>

        <div class="card" style="background:var(--c-bg)">
          <h3 style="margin-bottom:12px">How Payment Links Work</h3>
          <div class="sim-flow-diagram">
            <div class="sim-flow-step">
              <div class="sim-flow-num">1</div>
              <div class="sim-flow-text">
                <strong>Create a payment link</strong>
                <p>Specify amount, description, and currency. The API returns a unique URL.</p>
              </div>
            </div>
            <div class="sim-flow-arrow">&#8595;</div>
            <div class="sim-flow-step">
              <div class="sim-flow-num">2</div>
              <div class="sim-flow-text">
                <strong>Share with customer</strong>
                <p>Send the URL via email, SMS, chat, or embed in a webpage.</p>
              </div>
            </div>
            <div class="sim-flow-arrow">&#8595;</div>
            <div class="sim-flow-step">
              <div class="sim-flow-num">3</div>
              <div class="sim-flow-text">
                <strong>Customer pays</strong>
                <p>Customer clicks the link, enters their card details on a hosted checkout page, and pays.</p>
              </div>
            </div>
            <div class="sim-flow-arrow">&#8595;</div>
            <div class="sim-flow-step">
              <div class="sim-flow-num">4</div>
              <div class="sim-flow-text">
                <strong>Payment processed</strong>
                <p>A transaction is created and a webhook is fired (if configured).</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:20px">
          <h3 style="margin-bottom:12px">Create a Payment Link</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="pl-amount">Amount ($)</label>
              <input type="number" id="pl-amount" value="50.00" step="0.01" min="0.01">
            </div>
            <div class="form-group">
              <label for="pl-desc">Description</label>
              <input type="text" id="pl-desc" value="Test payment link" placeholder="Invoice #1234">
            </div>
            <div class="form-group">
              <label for="pl-currency">Currency</label>
              <input type="text" id="pl-currency" value="USD">
            </div>
          </div>
          <button class="btn btn-primary" id="btn-create-pl" style="margin-top:12px">Generate Payment Link</button>
          <div id="pl-result" style="margin-top:16px"></div>
        </div>
      </div>`;

    document.getElementById('btn-create-pl').onclick = async () => {
      const resArea = document.getElementById('pl-result');
      resArea.innerHTML = '<p style="color:var(--c-text-secondary)">Creating payment link...</p>';
      try {
        const result = await api.create('payment-links', {
          amount: Number(document.getElementById('pl-amount').value) || 50,
          description: document.getElementById('pl-desc').value.trim() || 'Payment link',
          currency: document.getElementById('pl-currency').value.trim() || 'USD',
        });
        const url = result.url || result.link_url || 'N/A';
        resArea.innerHTML = `
          <div style="background:var(--c-bg);border:1px solid var(--c-border);border-radius:var(--radius);padding:16px">
            <p style="font-weight:600;margin-bottom:8px">Payment Link Created</p>
            <div class="kv-list" style="font-size:13px">
              <div class="kv-key">ID</div><div class="kv-val"><code>${result.id}</code></div>
              <div class="kv-key">Amount</div><div class="kv-val">${money(result.amount)}</div>
              <div class="kv-key">URL</div><div class="kv-val">
                ${url !== 'N/A'
                  ? `<a href="${url}" target="_blank" style="color:var(--c-primary);word-break:break-all">${url}</a>`
                  : '<span style="color:var(--c-text-secondary)">URL not available in sandbox</span>'}
              </div>
              <div class="kv-key">Status</div><div class="kv-val">${badge(result.status || 'active')}</div>
            </div>
            <button class="btn btn-outline btn-sm" style="margin-top:12px" id="btn-view-pl-detail">View Full Details</button>
          </div>`;
        document.getElementById('btn-view-pl-detail').onclick = () => {
          openModal('Payment Link Details', kvDetail(result));
        };
      } catch (e) {
        resArea.innerHTML = `<p style="color:var(--c-danger)">${e.error || e.message}</p>`;
      }
    };
  }

  render();
  loadContent();

  el.addEventListener('click', async e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      activeTab = tab.dataset.tab;
      el.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
      loadContent();
    }
  });
}
