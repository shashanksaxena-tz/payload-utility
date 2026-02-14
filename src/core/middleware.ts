/**
 * Middleware / Hooks system for the Payload SDK request lifecycle.
 *
 * Provides a composable pipeline that can intercept, modify, and observe
 * requests, responses, and errors as they flow through the SDK.
 */

/**
 * Context passed to before-request hooks. Represents the outgoing HTTP request
 * before it is sent. Hooks may mutate and return a modified context.
 */
export interface RequestContext {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

/**
 * Context passed to after-response hooks. Represents the API response
 * after it has been parsed. Hooks may mutate and return a modified context.
 */
export interface ResponseContext {
  statusCode: number;
  data: Record<string, unknown>;
  headers: Record<string, string>;
}

/**
 * A hook that runs before a request is sent.
 * Receives the request context and must return a (possibly modified) context.
 * May be synchronous or asynchronous.
 */
export type BeforeRequestHook = (
  ctx: RequestContext,
) => RequestContext | Promise<RequestContext>;

/**
 * A hook that runs after a response is received.
 * Receives the response context and the original request context.
 * Must return a (possibly modified) response context.
 */
export type AfterResponseHook = (
  res: ResponseContext,
  req: RequestContext,
) => ResponseContext | Promise<ResponseContext>;

/**
 * A hook that runs when an error occurs during the request lifecycle.
 * Receives the error and the original request context.
 * May transform the error by throwing a different one, suppress it by
 * returning void, or re-throw the original.
 */
export type ErrorHook = (
  err: Error,
  req: RequestContext,
) => void | Promise<void>;

/**
 * A middleware definition that can provide any combination of lifecycle hooks.
 */
export interface Middleware {
  /** Optional name for debugging/logging purposes. */
  name?: string;
  /** Runs before the HTTP request is dispatched. */
  before?: BeforeRequestHook;
  /** Runs after a successful HTTP response is received. */
  after?: AfterResponseHook;
  /** Runs when an error is thrown during the request lifecycle. */
  onError?: ErrorHook;
}

/**
 * MiddlewareChain manages an ordered list of middleware hooks and
 * executes them in sequence during the request lifecycle.
 *
 * - `before` hooks run in registration order (first registered = first to run).
 * - `after` hooks run in registration order.
 * - `onError` hooks run in registration order; if any hook throws, the new
 *   error replaces the original for subsequent hooks.
 *
 * @example
 * ```typescript
 * const chain = new MiddlewareChain();
 * chain.use({
 *   name: 'tracing',
 *   before: (ctx) => { ctx.headers['X-Trace-Id'] = uuid(); return ctx; },
 *   after: (res) => { logger.info('Response', res.statusCode); return res; },
 *   onError: (err) => { sentry.captureException(err); },
 * });
 * ```
 */
export class MiddlewareChain {
  private middlewares: Middleware[] = [];

  /**
   * Register a middleware. Hooks are executed in registration order.
   * Returns `this` for chaining.
   */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Remove all registered middleware.
   */
  clear(): void {
    this.middlewares = [];
  }

  /**
   * Return the number of registered middleware.
   */
  get size(): number {
    return this.middlewares.length;
  }

  /**
   * Run all `before` hooks in order, threading the request context
   * through each one. Returns the final (possibly modified) context.
   */
  async runBefore(ctx: RequestContext): Promise<RequestContext> {
    let current = ctx;
    for (const mw of this.middlewares) {
      if (mw.before) {
        current = await mw.before(current);
      }
    }
    return current;
  }

  /**
   * Run all `after` hooks in order, threading the response context
   * through each one. The original request context is passed as a
   * read-only reference for logging/correlation.
   */
  async runAfter(
    res: ResponseContext,
    req: RequestContext,
  ): Promise<ResponseContext> {
    let current = res;
    for (const mw of this.middlewares) {
      if (mw.after) {
        current = await mw.after(current, req);
      }
    }
    return current;
  }

  /**
   * Run all `onError` hooks in order. Each hook receives the current
   * error and the original request context.
   *
   * If a hook itself throws, that new error replaces the current error
   * for subsequent hooks and will ultimately be re-thrown.
   *
   * After all hooks have run, the (possibly transformed) error is re-thrown
   * so callers always see the failure unless a hook explicitly suppresses it
   * by not re-throwing (in which case the original is still re-thrown after
   * all hooks complete).
   */
  async runError(err: Error, req: RequestContext): Promise<void> {
    let currentError = err;
    for (const mw of this.middlewares) {
      if (mw.onError) {
        try {
          await mw.onError(currentError, req);
        } catch (hookError) {
          currentError = hookError instanceof Error
            ? hookError
            : new Error(String(hookError));
        }
      }
    }
    throw currentError;
  }
}
