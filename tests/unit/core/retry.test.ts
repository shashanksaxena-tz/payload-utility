import {
  RetryExecutor,
  CircuitBreaker,
  CircuitState,
  RateLimiter,
} from '../../../src/core/retry';
import { PayloadError, TooManyRequests, InternalServerError, BadRequest } from '../../../src/core/exceptions';

// Stub out sleep to make tests fast
beforeEach(() => {
  jest.spyOn(RetryExecutor, 'sleep').mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('RetryExecutor', () => {
  describe('successful execution', () => {
    it('should return result on first successful call', async () => {
      const executor = new RetryExecutor();
      const result = await executor.execute(async () => 42);
      expect(result).toBe(42);
    });

    it('should not retry on success', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      const executor = new RetryExecutor();
      await executor.execute(fn);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('retries on retryable errors', () => {
    it('should retry on network errors (non-PayloadError)', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('ok');

      const executor = new RetryExecutor({ maxRetries: 3 });
      const result = await executor.execute(fn);

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on retryable HTTP status codes', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new TooManyRequests('rate limited', { status_code: 429 }))
        .mockResolvedValue('ok');

      const executor = new RetryExecutor({ maxRetries: 3 });
      const result = await executor.execute(fn);

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 errors', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new InternalServerError('server error', { status_code: 500 }))
        .mockResolvedValue('ok');

      const executor = new RetryExecutor({ maxRetries: 3 });
      const result = await executor.execute(fn);

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries and throw the last error', async () => {
      const error = new TooManyRequests('rate limited', { status_code: 429 });
      const fn = jest.fn().mockRejectedValue(error);

      const executor = new RetryExecutor({ maxRetries: 2 });
      await expect(executor.execute(fn)).rejects.toThrow('rate limited');
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
  });

  describe('does not retry non-retryable errors', () => {
    it('should not retry 400 BadRequest', async () => {
      const error = new BadRequest('bad request', { status_code: 400 });
      const fn = jest.fn().mockRejectedValue(error);

      const executor = new RetryExecutor({ maxRetries: 3 });
      await expect(executor.execute(fn)).rejects.toThrow('bad request');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry PayloadError with non-retryable status', async () => {
      const error = new PayloadError('not found', { status_code: 404 });
      const fn = jest.fn().mockRejectedValue(error);

      const executor = new RetryExecutor({ maxRetries: 3 });
      await expect(executor.execute(fn)).rejects.toThrow('not found');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('exponential backoff', () => {
    it('should calculate increasing delays', () => {
      const executor = new RetryExecutor({
        baseDelay: 100,
        backoffMultiplier: 2,
        maxDelay: 10000,
      });

      // getDelay uses random jitter, so just verify it's within bounds
      for (let attempt = 0; attempt < 5; attempt++) {
        const delay = executor.getDelay(attempt);
        const maxExpected = Math.min(100 * Math.pow(2, attempt), 10000);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(maxExpected);
      }
    });

    it('should cap delay at maxDelay', () => {
      const executor = new RetryExecutor({
        baseDelay: 1000,
        backoffMultiplier: 10,
        maxDelay: 5000,
      });

      // At attempt 3, exponential would be 1000 * 10^3 = 1_000_000 but capped at 5000
      const delay = executor.getDelay(3);
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  describe('shouldRetry', () => {
    it('should return false when attempt >= maxRetries', () => {
      const executor = new RetryExecutor({ maxRetries: 2 });
      expect(executor.shouldRetry(new Error('fail'), 2)).toBe(false);
    });

    it('should return true for plain Error (network error)', () => {
      const executor = new RetryExecutor({ maxRetries: 3 });
      expect(executor.shouldRetry(new Error('timeout'), 0)).toBe(true);
    });

    it('should return true for retryable PayloadError status', () => {
      const executor = new RetryExecutor({ maxRetries: 3 });
      const error = new TooManyRequests('rate limited', { status_code: 429 });
      expect(executor.shouldRetry(error, 0)).toBe(true);
    });

    it('should return false for non-retryable PayloadError status', () => {
      const executor = new RetryExecutor({ maxRetries: 3 });
      const error = new BadRequest('bad', { status_code: 400 });
      expect(executor.shouldRetry(error, 0)).toBe(false);
    });
  });
});

describe('CircuitBreaker', () => {
  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      const cb = new CircuitBreaker();
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.getFailureCount()).toBe(0);
    });
  });

  describe('CLOSED state', () => {
    it('should pass through successful calls', async () => {
      const cb = new CircuitBreaker();
      const result = await cb.execute(async () => 'ok');
      expect(result).toBe('ok');
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should count failures without opening below threshold', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });

      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      expect(cb.getFailureCount()).toBe(1);
      expect(cb.getState()).toBe(CircuitState.CLOSED);

      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      expect(cb.getFailureCount()).toBe(2);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reset failure count on success', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 5 });

      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      expect(cb.getFailureCount()).toBe(1);

      await cb.execute(async () => 'ok');
      expect(cb.getFailureCount()).toBe(0);
    });
  });

  describe('opens after threshold failures', () => {
    it('should transition to OPEN after reaching failure threshold', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });

      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();

      expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it('should reject immediately when OPEN', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 60000 });

      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      expect(cb.getState()).toBe(CircuitState.OPEN);

      await expect(cb.execute(async () => 'should not run')).rejects.toThrow(
        /Circuit breaker is OPEN/
      );
    });
  });

  describe('resets after timeout', () => {
    it('should transition to HALF_OPEN after resetTimeout', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 100 });

      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Simulate time passing
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 200);

      // Next call should be allowed (HALF_OPEN probe)
      const result = await cb.execute(async () => 'recovered');
      expect(result).toBe('recovered');
      expect(cb.getState()).toBe(CircuitState.CLOSED);

      jest.restoreAllMocks();
    });

    it('should re-open on failure in HALF_OPEN state', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 100 });

      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 200);

      await expect(cb.execute(async () => { throw new Error('still broken'); })).rejects.toThrow();
      expect(cb.getState()).toBe(CircuitState.OPEN);

      jest.restoreAllMocks();
    });
  });

  describe('manual reset', () => {
    it('should reset to CLOSED state', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });

      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      expect(cb.getState()).toBe(CircuitState.OPEN);

      cb.reset();
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.getFailureCount()).toBe(0);
    });
  });
});

describe('RateLimiter', () => {
  describe('tryAcquire', () => {
    it('should succeed when tokens are available', () => {
      const limiter = new RateLimiter({ maxTokens: 5, refillRate: 1 });
      expect(limiter.tryAcquire()).toBe(true);
    });

    it('should fail when all tokens are consumed', () => {
      const limiter = new RateLimiter({ maxTokens: 2, refillRate: 1 });
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(false);
    });
  });

  describe('getAvailableTokens', () => {
    it('should start at maxTokens', () => {
      const limiter = new RateLimiter({ maxTokens: 10, refillRate: 5 });
      expect(limiter.getAvailableTokens()).toBe(10);
    });

    it('should decrease after acquiring', () => {
      const limiter = new RateLimiter({ maxTokens: 5, refillRate: 1 });
      limiter.tryAcquire();
      limiter.tryAcquire();
      expect(limiter.getAvailableTokens()).toBeLessThanOrEqual(3);
    });
  });

  describe('acquire (async)', () => {
    it('should resolve immediately when tokens available', async () => {
      const limiter = new RateLimiter({ maxTokens: 5, refillRate: 100 });
      await limiter.acquire();
      // Should not hang
    });

    it('should wait and resolve when tokens refill', async () => {
      const limiter = new RateLimiter({ maxTokens: 1, refillRate: 100 });

      // Consume the only token
      await limiter.acquire();

      // Next acquire should wait for refill, which happens quickly at 100/sec
      const start = Date.now();
      await limiter.acquire();
      // Should complete quickly (under 100ms)
      expect(Date.now() - start).toBeLessThan(200);
    }, 1000);
  });
});
