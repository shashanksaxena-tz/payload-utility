/**
 * Attr - Query filter builder for the Payload ARM framework.
 *
 * Provides a fluent API for building type-safe query filters
 * using comparison operators that serialize to Payload API query parameters.
 *
 * Usage:
 *   const attr = new Attr();
 *   attr.amount.gt(100)   // amount>100
 *   attr.status.eq('paid') // status=paid
 *   attr.payment_method.type.eq('card') // payment_method[type]=card
 */

export type FilterOperator = '' | '!' | '>' | '<' | '>=' | '<=' | '?*';

export interface Filter {
  key: string;
  operator: FilterOperator;
  value: unknown;
}

export class AttrChain {
  private readonly _path: string[];

  constructor(path: string[] = []) {
    this._path = path;
  }

  /**
   * Access nested attribute - returns a new chain with the extended path.
   */
  field(name: string): AttrChain {
    return new AttrChain([...this._path, name]);
  }

  /**
   * Dynamic property accessor using Proxy (for convenience).
   */
  private _buildKey(): string {
    if (this._path.length === 0) {
      throw new Error('Attr: Cannot create filter with empty path');
    }
    const [first, ...rest] = this._path;
    if (rest.length === 0) return first;
    return first + rest.map(p => `[${p}]`).join('');
  }

  /** Equal to (operator: '') */
  eq(value: unknown): Filter {
    return { key: this._buildKey(), operator: '', value };
  }

  /** Not equal (operator: '!') */
  ne(value: unknown): Filter {
    return { key: this._buildKey(), operator: '!', value };
  }

  /** Greater than (operator: '>') */
  gt(value: unknown): Filter {
    return { key: this._buildKey(), operator: '>', value };
  }

  /** Less than (operator: '<') */
  lt(value: unknown): Filter {
    return { key: this._buildKey(), operator: '<', value };
  }

  /** Greater than or equal (operator: '>=') */
  gte(value: unknown): Filter {
    return { key: this._buildKey(), operator: '>=', value };
  }

  /** Less than or equal (operator: '<=') */
  lte(value: unknown): Filter {
    return { key: this._buildKey(), operator: '<=', value };
  }

  /** Contains (operator: '?*') */
  contains(value: unknown): Filter {
    return { key: this._buildKey(), operator: '?*', value };
  }
}

/**
 * Create a proxy-based Attr for dynamic property access.
 * Allows: attr.amount.gt(100), attr.payment_method.type.eq('card')
 */
function createAttrProxy(path: string[] = []): AttrChain & Record<string, AttrChain> {
  const chain = new AttrChain(path);

  const methodNames = ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains', 'field'];

  return new Proxy(chain, {
    get(_target: AttrChain, prop: string | symbol): unknown {
      if (typeof prop === 'symbol') return undefined;

      // If it's a method on AttrChain, bind and return it
      if (methodNames.includes(prop)) {
        return (chain as unknown as Record<string, Function>)[prop].bind(chain);
      }

      // Otherwise, create a nested proxy for the next path segment
      return createAttrProxy([...path, prop]);
    },
  }) as AttrChain & Record<string, AttrChain>;
}

/**
 * The main Attr factory - create an attr instance for building filters.
 */
export const attr = createAttrProxy();

/**
 * Serialize a list of filters into query parameters.
 */
export function serializeFilters(filters: Filter[]): Record<string, string> {
  const params: Record<string, string> = {};

  for (const filter of filters) {
    const paramKey = filter.operator
      ? `${filter.key}${filter.operator}`
      : filter.key;

    let paramValue: string;
    if (filter.value instanceof Date) {
      paramValue = filter.value.toISOString();
    } else {
      paramValue = String(filter.value);
    }

    params[paramKey] = paramValue;
  }

  return params;
}
