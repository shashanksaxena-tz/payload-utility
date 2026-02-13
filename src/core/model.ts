/**
 * Model - Base ARM Model class for all Payload API objects.
 *
 * Implements the ORM-like CRUD pattern with polymorphic type dispatch,
 * chainable queries, and identity-map caching.
 */

import { Request, QueryOptions, ApiResponse } from './request';
import { Filter } from './attr';
import { pluralize, deepClone } from './utils';

/** Spec definition for an ARM object type */
export interface ModelSpec {
  object: string;
  endpoint?: string;
  polymorphic?: Record<string, string>;
}

/** Data returned from the API for a single object */
export type ModelData = Record<string, unknown>;

/** Object cache for identity map pattern */
const objectCache = new Map<string, Model>();

/** Per-class merged spec cache */
const mergedSpecCache = new WeakMap<Function, ModelSpec>();

/**
 * Base Model class - all Payload API objects extend this.
 */
export class Model {
  static spec: ModelSpec = { object: '' };

  /** Instance data */
  protected _data: ModelData;

  /** Reference to the request instance for API calls */
  protected _request: Request | null = null;

  constructor(data: ModelData = {}) {
    this._data = deepClone(data);

    // Apply polymorphic defaults from spec
    const mergedSpec = (this.constructor as typeof Model).getMergedSpec();
    if (mergedSpec.polymorphic) {
      for (const [key, value] of Object.entries(mergedSpec.polymorphic)) {
        if (this._data[key] === undefined) {
          this._data[key] = value;
        }
      }
    }
  }

  /** Get the merged spec (walking up the prototype chain) */
  static getMergedSpec(): ModelSpec {
    const cached = mergedSpecCache.get(this);
    if (cached) return cached;

    let spec: ModelSpec = { ...this.spec };

    // Walk up prototype chain to merge parent specs
    let proto = Object.getPrototypeOf(this);
    while (proto && proto !== Model && proto.spec) {
      spec = {
        object: spec.object || proto.spec.object,
        endpoint: spec.endpoint || proto.spec.endpoint,
        polymorphic: {
          ...proto.spec.polymorphic,
          ...spec.polymorphic,
        },
      };
      proto = Object.getPrototypeOf(proto);
    }

    // Auto-generate endpoint if not specified
    if (!spec.endpoint && spec.object) {
      spec.endpoint = '/' + pluralize(spec.object);
    }

    // Clean empty polymorphic
    if (spec.polymorphic && Object.keys(spec.polymorphic).length === 0) {
      delete spec.polymorphic;
    }

    mergedSpecCache.set(this, spec);
    return spec;
  }

  /** Get the API endpoint for this model */
  static getEndpoint(): string {
    const spec = this.getMergedSpec();
    return spec.endpoint || '/' + pluralize(spec.object);
  }

  /** Bind a request instance for API operations */
  bindRequest(request: Request): this {
    this._request = request;
    return this;
  }

  /** Get attribute value */
  get(key: string): unknown {
    return this._data[key];
  }

  /** Get string attribute */
  getStr(key: string): string {
    const val = this._data[key];
    return val !== undefined && val !== null ? String(val) : '';
  }

  /** Get number attribute */
  getNum(key: string): number {
    const val = this._data[key];
    return typeof val === 'number' ? val : Number(val) || 0;
  }

  /** Get float attribute */
  getFloat(key: string): number {
    return this.getNum(key);
  }

  /** Get int attribute */
  getInt(key: string): number {
    return Math.floor(this.getNum(key));
  }

  /** Get boolean attribute */
  getBool(key: string): boolean {
    return Boolean(this._data[key]);
  }

  /** Get the object ID */
  get id(): string {
    return this.getStr('id');
  }

  /** Get raw data */
  get data(): ModelData {
    return deepClone(this._data);
  }

  /** Convert to plain object */
  toJSON(): ModelData {
    return deepClone(this._data);
  }

  // --- Instance CRUD operations ---

  /** Update this object */
  async update(attrs: ModelData): Promise<this> {
    if (!this._request) throw new Error('Model not bound to a request instance');
    if (!this.id) throw new Error('Cannot update object without an ID');

    const spec = (this.constructor as typeof Model).getMergedSpec();
    const endpoint = (this.constructor as typeof Model).getEndpoint();

    const response = await this._request.put(endpoint, this.id, {
      ...attrs,
    });

    Object.assign(this._data, response.data);

    // Update cache
    if (this.id) {
      objectCache.set(`${spec.object}:${this.id}`, this);
    }

    return this;
  }

  /** Delete this object */
  async delete(): Promise<void> {
    if (!this._request) throw new Error('Model not bound to a request instance');
    if (!this.id) throw new Error('Cannot delete object without an ID');

    const spec = (this.constructor as typeof Model).getMergedSpec();
    const endpoint = (this.constructor as typeof Model).getEndpoint();

    await this._request.delete(endpoint, this.id);

    // Remove from cache
    objectCache.delete(`${spec.object}:${this.id}`);
  }
}

/**
 * QueryBuilder - Chainable query interface for model operations.
 */
export class QueryBuilder<T extends Model> {
  private readonly ModelClass: new (data: ModelData) => T;
  private readonly request: Request;
  private readonly spec: ModelSpec;
  private _filters: Filter[] = [];
  private _params: Record<string, unknown> = {};
  private _queryOptions: QueryOptions = {};

  constructor(
    ModelClass: new (data: ModelData) => T,
    request: Request,
    spec: ModelSpec
  ) {
    this.ModelClass = ModelClass;
    this.request = request;
    this.spec = spec;
  }

  private getEndpoint(): string {
    return this.spec.endpoint || '/' + pluralize(this.spec.object);
  }

  /** Add filter conditions */
  filterBy(...filters: (Filter | Record<string, unknown>)[]): this {
    for (const f of filters) {
      if ('key' in f && 'operator' in f) {
        this._filters.push(f as Filter);
      } else {
        // Key-value filter
        for (const [key, value] of Object.entries(f)) {
          this._filters.push({ key, operator: '', value });
        }
      }
    }
    return this;
  }

  /** Set query limit */
  limit(n: number): this {
    this._queryOptions.limit = n;
    return this;
  }

  /** Set query offset */
  offset(n: number): this {
    this._queryOptions.offset = n;
    return this;
  }

  /** Set order by field */
  orderBy(field: string): this {
    this._queryOptions.orderBy = field;
    return this;
  }

  /** Set group by field */
  groupBy(field: string): this {
    this._queryOptions.groupBy = field;
    return this;
  }

  /** Select specific fields */
  select(...fields: string[]): this {
    this._queryOptions.fields = fields;
    return this;
  }

  /** Execute query and return all results */
  async all(): Promise<T[]> {
    // Add polymorphic filters
    const filters = [...this._filters];
    if (this.spec.polymorphic) {
      for (const [key, value] of Object.entries(this.spec.polymorphic)) {
        filters.push({ key, operator: '', value });
      }
    }

    const response = await this.request.get(
      this.getEndpoint(),
      undefined,
      this._params,
      filters,
      this._queryOptions
    );

    // V2 API returns { object: 'list', values: [...] } for list responses
    let items: unknown[];
    const data = response.data as Record<string, unknown>;
    if (Array.isArray(data)) {
      items = data;
    } else if (data && data.object === 'list' && Array.isArray(data.values)) {
      items = data.values as unknown[];
    } else {
      items = [data];
    }
    return items.map(item => {
      const instance = new this.ModelClass(item as ModelData);
      instance.bindRequest(this.request);

      // Cache
      const id = instance.id;
      if (id) {
        objectCache.set(`${this.spec.object}:${id}`, instance);
      }

      return instance;
    });
  }

  /** Execute query and return first result */
  async first(): Promise<T | null> {
    this._queryOptions.limit = 1;
    const results = await this.all();
    return results.length > 0 ? results[0] : null;
  }
}

/**
 * ModelOperations - Static operations factory bound to a request instance.
 * Created by Session to provide create/get/filterBy/all operations.
 */
export class ModelOperations<T extends Model> {
  private readonly ModelClass: new (data: ModelData) => T;
  private readonly ModelStatic: typeof Model;
  private readonly request: Request;
  private readonly spec: ModelSpec;

  constructor(
    ModelClass: new (data: ModelData) => T,
    ModelStatic: typeof Model,
    request: Request
  ) {
    this.ModelClass = ModelClass;
    this.ModelStatic = ModelStatic;
    this.request = request;
    this.spec = ModelStatic.getMergedSpec();
  }

  /** Create a new object */
  async create(data: ModelData): Promise<T> {
    const body: ModelData = {
      ...data,
    };

    // Add polymorphic fields
    if (this.spec.polymorphic) {
      Object.assign(body, this.spec.polymorphic);
    }

    const endpoint = this.ModelStatic.getEndpoint();
    const response = await this.request.post(endpoint, body);

    const instance = new this.ModelClass(response.data as ModelData);
    instance.bindRequest(this.request);

    // Cache
    if (instance.id) {
      objectCache.set(`${this.spec.object}:${instance.id}`, instance);
    }

    return instance;
  }

  /** Get an object by ID */
  async get(id: string): Promise<T> {
    // Check cache first
    const cached = objectCache.get(`${this.spec.object}:${id}`);
    if (cached) return cached as T;

    const endpoint = this.ModelStatic.getEndpoint();
    const response = await this.request.get(endpoint, id);

    const instance = new this.ModelClass(response.data as ModelData);
    instance.bindRequest(this.request);

    // Cache
    objectCache.set(`${this.spec.object}:${id}`, instance);

    return instance;
  }

  /** Start a filter query */
  filterBy(...filters: (Filter | Record<string, unknown>)[]): QueryBuilder<T> {
    const qb = new QueryBuilder<T>(this.ModelClass, this.request, this.spec);
    return qb.filterBy(...filters);
  }

  /** Get all objects */
  async all(): Promise<T[]> {
    const qb = new QueryBuilder<T>(this.ModelClass, this.request, this.spec);
    return qb.all();
  }

  /** Select specific fields */
  select(...fields: string[]): QueryBuilder<T> {
    const qb = new QueryBuilder<T>(this.ModelClass, this.request, this.spec);
    return qb.select(...fields);
  }
}

/** Clear the object cache (useful for testing) */
export function clearObjectCache(): void {
  objectCache.clear();
}
