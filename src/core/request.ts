/**
 * Request - HTTP request builder for the Payload ARM framework.
 *
 * Handles URL construction, HTTP method dispatch, query parameter serialization,
 * authentication headers, and response parsing with error mapping.
 */

import { PayloadError } from './exceptions';
import { Filter, serializeFilters } from './attr';
import { nestedQStringKeys, buildUrl, generateRequestId, sanitizeId } from './utils';
import http from 'http';
import https from 'https';
import { URL } from 'url';

export interface RequestOptions {
  apiUrl: string;
  apiKey: string;
  apiVersion?: string;
  timeout?: number;
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

    let bodyStr: string | undefined;
    if (config.body && (config.method === 'POST' || config.method === 'PUT')) {
      bodyStr = JSON.stringify(config.body);
    }

    const response = await makeRequest(
      url,
      config.method,
      headers,
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
