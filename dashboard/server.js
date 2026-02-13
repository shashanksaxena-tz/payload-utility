const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ------------------------------------------------------------------ */
/*  SDK bootstrap                                                      */
/* ------------------------------------------------------------------ */

let sdk = null; // { session, attr, LedgerManager, ledger }

function buildAttrFilter(attr, f) {
  const chain = f.field.split('.').reduce((a, k) => a[k], attr);
  const ops = { eq:'eq', ne:'ne', gt:'gt', lt:'lt', gte:'gte', lte:'lte', contains:'contains' };
  return chain[ops[f.op] || 'eq'](f.value);
}

function initSession(apiKey, apiUrl) {
  const dist = require('../dist');
  const session = new dist.Session(apiKey, {
    apiUrl: apiUrl || 'https://api.payload.co',
    apiVersion: 'v2',
  });
  const ledger = new dist.LedgerManager(session);
  sdk = { session, attr: dist.attr, LedgerManager: dist.LedgerManager, ledger };
}

// Attempt initial load from env
try {
  if (process.env.PAYLOAD_API_KEY) {
    initSession(process.env.PAYLOAD_API_KEY.trim(), process.env.PAYLOAD_API_URL ? process.env.PAYLOAD_API_URL.trim() : undefined);
  }
} catch (e) {
  console.warn('SDK not loaded yet — build the parent project first or set env vars.', e.message);
}

function requireSdk(req, res, next) {
  if (!sdk) return res.status(503).json({ error: 'SDK not initialised. Set API key in Settings.' });
  next();
}

/* ------------------------------------------------------------------ */
/*  Config routes                                                      */
/* ------------------------------------------------------------------ */

app.get('/api/config', (req, res) => {
  res.json({
    initialised: !!sdk,
    apiUrl: process.env.PAYLOAD_API_URL || 'https://api.payload.co',
    hasKey: !!(process.env.PAYLOAD_API_KEY || (sdk && true)),
  });
});

app.post('/api/config', (req, res) => {
  try {
    const { apiKey, apiUrl } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'apiKey is required' });
    initSession(apiKey, apiUrl || 'https://api.payload.co');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ------------------------------------------------------------------ */
/*  Model map — SDK model accessor name for each REST resource         */
/* ------------------------------------------------------------------ */

const MODEL_MAP = {
  'customers':              'Customer',
  'payments':               'Payment',
  'refunds':                'Refund',
  'credits':                'Credit',
  'deposits':               'Deposit',
  'cards':                  'Card',
  'bank-accounts':          'BankAccount',
  'billing-schedules':      'BillingSchedule',
  'billing-charges':        'BillingCharge',
  'invoices':               'Invoice',
  'invoice-items':          'InvoiceItem',
  'charge-items':           'ChargeItem',
  'payment-items':          'PaymentItem',
  'entities':               'Entity',
  'stakeholders':           'Stakeholder',
  'webhooks':               'Webhook',
  'webhook-logs':           'WebhookLog',
  'payment-links':          'PaymentLink',
  'intents':                'Intent',
  'transfers':              'Transfer',
  'ledger-entries':         'Ledger',
  'processing-accounts':    'ProcessingAccount',
  'processing-agreements':  'ProcessingAgreement',
  'profiles':               'Profile',
  'orgs':                   'Org',
  'accounts':               'Account',
  'client-tokens':          'ClientToken',
};

/* ------------------------------------------------------------------ */
/*  Generic CRUD routes for every model                                */
/* ------------------------------------------------------------------ */

function modelData(instance) {
  // Extract all data from a model instance
  if (!instance) return null;
  const d = { id: instance.id };
  if (instance._data) Object.assign(d, instance._data);
  if (instance.data)  Object.assign(d, instance.data);
  // Also try known getters
  const raw = instance.toJSON ? instance.toJSON() : instance;
  if (typeof raw === 'object' && raw !== null) Object.assign(d, raw);
  return d;
}

Object.entries(MODEL_MAP).forEach(([resource, modelName]) => {
  const router = express.Router();

  // LIST  GET /api/{resource}
  router.get('/', async (req, res) => {
    try {
      const model = sdk.session[modelName];
      let query = model.filterBy();

      // Apply filters from query string  ?filter.email.eq=foo
      Object.entries(req.query).forEach(([key, value]) => {
        const m = key.match(/^filter\.(.+)\.(\w+)$/);
        if (m) query = query.filterBy(buildAttrFilter(sdk.attr, { field: m[1], op: m[2], value }));
      });

      if (req.query.orderBy) query = query.orderBy(req.query.orderBy);
      if (req.query.limit)   query = query.limit(Number(req.query.limit));
      if (req.query.offset)  query = query.offset(Number(req.query.offset));

      const items = await query.all();
      res.json(items.map(modelData));
    } catch (e) {
      console.error(`Error in GET /api/${resource}:`, e.message, e.details);
      res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
    }
  });

  // GET ONE  GET /api/{resource}/:id
  router.get('/:id', async (req, res) => {
    try {
      const item = await sdk.session[modelName].get(req.params.id);
      res.json(modelData(item));
    } catch (e) {
      console.error(`Error in GET /api/${resource}/${req.params.id}:`, e.message, e.details);
      res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
    }
  });

  // CREATE  POST /api/{resource}
  router.post('/', async (req, res) => {
    try {
      console.log(`[DEBUG] POST /api/${resource} Body:`, JSON.stringify(req.body));
      const item = await sdk.session[modelName].create(req.body);
      res.status(201).json(modelData(item));
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
    }
  });

  // UPDATE  PUT /api/{resource}/:id
  router.put('/:id', async (req, res) => {
    try {
      const instance = await sdk.session[modelName].get(req.params.id);
      await instance.update(req.body);
      res.json(modelData(instance));
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
    }
  });

  // DELETE  DELETE /api/{resource}/:id
  router.delete('/:id', async (req, res) => {
    try {
      const instance = await sdk.session[modelName].get(req.params.id);
      await instance.delete();
      res.json({ ok: true });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
    }
  });

  app.use(`/api/${resource}`, requireSdk, router);
});

/* ------------------------------------------------------------------ */
/*  Advanced query route (POST body with structured filters)           */
/* ------------------------------------------------------------------ */

app.post('/api/:resource/query', requireSdk, async (req, res) => {
  try {
    const modelName = MODEL_MAP[req.params.resource];
    if (!modelName) return res.status(404).json({ error: 'Unknown resource' });

    const model = sdk.session[modelName];
    let query = model.filterBy();

    (req.body.filters || []).forEach(f => {
      query = query.filterBy(buildAttrFilter(sdk.attr, f));
    });

    if (req.body.orderBy) query = query.orderBy(req.body.orderBy);
    if (req.body.limit)   query = query.limit(Number(req.body.limit));
    if (req.body.offset)  query = query.offset(Number(req.body.offset));

    const items = await query.all();
    res.json(items.map(modelData));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
  }
});

/* ------------------------------------------------------------------ */
/*  Instance action routes                                             */
/* ------------------------------------------------------------------ */

// Transaction void
app.post('/api/payments/:id/void',  requireSdk, instanceAction('Payment', 'void'));
app.post('/api/refunds/:id/void',   requireSdk, instanceAction('Refund',  'void'));
app.post('/api/credits/:id/void',   requireSdk, instanceAction('Credit',  'void'));
app.post('/api/deposits/:id/void',  requireSdk, instanceAction('Deposit', 'void'));

// Billing schedule actions
app.post('/api/billing-schedules/:id/pause',  requireSdk, instanceAction('BillingSchedule', 'pause'));
app.post('/api/billing-schedules/:id/resume', requireSdk, instanceAction('BillingSchedule', 'resume'));
app.post('/api/billing-schedules/:id/cancel', requireSdk, instanceAction('BillingSchedule', 'cancel'));

// Invoice actions
app.post('/api/invoices/:id/send',      requireSdk, instanceAction('Invoice', 'send'));
app.post('/api/invoices/:id/mark-paid', requireSdk, instanceAction('Invoice', 'markPaid'));
app.post('/api/invoices/:id/void',      requireSdk, instanceAction('Invoice', 'void'));

// Webhook actions
app.post('/api/webhooks/:id/enable',  requireSdk, instanceAction('Webhook', 'enable'));
app.post('/api/webhooks/:id/disable', requireSdk, instanceAction('Webhook', 'disable'));

function instanceAction(modelName, method) {
  return async (req, res) => {
    try {
      const instance = await sdk.session[modelName].get(req.params.id);
      await instance[method]();
      res.json(modelData(instance));
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message, details: e.details });
    }
  };
}

/* ------------------------------------------------------------------ */
/*  Ledger Manager routes                                              */
/* ------------------------------------------------------------------ */

app.post('/api/ledger/balanced-entry', requireSdk, async (req, res) => {
  try {
    const result = await sdk.ledger.createBalancedEntry(req.body);
    res.status(201).json({ debit: modelData(result.debit), credit: modelData(result.credit) });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.post('/api/ledger/multi-leg-entry', requireSdk, async (req, res) => {
  try {
    const entries = await sdk.ledger.createMultiLegEntry(req.body.entries);
    res.status(201).json(entries.map(modelData));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.get('/api/ledger/balance/:accountId', requireSdk, async (req, res) => {
  try {
    const balance = await sdk.ledger.getAccountBalance(req.params.accountId);
    res.json(balance);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.post('/api/ledger/reconcile', requireSdk, async (req, res) => {
  try {
    const result = await sdk.ledger.reconcile(req.body.accountIds);
    res.json(result);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.post('/api/ledger/reversal', requireSdk, async (req, res) => {
  try {
    const { originalDebitAccountId, originalCreditAccountId, amount, reason, metadata } = req.body;
    const result = await sdk.ledger.createReversalEntry(
      originalDebitAccountId, originalCreditAccountId, amount, reason, metadata
    );
    res.status(201).json({ debit: modelData(result.debit), credit: modelData(result.credit) });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.get('/api/ledger/activity/:accountId', requireSdk, async (req, res) => {
  try {
    const result = await sdk.ledger.getActivitySummary(
      req.params.accountId, req.query.startDate, req.query.endDate
    );
    res.json(result);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.get('/api/ledger/transaction/:txnId/entries', requireSdk, async (req, res) => {
  try {
    const entries = await sdk.ledger.getTransactionEntries(req.params.txnId);
    res.json(entries.map(modelData));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.get('/api/ledger/transaction/:txnId/validate', requireSdk, async (req, res) => {
  try {
    const balanced = await sdk.ledger.validateTransactionBalance(req.params.txnId);
    res.json({ balanced });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.get('/api/ledger/daily-balances/:accountId', requireSdk, async (req, res) => {
  try {
    const result = await sdk.ledger.getDailyBalances(
      req.params.accountId, req.query.startDate, req.query.endDate
    );
    res.json(result);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.get('/api/ledger/monthly-balances/:accountId', requireSdk, async (req, res) => {
  try {
    const result = await sdk.ledger.getMonthlyBalances(
      req.params.accountId, req.query.startDate, req.query.endDate
    );
    res.json(result);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.get('/api/ledger/statement/:accountId', requireSdk, async (req, res) => {
  try {
    const result = await sdk.ledger.getAccountStatement(
      req.params.accountId, req.query.startDate, req.query.endDate
    );
    res.json(result);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.post('/api/ledger/trial-balance', requireSdk, async (req, res) => {
  try {
    const result = await sdk.ledger.getTrialBalance(req.body.accountIds, req.body.asOfDate);
    res.json(result);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.get('/api/ledger/export/:accountId', requireSdk, async (req, res) => {
  try {
    const result = await sdk.ledger.exportEntries(
      req.params.accountId, req.query.startDate, req.query.endDate, req.query.format || 'json'
    );
    if (result.format === 'csv') {
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', `attachment; filename=ledger_${req.params.accountId}.csv`);
      res.send(result.data);
    } else {
      res.json(result);
    }
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

/* ------------------------------------------------------------------ */
/*  Dashboard stats                                                    */
/* ------------------------------------------------------------------ */

app.get('/api/dashboard/stats', requireSdk, async (req, res) => {
  try {
    const counts = {};
    const quick = ['Customer','Payment','Invoice','BillingSchedule','Webhook','Entity','Transfer'];
    await Promise.all(quick.map(async m => {
      try {
        const items = await sdk.session[m].filterBy().limit(0).all();
        counts[m] = items.length;
      } catch {
        // limit(0) may not work; fall back to fetching a page
        try {
          const items = await sdk.session[m].filterBy().limit(100).all();
          counts[m] = items.length;
        } catch { counts[m] = '?'; }
      }
    }));
    res.json(counts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ------------------------------------------------------------------ */
/*  SPA fallback                                                       */
/* ------------------------------------------------------------------ */

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ------------------------------------------------------------------ */
/*  Start                                                              */
/* ------------------------------------------------------------------ */

const PORT = process.env.DASHBOARD_PORT || 3000;
app.listen(PORT, () => {
  console.log(`Payload Dashboard running on http://localhost:${PORT}`);
  console.log(`SDK initialised: ${!!sdk}`);
});
