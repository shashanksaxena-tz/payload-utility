/**
 * Request - HTTP request builder for the Payload ARM framework.
 *
 * Handles URL construction, HTTP method dispatch, query parameter serialization,
 * authentication headers, and response parsing with error mapping.
 */

import { PayloadError } from './exceptions';
import { Filter, serializeFilters } from './attr';
import { nestedQStringKeys, buildUrl, generateRequestId, sanitizeId } from './utils';
import { MiddlewareChain, RequestContext, ResponseContext } from './middleware';
import { PayloadEventEmitter } from './events';
import { RetryExecutor, CircuitBreaker, RateLimiter } from './retry';
import http from 'http';
import https from 'https';
import { URL } from 'url';

export interface RequestOptions {
  apiUrl: string;
  apiKey: string;
  apiVersion?: string;
  timeout?: number;
  middleware?: MiddlewareChain;
  events?: PayloadEventEmitter;
  retry?: RetryExecutor;
  circuitBreaker?: CircuitBreaker;
  rateLimiter?: RateLimiter;
}

export interface RequestConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, unknown>;
  filters?: Filter[];
  body?: Record<string, unknown>;
  id?: string;
  queryOptions?: QueryOptions;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  groupBy?: string;
  fields?: string[];
}

export interface ApiResponse<T = Record<string, unknown>> {
  statusCode: number;
  data: T;
  requestId: string;
}

/**
 * Make an HTTP/HTTPS request to the Payload API.
 */
function makeRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  timeout = 30000
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers,
      timeout,
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 500, body: data });
      });
    });

    req.on('error', (err: Error) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

export class Request {
  private readonly options: RequestOptions;

  constructor(options: RequestOptions) {
    this.options = options;
  }

  private buildHeaders(requestId: string, method: string): Record<string, string> {
    // Support both Basic Auth (api key) and Bearer token auth
    let authorization: string;
    if (this.options.apiKey.startsWith('bearer_')) {
      authorization = `Bearer ${this.options.apiKey.slice(7)}`;
    } else {
      const authToken = Buffer.from(`${this.options.apiKey}:`).toString('base64');
      authorization = `Basic ${authToken}`;
    }

    const headers: Record<string, string> = {
      'Authorization': authorization,
      'Accept': 'application/json',
      'X-Request-Id': requestId,
      'User-Agent': 'payload-utility/1.0.0',
    };

    if (method === 'POST' || method === 'PUT') {
      headers['Content-Type'] = 'application/json';
    }

    if (this.options.apiVersion) {
      headers['X-API-Version'] = this.options.apiVersion;
    }

    return headers;
  }

  private buildRequestUrl(config: RequestConfig): string {
    let path = config.endpoint;

    if (config.id) {
      path = `${path}/${sanitizeId(config.id)}`;
    }

    const queryParams: Record<string, string> = {};

    // Add filters
    if (config.filters && config.filters.length > 0) {
      Object.assign(queryParams, serializeFilters(config.filters));
    }

    // Add flat params
    if (config.params) {
      Object.assign(queryParams, nestedQStringKeys(config.params));
    }

    // Add query options
    if (config.queryOptions) {
      const opts = config.queryOptions;
      if (opts.limit !== undefined) queryParams['limit'] = String(opts.limit);
      if (opts.offset !== undefined) queryParams['offset'] = String(opts.offset);
      if (opts.orderBy) queryParams['order_by'] = opts.orderBy;
      if (opts.groupBy) queryParams['group_by'] = opts.groupBy;
      if (opts.fields && opts.fields.length > 0) {
        queryParams['fields'] = opts.fields.join(',');
      }
    }

    return buildUrl(this.options.apiUrl, path, queryParams);
  }

  async execute<T = Record<string, unknown>>(config: RequestConfig): Promise<ApiResponse<T>> {
    const requestId = generateRequestId();
    const url = this.buildRequestUrl(config);
    const headers = this.buildHeaders(requestId, config.method);

    // Build initial request context for middleware/events
    let reqCtx: RequestContext = {
      method: config.method,
      path: url,
      headers: { ...headers },
      body: config.body,
    };

    // Run before-request middleware
    if (this.options.middleware && this.options.middleware.size > 0) {
      reqCtx = await this.options.middleware.runBefore(reqCtx);
    }

    // Emit request.before event
    if (this.options.events) {
      this.options.events.emit('request.before', {
        method: reqCtx.method,
        path: reqCtx.path,
        requestId,
      });
    }

    // The core HTTP call wrapped for retry/circuit-breaker/rate-limiter
    const doRequest = async (): Promise<ApiResponse<T>> => {
      // Rate limiter: wait for a token before sending
      if (this.options.rateLimiter) {
        await this.options.rateLimiter.acquire();
      }

      let bodyStr: string | undefined;
      if (reqCtx.body && (reqCtx.method === 'POST' || reqCtx.method === 'PUT')) {
        bodyStr = JSON.stringify(reqCtx.body);
      }

      const response = await makeRequest(
        reqCtx.path,
        reqCtx.method,
        reqCtx.headers,
        bodyStr,
        this.options.timeout
      );

      let parsedBody: Record<string, unknown>;
      try {
        parsedBody = response.body ? JSON.parse(response.body) : {};
      } catch {
        parsedBody = { raw: response.body };
      }

      if (response.statusCode >= 400) {
        throw PayloadError.fromResponse(response.statusCode, parsedBody);
      }

      return {
        statusCode: response.statusCode,
        data: parsedBody as T,
        requestId,
      };
    };

    try {
      // Wrap with circuit breaker and retry as configured
      let result: ApiResponse<T>;

      const withCircuitBreaker = this.options.circuitBreaker
        ? () => this.options.circuitBreaker!.execute(doRequest)
        : doRequest;

      if (this.options.retry) {
        result = await this.options.retry.execute(withCircuitBreaker);
      } else {
        result = await withCircuitBreaker();
      }

      // Build response context for after-response middleware
      let resCtx: ResponseContext = {
        statusCode: result.statusCode,
        data: result.data as Record<string, unknown>,
        headers: {},
      };

      // Run after-response middleware
      if (this.options.middleware && this.options.middleware.size > 0) {
        resCtx = await this.options.middleware.runAfter(resCtx, reqCtx);
      }

      // Emit request.after event
      if (this.options.events) {
        this.options.events.emit('request.after', {
          method: reqCtx.method,
          path: reqCtx.path,
          statusCode: resCtx.statusCode,
          requestId,
        });
      }

      return {
        statusCode: resCtx.statusCode,
        data: resCtx.data as T,
        requestId: result.requestId,
      };
    } catch (error) {
      // Emit request.error event
      if (this.options.events) {
        this.options.events.emit('request.error', {
          method: reqCtx.method,
          path: reqCtx.path,
          error: error instanceof Error ? error.message : String(error),
          requestId,
        });
      }

      // Run error middleware
      if (this.options.middleware && this.options.middleware.size > 0 && error instanceof Error) {
        await this.options.middleware.runError(error, reqCtx);
        // runError always re-throws, so we won't reach here
      }

      throw error;
    }
  }

  /** Convenience: GET request */
  async get<T = Record<string, unknown>>(
    endpoint: string,
    id?: string,
    params?: Record<string, unknown>,
    filters?: Filter[],
    queryOptions?: QueryOptions
  ): Promise<ApiResponse<T>> {
    return this.execute<T>({
      endpoint,
      method: 'GET',
      id,
      params,
      filters,
      queryOptions,
    });
  }

  /** Convenience: POST request */
  async post<T = Record<string, unknown>>(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    return this.execute<T>({
      endpoint,
      method: 'POST',
      body,
    });
  }

  /** Convenience: PUT request */
  async put<T = Record<string, unknown>>(
    endpoint: string,
    id: string,
    body: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    return this.execute<T>({
      endpoint,
      method: 'PUT',
      id,
      body,
    });
  }

  /** Convenience: DELETE request */
  async delete<T = Record<string, unknown>>(
    endpoint: string,
    id: string
  ): Promise<ApiResponse<T>> {
    return this.execute<T>({
      endpoint,
      method: 'DELETE',
      id,
    });
  }
}
