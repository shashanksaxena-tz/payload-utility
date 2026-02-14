import {
  MiddlewareChain,
  RequestContext,
  ResponseContext,
} from '../../../src/core/middleware';

function makeReqCtx(overrides?: Partial<RequestContext>): RequestContext {
  return {
    method: 'GET',
    path: '/customers',
    headers: {},
    ...overrides,
  };
}

function makeResCtx(overrides?: Partial<ResponseContext>): ResponseContext {
  return {
    statusCode: 200,
    data: {},
    headers: {},
    ...overrides,
  };
}

describe('MiddlewareChain', () => {
  let chain: MiddlewareChain;

  beforeEach(() => {
    chain = new MiddlewareChain();
  });

  describe('use and size', () => {
    it('should start empty', () => {
      expect(chain.size).toBe(0);
    });

    it('should register middleware and increment size', () => {
      chain.use({ name: 'a' });
      chain.use({ name: 'b' });
      expect(chain.size).toBe(2);
    });

    it('should support chaining', () => {
      const result = chain.use({ name: 'a' }).use({ name: 'b' });
      expect(result).toBe(chain);
    });
  });

  describe('clear', () => {
    it('should remove all middleware', () => {
      chain.use({ name: 'a' }).use({ name: 'b' });
      chain.clear();
      expect(chain.size).toBe(0);
    });
  });

  describe('runBefore', () => {
    it('should return unmodified context when no middleware registered', async () => {
      const ctx = makeReqCtx();
      const result = await chain.runBefore(ctx);
      expect(result).toBe(ctx);
    });

    it('should run before hooks in registration order', async () => {
      const order: string[] = [];

      chain.use({
        name: 'first',
        before: (ctx) => { order.push('first'); return ctx; },
      });
      chain.use({
        name: 'second',
        before: (ctx) => { order.push('second'); return ctx; },
      });

      await chain.runBefore(makeReqCtx());
      expect(order).toEqual(['first', 'second']);
    });

    it('should allow hooks to modify request context', async () => {
      chain.use({
        before: (ctx) => ({
          ...ctx,
          headers: { ...ctx.headers, 'X-Custom': 'value' },
        }),
      });

      const result = await chain.runBefore(makeReqCtx());
      expect(result.headers['X-Custom']).toBe('value');
    });

    it('should thread context through multiple hooks', async () => {
      chain.use({
        before: (ctx) => ({ ...ctx, headers: { ...ctx.headers, 'X-A': '1' } }),
      });
      chain.use({
        before: (ctx) => ({ ...ctx, headers: { ...ctx.headers, 'X-B': '2' } }),
      });

      const result = await chain.runBefore(makeReqCtx());
      expect(result.headers['X-A']).toBe('1');
      expect(result.headers['X-B']).toBe('2');
    });

    it('should skip middleware without a before hook', async () => {
      chain.use({ name: 'no-before' });
      chain.use({
        before: (ctx) => ({ ...ctx, headers: { ...ctx.headers, 'X-Added': 'yes' } }),
      });

      const result = await chain.runBefore(makeReqCtx());
      expect(result.headers['X-Added']).toBe('yes');
    });

    it('should support async before hooks', async () => {
      chain.use({
        before: async (ctx) => {
          return { ...ctx, headers: { ...ctx.headers, 'X-Async': 'done' } };
        },
      });

      const result = await chain.runBefore(makeReqCtx());
      expect(result.headers['X-Async']).toBe('done');
    });
  });

  describe('runAfter', () => {
    it('should return unmodified response when no middleware registered', async () => {
      const req = makeReqCtx();
      const res = makeResCtx();
      const result = await chain.runAfter(res, req);
      expect(result).toBe(res);
    });

    it('should run after hooks in registration order', async () => {
      const order: string[] = [];

      chain.use({
        after: (res) => { order.push('first'); return res; },
      });
      chain.use({
        after: (res) => { order.push('second'); return res; },
      });

      await chain.runAfter(makeResCtx(), makeReqCtx());
      expect(order).toEqual(['first', 'second']);
    });

    it('should allow hooks to modify response context', async () => {
      chain.use({
        after: (res) => ({
          ...res,
          data: { ...res.data, injected: true },
        }),
      });

      const result = await chain.runAfter(makeResCtx(), makeReqCtx());
      expect(result.data.injected).toBe(true);
    });

    it('should pass both response and request context to after hooks', async () => {
      let capturedReq: RequestContext | null = null;

      chain.use({
        after: (res, req) => { capturedReq = req; return res; },
      });

      const req = makeReqCtx({ path: '/test' });
      await chain.runAfter(makeResCtx(), req);
      expect(capturedReq).toBe(req);
    });
  });

  describe('runError', () => {
    it('should re-throw the error when no error hooks registered', async () => {
      const err = new Error('test error');
      await expect(chain.runError(err, makeReqCtx())).rejects.toThrow('test error');
    });

    it('should run error hooks in registration order', async () => {
      const order: string[] = [];

      chain.use({
        onError: () => { order.push('first'); },
      });
      chain.use({
        onError: () => { order.push('second'); },
      });

      await expect(chain.runError(new Error('test'), makeReqCtx())).rejects.toThrow();
      expect(order).toEqual(['first', 'second']);
    });

    it('should pass error and request context to error hooks', async () => {
      let capturedErr: Error | null = null;
      let capturedReq: RequestContext | null = null;

      chain.use({
        onError: (err, req) => { capturedErr = err; capturedReq = req; },
      });

      const err = new Error('original');
      const req = makeReqCtx({ path: '/fail' });

      await expect(chain.runError(err, req)).rejects.toThrow();
      expect(capturedErr).toBe(err);
      expect(capturedReq).toBe(req);
    });

    it('should replace error when an error hook throws', async () => {
      chain.use({
        onError: () => { throw new Error('replaced'); },
      });

      await expect(chain.runError(new Error('original'), makeReqCtx()))
        .rejects.toThrow('replaced');
    });

    it('should pass replaced error to subsequent hooks', async () => {
      let secondHookError: Error | null = null;

      chain.use({
        onError: () => { throw new Error('replaced'); },
      });
      chain.use({
        onError: (err) => { secondHookError = err; },
      });

      await expect(chain.runError(new Error('original'), makeReqCtx())).rejects.toThrow();
      expect(secondHookError!.message).toBe('replaced');
    });
  });

  describe('multiple middleware compose correctly', () => {
    it('should compose before, after, and error hooks from multiple middleware', async () => {
      const log: string[] = [];

      chain.use({
        name: 'logger',
        before: (ctx) => { log.push('logger:before'); return ctx; },
        after: (res) => { log.push('logger:after'); return res; },
        onError: () => { log.push('logger:error'); },
      });

      chain.use({
        name: 'auth',
        before: (ctx) => {
          log.push('auth:before');
          return { ...ctx, headers: { ...ctx.headers, Authorization: 'Bearer x' } };
        },
        after: (res) => { log.push('auth:after'); return res; },
      });

      const req = makeReqCtx();
      const modifiedReq = await chain.runBefore(req);
      expect(modifiedReq.headers['Authorization']).toBe('Bearer x');
      expect(log).toEqual(['logger:before', 'auth:before']);

      log.length = 0;
      await chain.runAfter(makeResCtx(), modifiedReq);
      expect(log).toEqual(['logger:after', 'auth:after']);

      log.length = 0;
      await expect(chain.runError(new Error('fail'), req)).rejects.toThrow();
      expect(log).toEqual(['logger:error']);
    });
  });
});
