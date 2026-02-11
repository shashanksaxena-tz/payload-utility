/* ================================================================== */
/*  Main Application — Router, Navigation, Lifecycle                   */
/* ================================================================== */

import { api } from './api.js';
import { toast } from './components.js';

import { dashboardPage }      from './pages/dashboard.js';
import { customersPage }      from './pages/customers.js';
import { paymentsPage }       from './pages/payments.js';
import { paymentMethodsPage } from './pages/payment-methods.js';
import { billingPage }        from './pages/billing.js';
import { invoicesPage }       from './pages/invoices.js';
import { entitiesPage }       from './pages/entities.js';
import { webhooksPage }       from './pages/webhooks.js';
import { paymentLinksPage }   from './pages/payment-links.js';
import { transfersPage }      from './pages/transfers.js';
import { ledgerPage }         from './pages/ledger.js';
import { settingsPage }       from './pages/settings.js';

/* ---- Page registry ---- */
const PAGES = {
  dashboard:        { title: 'Dashboard',        icon: '&#9632;',  page: dashboardPage },
  customers:        { title: 'Customers',         icon: '&#9787;',  page: customersPage },
  payments:         { title: 'Transactions',      icon: '&#8364;',  page: paymentsPage },
  'payment-methods':{ title: 'Payment Methods',   icon: '&#9889;',  page: paymentMethodsPage },
  billing:          { title: 'Billing',           icon: '&#8635;',  page: billingPage },
  invoices:         { title: 'Invoices',          icon: '&#9993;',  page: invoicesPage },
  entities:         { title: 'Entities',          icon: '&#9959;',  page: entitiesPage },
  webhooks:         { title: 'Webhooks',          icon: '&#128279;',page: webhooksPage },
  'payment-links':  { title: 'Payment Links',     icon: '&#128279;',page: paymentLinksPage },
  transfers:        { title: 'Transfers',         icon: '&#8644;',  page: transfersPage },
  ledger:           { title: 'Ledger',            icon: '&#128218;',page: ledgerPage },
  settings:         { title: 'Settings',          icon: '&#9881;',  page: settingsPage },
};

/* ---- Build sidebar nav ---- */
function buildNav() {
  const ul = document.getElementById('nav-list');
  ul.innerHTML = '';
  Object.entries(PAGES).forEach(([key, cfg]) => {
    if (key === 'settings') return; // rendered in footer
    const li = document.createElement('li');
    li.innerHTML = `<a href="#${key}" class="nav-link" data-page="${key}">
      <span class="nav-icon">${cfg.icon}</span><span>${cfg.title}</span></a>`;
    ul.appendChild(li);
  });
}

/* ---- Router ---- */
let currentPage = null;

async function navigate(page) {
  page = page || 'dashboard';
  if (!PAGES[page]) page = 'dashboard';
  currentPage = page;

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  // Set title
  document.getElementById('page-title').textContent = PAGES[page].title;

  // Render page
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  try {
    await PAGES[page].page(content);
  } catch (e) {
    console.error('Page render error:', e);
    content.innerHTML = `<div class="card"><p style="color:var(--c-danger)">Error: ${e.error || e.message || e}</p></div>`;
  }

  // Update URL hash
  if (location.hash !== '#' + page) {
    history.pushState(null, '', '#' + page);
  }
}

/* ---- Status check ---- */
async function checkStatus() {
  const ind = document.getElementById('status-indicator');
  try {
    const cfg = await api.getConfig();
    ind.textContent = cfg.initialised ? 'Connected' : 'Not configured';
    ind.className = cfg.initialised ? 'ok' : 'err';
  } catch {
    ind.textContent = 'Offline';
    ind.className = 'err';
  }
}

/* ---- Init ---- */
buildNav();

// Click handler for nav links (sidebar + footer)
document.getElementById('sidebar').addEventListener('click', e => {
  const link = e.target.closest('[data-page]');
  if (link) {
    e.preventDefault();
    navigate(link.dataset.page);
  }
});

// Sidebar toggle
document.getElementById('sidebar-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('sidebar').classList.toggle('open');
});

// Hash routing
window.addEventListener('hashchange', () => {
  navigate(location.hash.slice(1));
});

// Initial route
checkStatus();
navigate(location.hash.slice(1) || 'dashboard');
