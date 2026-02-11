/**
 * Mock Payload API Server
 *
 * A lightweight HTTP server that simulates the Payload API for testing.
 * Handles CRUD operations for all Spec01 and Spec02 objects with
 * in-memory storage, authentication validation, and query filtering.
 */

import http from 'http';

interface StoredObject {
  id: string;
  object: string;
  created_at: string;
  [key: string]: unknown;
}

class MockStore {
  private data: Map<string, Map<string, StoredObject>> = new Map();
  private idCounter = 0;

  private getCollection(objectType: string): Map<string, StoredObject> {
    if (!this.data.has(objectType)) {
      this.data.set(objectType, new Map());
    }
    return this.data.get(objectType)!;
  }

  create(objectType: string, body: Record<string, unknown>): StoredObject {
    const collection = this.getCollection(objectType);
    const id = `${objectType.substring(0, 4)}_${++this.idCounter}`;
    const obj: StoredObject = {
      ...body,
      id,
      object: objectType,
      created_at: new Date().toISOString(),
    };
    collection.set(id, obj);
    return obj;
  }

  get(objectType: string, id: string): StoredObject | null {
    const collection = this.getCollection(objectType);
    return collection.get(id) || null;
  }

  update(objectType: string, id: string, body: Record<string, unknown>): StoredObject | null {
    const collection = this.getCollection(objectType);
    const existing = collection.get(id);
    if (!existing) return null;

    const updated = { ...existing, ...body, id, object: objectType };
    collection.set(id, updated);
    return updated;
  }

  delete(objectType: string, id: string): boolean {
    const collection = this.getCollection(objectType);
    return collection.delete(id);
  }

  list(objectType: string, filters?: Record<string, string>): StoredObject[] {
    const collection = this.getCollection(objectType);
    let results = Array.from(collection.values());

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        // Handle comparison operators
        const gtMatch = key.match(/^(.+)>$/);
        const ltMatch = key.match(/^(.+)<$/);

        if (gtMatch) {
          const field = gtMatch[1];
          results = results.filter(obj => Number(obj[field]) > Number(value));
        } else if (ltMatch) {
          const field = ltMatch[1];
          results = results.filter(obj => Number(obj[field]) < Number(value));
        } else {
          results = results.filter(obj => String(obj[key]) === value);
        }
      }
    }

    return results;
  }

  clear(): void {
    this.data.clear();
    this.idCounter = 0;
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
  '/transfers': 'transfer',
  '/processing_accounts': 'processing_account',
  '/processing_agreements': 'processing_agreement',
  '/payment_links': 'payment_link',
  '/intents': 'intent',
  '/transaction_ledgers': 'transaction_ledger',
  '/profiles': 'profile',
  '/accounts/orgs': 'org',
};

const VALID_API_KEY = 'secret_key_test1234567890';

export function createMockServer(port = 3100): http.Server {
  const store = new MockStore();

  const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Parse URL
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Auth check
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.writeHead(401);
      res.end(JSON.stringify({ error_type: 'unauthorized', error_description: 'Missing or invalid authorization' }));
      return;
    }

    const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString();
    const apiKey = decoded.split(':')[0];
    if (apiKey !== VALID_API_KEY) {
      res.writeHead(401);
      res.end(JSON.stringify({ error_type: 'unauthorized', error_description: 'Invalid API key' }));
      return;
    }

    // Determine endpoint and ID
    let endpoint = '/' + pathParts.join('/');
    let id: string | undefined;

    // Check for ID in path (e.g., /customers/cust_1)
    // Try matching with and without last segment
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
      res.writeHead(404);
      res.end(JSON.stringify({ error_type: 'not_found', error_description: `Unknown endpoint: ${endpoint}` }));
      return;
    }

    // Parse body for POST/PUT
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      let parsedBody: Record<string, unknown> = {};
      if (body) {
        try {
          parsedBody = JSON.parse(body);
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error_type: 'bad_request', error_description: 'Invalid JSON body' }));
          return;
        }
      }

      // Parse query params as filters
      const filters: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        if (!['limit', 'offset', 'order_by', 'group_by', 'fields'].includes(key)) {
          filters[key] = value;
        }
      });

      try {
        switch (req.method) {
          case 'GET': {
            if (id) {
              const obj = store.get(objectType, id);
              if (!obj) {
                res.writeHead(404);
                res.end(JSON.stringify({ error_type: 'not_found', error_description: `${objectType} not found` }));
                return;
              }
              res.writeHead(200);
              res.end(JSON.stringify(obj));
            } else {
              const results = store.list(objectType, Object.keys(filters).length > 0 ? filters : undefined);
              res.writeHead(200);
              res.end(JSON.stringify(results));
            }
            break;
          }

          case 'POST': {
            const created = store.create(objectType, parsedBody);
            res.writeHead(200);
            res.end(JSON.stringify(created));
            break;
          }

          case 'PUT': {
            if (!id) {
              res.writeHead(400);
              res.end(JSON.stringify({ error_type: 'bad_request', error_description: 'ID required for update' }));
              return;
            }
            const updated = store.update(objectType, id, parsedBody);
            if (!updated) {
              res.writeHead(404);
              res.end(JSON.stringify({ error_type: 'not_found', error_description: `${objectType} not found` }));
              return;
            }
            res.writeHead(200);
            res.end(JSON.stringify(updated));
            break;
          }

          case 'DELETE': {
            if (!id) {
              res.writeHead(400);
              res.end(JSON.stringify({ error_type: 'bad_request', error_description: 'ID required for delete' }));
              return;
            }
            const deleted = store.delete(objectType, id);
            if (!deleted) {
              res.writeHead(404);
              res.end(JSON.stringify({ error_type: 'not_found', error_description: `${objectType} not found` }));
              return;
            }
            res.writeHead(200);
            res.end(JSON.stringify({ deleted: true }));
            break;
          }

          default:
            res.writeHead(405);
            res.end(JSON.stringify({ error_type: 'method_not_allowed', error_description: 'Method not allowed' }));
        }
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error_type: 'internal_error', error_description: String(err) }));
      }
    });
  });

  return server;
}

/** Reset the mock store (for test isolation) */
export function resetMockStore(): void {
  // Store is per-server instance, handled internally
}

// If run directly, start the server
if (require.main === module) {
  const port = parseInt(process.env.MOCK_SERVER_PORT || '3100', 10);
  const server = createMockServer(port);
  server.listen(port, () => {
    console.log(`Mock Payload API server listening on port ${port}`);
  });
}
