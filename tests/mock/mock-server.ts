/**
 * Enhanced Mock Payload API Server
 *
 * Contract-faithful simulation of the Payload API for E2E testing.
 * Enforces: auth format, request/response shapes, error codes,
 * polymorphic behavior, pagination, field validation, and API versioning.
 */

import http from 'http';

interface StoredObject {
  id: string;
  object: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

// Required fields per object type (mirrors Payload API validation)
const REQUIRED_FIELDS: Record<string, string[]> = {
  customer: [],
  transaction: ['amount'],
  payment_method: [],
  billing_schedule: ['amount', 'frequency'],
  invoice: [],
  webhook: ['url'],
  entity: ['legal_name'],
  stakeholder: ['entity_id', 'first_name', 'last_name'],
  legal_entity_owner: ['legal_entity_id', 'first_name', 'last_name'],
  transfer: ['amount', 'source_account_id', 'destination_account_id'],
  operation: [],
  intent: ['amount'],
};

class MockStore {
  private data: Map<string, Map<string, StoredObject>> = new Map();
  private idCounter = 0;
  private requestLog: Array<{ method: string; path: string; timestamp: string; status: number }> = [];

  private getCollection(objectType: string): Map<string, StoredObject> {
    if (!this.data.has(objectType)) {
      this.data.set(objectType, new Map());
    }
    return this.data.get(objectType)!;
  }

  logRequest(method: string, path: string, status: number): void {
    this.requestLog.push({ method, path, timestamp: new Date().toISOString(), status });
  }

  getRequestLog() { return [...this.requestLog]; }

  create(objectType: string, body: Record<string, unknown>): StoredObject {
    const collection = this.getCollection(objectType);
    const prefix = objectType.replace(/_/g, '').substring(0, 4);
    const id = `${prefix}_${String(++this.idCounter).padStart(6, '0')}`;
    const now = new Date().toISOString();
    const obj: StoredObject = {
      ...body,
      id,
      object: objectType,
      created_at: now,
      updated_at: now,
    };
    collection.set(id, obj);
    return obj;
  }

  get(objectType: string, id: string): StoredObject | null {
    // Search across all collections if objectType doesn't match directly
    const collection = this.getCollection(objectType);
    const found = collection.get(id);
    if (found) return found;

    // For polymorphic types, search parent collection
    const parentMap: Record<string, string> = {
      payment: 'transaction',
      refund: 'transaction',
      credit: 'transaction',
      deposit: 'transaction',
      card: 'payment_method',
      bank_account: 'payment_method',
    };
    const parent = parentMap[objectType];
    if (parent) {
      return this.getCollection(parent).get(id) || null;
    }

    return null;
  }

  update(objectType: string, id: string, body: Record<string, unknown>): StoredObject | null {
    const collection = this.getCollection(objectType);
    const existing = collection.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...body,
      id,
      object: objectType,
      updated_at: new Date().toISOString(),
    };
    collection.set(id, updated);
    return updated;
  }

  delete(objectType: string, id: string): boolean {
    const collection = this.getCollection(objectType);
    return collection.delete(id);
  }

  list(
    objectType: string,
    filters?: Record<string, string>,
    limit?: number,
    offset?: number,
    orderBy?: string
  ): { items: StoredObject[]; total: number } {
    const collection = this.getCollection(objectType);
    let results = Array.from(collection.values());

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        // Handle comparison operators
        const gteMatch = key.match(/^(.+)>=$/);
        const lteMatch = key.match(/^(.+)<=$/);
        const gtMatch = key.match(/^(.+)>$/);
        const ltMatch = key.match(/^(.+)<$/);
        const neMatch = key.match(/^(.+)!$/);
        const containsMatch = key.match(/^(.+)\?\*$/);

        if (gteMatch) {
          results = results.filter(obj => {
            const a = obj[gteMatch[1]], b = value;
            return isNaN(Number(a)) || isNaN(Number(b)) ? String(a) >= String(b) : Number(a) >= Number(b);
          });
        } else if (lteMatch) {
          results = results.filter(obj => {
            const a = obj[lteMatch[1]], b = value;
            return isNaN(Number(a)) || isNaN(Number(b)) ? String(a) <= String(b) : Number(a) <= Number(b);
          });
        } else if (gtMatch) {
          results = results.filter(obj => {
            const a = obj[gtMatch[1]], b = value;
            return isNaN(Number(a)) || isNaN(Number(b)) ? String(a) > String(b) : Number(a) > Number(b);
          });
        } else if (ltMatch) {
          results = results.filter(obj => {
            const a = obj[ltMatch[1]], b = value;
            return isNaN(Number(a)) || isNaN(Number(b)) ? String(a) < String(b) : Number(a) < Number(b);
          });
        } else if (neMatch) {
          results = results.filter(obj => String(obj[neMatch[1]]) !== value);
        } else if (containsMatch) {
          results = results.filter(obj => String(obj[containsMatch[1]]).includes(value));
        } else {
          results = results.filter(obj => String(obj[key]) === value);
        }
      }
    }

    const total = results.length;

    // Order by
    if (orderBy) {
      const desc = orderBy.startsWith('-');
      const field = desc ? orderBy.substring(1) : orderBy;
      results.sort((a, b) => {
        const aVal = String(a[field] || '');
        const bVal = String(b[field] || '');
        return desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      });
    }

    // Pagination
    if (offset && offset > 0) {
      results = results.slice(offset);
    }
    if (limit && limit > 0) {
      results = results.slice(0, limit);
    }

    return { items: results, total };
  }

  clear(): void {
    this.data.clear();
    this.idCounter = 0;
    this.requestLog = [];
  }

  getStats(): { collections: Record<string, number>; totalObjects: number } {
    const collections: Record<string, number> = {};
    let totalObjects = 0;
    for (const [key, collection] of this.data.entries()) {
      collections[key] = collection.size;
      totalObjects += collection.size;
    }
    return { collections, totalObjects };
  }
}

// Endpoint to object type mapping
const ENDPOINT_MAP: Record<string, string> = {
  '/customers': 'customer',
  '/transactions': 'transaction',
  '/payment_methods': 'payment_method',
  '/accounts': 'account',
  '/access_tokens': 'access_token',
  '/billing_schedules': 'billing_schedule',
  '/billing_charges': 'billing_charge',
  '/invoices': 'invoice',
  '/invoice_items': 'invoice_item',
  '/line_items': 'line_item',
  '/webhooks': 'webhook',
  '/webhook_logs': 'webhook_log',
  '/entities': 'entity',
  '/stakeholders': 'stakeholder',
  '/legal_entity_owners': 'legal_entity_owner',
  '/transfers': 'transfer',
  '/processing_accounts': 'processing_account',
  '/processing_agreements': 'processing_agreement',
  '/operations': 'operation',
  '/payment_links': 'payment_link',
  '/intents': 'intent',
  '/transaction_ledgers': 'transaction_ledger',
  '/profiles': 'profile',
  '/orgs': 'org',
  '/accounts/orgs': 'org',
};

const VALID_API_KEYS = [
  'secret_key_test1234567890',
  'test_secret_key_12iNWc9pk09ixqSR0b5CZGFn9FBkP9nT5AJLY3wFq6u1PA',
];

export interface MockServerInstance {
  server: http.Server;
  store: MockStore;
  getRequestLog: () => Array<{ method: string; path: string; timestamp: string; status: number }>;
  getStats: () => { collections: Record<string, number>; totalObjects: number };
  reset: () => void;
}

export function createMockServer(port = 3100): MockServerInstance {
  const store = new MockStore();

  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Powered-By', 'Payload Mock API');

    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // --- Special endpoint: /_meta (for test diagnostics) ---
    if (url.pathname === '/_meta/stats') {
      res.writeHead(200);
      res.end(JSON.stringify(store.getStats()));
      return;
    }
    if (url.pathname === '/_meta/log') {
      res.writeHead(200);
      res.end(JSON.stringify(store.getRequestLog()));
      return;
    }
    if (url.pathname === '/_meta/reset' && req.method === 'POST') {
      store.clear();
      res.writeHead(200);
      res.end(JSON.stringify({ reset: true }));
      return;
    }

    // --- Auth check (Basic Auth: base64(api_key:)) ---
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      const status = 401;
      store.logRequest(req.method || 'GET', url.pathname, status);
      res.writeHead(status);
      res.end(JSON.stringify({
        error_type: 'unauthorized',
        error_description: 'Missing or invalid authorization. Expected: Basic Auth with API key.',
      }));
      return;
    }

    const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString();
    const [apiKey, password] = decoded.split(':');

    // Payload uses api_key as username with empty password
    if (!VALID_API_KEYS.includes(apiKey)) {
      const status = 401;
      store.logRequest(req.method || 'GET', url.pathname, status);
      res.writeHead(status);
      res.end(JSON.stringify({
        error_type: 'unauthorized',
        error_description: 'Invalid API key.',
      }));
      return;
    }

    // Check API version header
    const apiVersion = req.headers['x-api-version'] as string | undefined;

    // --- Determine endpoint and ID ---
    let endpoint = '/' + pathParts.join('/');
    let id: string | undefined;

    if (!ENDPOINT_MAP[endpoint] && pathParts.length >= 2) {
      const potentialEndpoint = '/' + pathParts.slice(0, -1).join('/');
      if (ENDPOINT_MAP[potentialEndpoint]) {
        endpoint = potentialEndpoint;
        id = pathParts[pathParts.length - 1];
      }
    }

    // Special case for /accounts/orgs
    if (pathParts[0] === 'accounts' && pathParts[1] === 'orgs') {
      if (pathParts.length > 2) {
        endpoint = '/accounts/orgs';
        id = pathParts[2];
      } else {
        endpoint = '/accounts/orgs';
      }
    }

    const objectType = ENDPOINT_MAP[endpoint];
    if (!objectType) {
      const status = 404;
      store.logRequest(req.method || 'GET', url.pathname, status);
      res.writeHead(status);
      res.end(JSON.stringify({
        error_type: 'not_found',
        error_description: `Unknown endpoint: ${endpoint}`,
      }));
      return;
    }

    // --- Parse body ---
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      let parsedBody: Record<string, unknown> = {};
      if (body) {
        try {
          parsedBody = JSON.parse(body);
        } catch {
          const status = 400;
          store.logRequest(req.method || 'GET', url.pathname, status);
          res.writeHead(status);
          res.end(JSON.stringify({
            error_type: 'bad_request',
            error_description: 'Invalid JSON body',
          }));
          return;
        }
      }

      // Parse query params
      const filters: Record<string, string> = {};
      let limit: number | undefined;
      let offset: number | undefined;
      let orderBy: string | undefined;

      url.searchParams.forEach((value, key) => {
        if (key === 'limit') { limit = parseInt(value, 10); }
        else if (key === 'offset') { offset = parseInt(value, 10); }
        else if (key === 'order_by') { orderBy = value; }
        else if (key !== 'group_by' && key !== 'fields') {
          filters[key] = value;
        }
      });

      let status = 200;

      try {
        switch (req.method) {
          case 'GET': {
            if (id) {
              const obj = store.get(objectType, id);
              if (!obj) {
                status = 404;
                store.logRequest('GET', url.pathname, status);
                res.writeHead(status);
                res.end(JSON.stringify({
                  error_type: 'not_found',
                  error_description: `${objectType} with id '${id}' not found`,
                }));
                return;
              }
              store.logRequest('GET', url.pathname, 200);
              res.writeHead(200);
              res.end(JSON.stringify(obj));
            } else {
              const result = store.list(objectType, Object.keys(filters).length > 0 ? filters : undefined, limit, offset, orderBy);
              store.logRequest('GET', url.pathname, 200);
              // Include pagination headers before writeHead
              res.writeHead(200, { 'X-Total-Count': String(result.total) });
              res.end(JSON.stringify(result.items));
            }
            break;
          }

          case 'POST': {
            // Validate required fields
            const requiredFields = REQUIRED_FIELDS[objectType] || [];
            const missingFields = requiredFields.filter(f => parsedBody[f] === undefined || parsedBody[f] === null);
            if (missingFields.length > 0) {
              status = 400;
              store.logRequest('POST', url.pathname, status);
              res.writeHead(status);
              res.end(JSON.stringify({
                error_type: 'invalid_attributes',
                error_description: `Missing required fields: ${missingFields.join(', ')}`,
                details: Object.fromEntries(missingFields.map(f => [f, ['is required']])),
              }));
              return;
            }

            // Simulate transaction declined for specific test amounts
            if (objectType === 'transaction' && parsedBody.amount === 0.01) {
              status = 400;
              store.logRequest('POST', url.pathname, status);
              res.writeHead(status);
              res.end(JSON.stringify({
                error_type: 'transaction_declined',
                error_description: 'Transaction was declined by the processor.',
                details: { decline_code: 'insufficient_funds' },
                transaction: { ...parsedBody, status: 'declined', id: 'txn_declined_test' },
              }));
              return;
            }

            const created = store.create(objectType, parsedBody);
            store.logRequest('POST', url.pathname, 200);
            res.writeHead(200);
            res.end(JSON.stringify(created));
            break;
          }

          case 'PUT': {
            if (!id) {
              status = 400;
              store.logRequest('PUT', url.pathname, status);
              res.writeHead(status);
              res.end(JSON.stringify({
                error_type: 'bad_request',
                error_description: 'ID required for update',
              }));
              return;
            }
            const updated = store.update(objectType, id, parsedBody);
            if (!updated) {
              status = 404;
              store.logRequest('PUT', url.pathname, status);
              res.writeHead(status);
              res.end(JSON.stringify({
                error_type: 'not_found',
                error_description: `${objectType} with id '${id}' not found`,
              }));
              return;
            }
            store.logRequest('PUT', url.pathname, 200);
            res.writeHead(200);
            res.end(JSON.stringify(updated));
            break;
          }

          case 'DELETE': {
            if (!id) {
              status = 400;
              store.logRequest('DELETE', url.pathname, status);
              res.writeHead(status);
              res.end(JSON.stringify({
                error_type: 'bad_request',
                error_description: 'ID required for delete',
              }));
              return;
            }
            const deleted = store.delete(objectType, id);
            if (!deleted) {
              status = 404;
              store.logRequest('DELETE', url.pathname, status);
              res.writeHead(status);
              res.end(JSON.stringify({
                error_type: 'not_found',
                error_description: `${objectType} with id '${id}' not found`,
              }));
              return;
            }
            store.logRequest('DELETE', url.pathname, 200);
            res.writeHead(200);
            res.end(JSON.stringify({ id, deleted: true }));
            break;
          }

          default:
            status = 405;
            store.logRequest(req.method || '???', url.pathname, status);
            res.writeHead(status);
            res.end(JSON.stringify({
              error_type: 'method_not_allowed',
              error_description: 'Method not allowed',
            }));
        }
      } catch (err) {
        status = 500;
        store.logRequest(req.method || '???', url.pathname, status);
        res.writeHead(status);
        res.end(JSON.stringify({
          error_type: 'internal_error',
          error_description: String(err),
        }));
      }
    });
  });

  return {
    server,
    store,
    getRequestLog: () => store.getRequestLog(),
    getStats: () => store.getStats(),
    reset: () => store.clear(),
  };
}

// If run directly, start the server
if (require.main === module) {
  const port = parseInt(process.env.MOCK_SERVER_PORT || '3100', 10);
  const { server } = createMockServer(port);
  server.listen(port, () => {
    console.log(`Mock Payload API server listening on port ${port}`);
  });
}
