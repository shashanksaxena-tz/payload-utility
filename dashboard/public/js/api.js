/* ================================================================== */
/*  API Client — all communication with the Express backend            */
/* ================================================================== */

const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export const api = {
  /* Generic CRUD for any resource */
  list:   (resource, params = {}) => {
    const qs = new URLSearchParams();
    if (params.limit)   qs.set('limit', params.limit);
    if (params.offset)  qs.set('offset', params.offset);
    if (params.orderBy) qs.set('orderBy', params.orderBy);
    if (params.filters) {
      params.filters.forEach(f => qs.set(`filter.${f.field}.${f.op}`, f.value));
    }
    const q = qs.toString();
    return request('GET', `/${resource}${q ? '?' + q : ''}`);
  },
  get:    (resource, id)       => request('GET',    `/${resource}/${id}`),
  create: (resource, data)     => request('POST',   `/${resource}`, data),
  update: (resource, id, data) => request('PUT',    `/${resource}/${id}`, data),
  del:    (resource, id)       => request('DELETE',  `/${resource}/${id}`),

  /* Advanced query */
  query: (resource, body) => request('POST', `/${resource}/query`, body),

  /* Instance actions */
  action: (resource, id, action) => request('POST', `/${resource}/${id}/${action}`),

  /* Ledger Manager */
  ledger: {
    balancedEntry:  (pair)    => request('POST', '/ledger/balanced-entry', pair),
    multiLegEntry:  (entries) => request('POST', '/ledger/multi-leg-entry', { entries }),
    balance:        (acctId)  => request('GET',  `/ledger/balance/${acctId}`),
    reconcile:      (ids)     => request('POST', '/ledger/reconcile', { accountIds: ids }),
    reversal:       (data)    => request('POST', '/ledger/reversal', data),
    activity:       (acctId, start, end) => {
      const qs = new URLSearchParams();
      if (start) qs.set('startDate', start);
      if (end)   qs.set('endDate', end);
      const q = qs.toString();
      return request('GET', `/ledger/activity/${acctId}${q ? '?' + q : ''}`);
    },
    txnEntries:     (txnId)  => request('GET', `/ledger/transaction/${txnId}/entries`),
    txnValidate:    (txnId)  => request('GET', `/ledger/transaction/${txnId}/validate`),
  },

  /* Dashboard */
  stats: () => request('GET', '/dashboard/stats'),

  /* Config */
  getConfig:  ()     => request('GET', '/config'),
  setConfig:  (data) => request('POST', '/config', data),
};
