/**
 * Retry, Circuit Breaker, and Rate Limiter for the Payload ARM framework.
 *
 * Provides resilience primitives for API requests:
 * - RetryExecutor: exponential backoff with jitter for transient failures
 * - CircuitBreaker: fail-fast when a downstream service is unhealthy
 * - RateLimiter: token-bucket throttling to stay within API rate limits
 */

import { PayloadError } from './exceptions';

// ---------------------------------------------------------------------------
// Retry Strategy
// ---------------------------------------------------------------------------

export interface RetryStrategy {
  /** Maximum number of retry attempts (not counting the initial request). */
  maxRetries: number;
  /** Base delay in milliseconds before the first retry. */
  baseDelay: number;
  /** Maximum delay in milliseconds between retries. */
  maxDelay: number;
  /** Multiplier applied to the delay after each attempt. */
  backoffMultiplier: number;
  /** HTTP status codes that are eligible for retry. */
  retryableStatuses: number[];
}

export const DEFAULT_RETRY_STRATEGY: Readonly<RetryStrategy> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [429, 500, 502, 503, 504],
};

// ---------------------------------------------------------------------------
// RetryExecutor
// ---------------------------------------------------------------------------

export class RetryExecutor {
  private readonly strategy: RetryStrategy;

  constructor(strategy: Partial<RetryStrategy> = {}) {
    this.strategy = { ...DEFAULT_RETRY_STRATEGY, ...strategy };
  }

  /**
   * Execute `fn` with automatic retries on transient failures.
   *
   * On each failed attempt the executor checks whether the error is retryable
   * and whether the attempt budget has been exhausted. If eligible, it waits
   * for an exponentially-increasing delay (with jitter) before retrying.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.strategy.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error;

        if (!this.shouldRetry(error, attempt)) {
          throw error;
        }

        const delay = this.getDelay(attempt);
        await RetryExecutor.sleep(delay);
      }
    }

    // This line is only reachable if maxRetries < 0, but satisfies the
    // compiler and acts as a safety net.
    throw lastError;
  }

  /**
   * Determine whether the given error is retryable and the attempt budget
   * has not been exhausted.
   */
  shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.strategy.maxRetries) {
      return false;
    }

    // Retry on network / timeout errors (no status code).
    if (error instanceof Error && !(error instanceof PayloadError)) {
      return true;
    }

    // Retry on configured HTTP status codes.
    if (error instanceof PayloadError && error.statusCode !== undefined) {
      return this.strategy.retryableStatuses.includes(error.statusCode);
    }

    return false;
  }

  /**
   * Calculate the delay for the given attempt number using exponential
   * back-off with full jitter.
   *
   * delay = random(0, min(maxDelay, baseDelay * multiplier^attempt))
   */
  getDelay(attempt: number): number {
    const exponential =
      this.strategy.baseDelay *
      Math.pow(this.strategy.backoffMultiplier, attempt);
    const capped = Math.min(exponential, this.strategy.maxDelay);

    // Full jitter: uniform random in [0, capped].
    return Math.floor(Math.random() * (capped + 1));
  }

  /** Awaitable sleep helper — extracted so tests can stub it. */
  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before the circuit opens. */
  failureThreshold: number;
  /** Time in milliseconds to wait before transitioning from OPEN to HALF_OPEN. */
  resetTimeout: number;
}

const DEFAULT_CIRCUIT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 60000,
};

export class CircuitBreaker {
  private readonly options: CircuitBreakerOptions;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...options };
  }

  /**
   * Execute `fn` through the circuit breaker.
   *
   * - **CLOSED** — requests flow normally. Failures increment the counter;
   *   when the threshold is reached the circuit transitions to OPEN.
   * - **OPEN** — requests are rejected immediately with an error. After
   *   `resetTimeout` ms the circuit transitions to HALF_OPEN.
   * - **HALF_OPEN** — a single probe request is allowed through. On success
   *   the circuit closes; on failure it re-opens.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error(
          'Circuit breaker is OPEN — request rejected. ' +
            `Retry after ${this.options.resetTimeout}ms.`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /** Return the current circuit state. */
  getState(): CircuitState {
    return this.state;
  }

  /** Manually reset the circuit breaker to CLOSED. */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  /** Return the current consecutive failure count. */
  getFailureCount(): number {
    return this.failureCount;
  }

  // -- internal helpers -----------------------------------------------------

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }
}

// ---------------------------------------------------------------------------
// Rate Limiter (Token Bucket)
// ---------------------------------------------------------------------------

export interface RateLimiterOptions {
  /** Maximum number of tokens the bucket can hold. */
  maxTokens: number;
  /** Number of tokens added to the bucket per second. */
  refillRate: number;
}

const DEFAULT_RATE_LIMITER_OPTIONS: RateLimiterOptions = {
  maxTokens: 10,
  refillRate: 10,
};

export class RateLimiter {
  private readonly options: RateLimiterOptions;
  private tokens: number;
  private lastRefillTime: number;
  private waitQueue: Array<() => void> = [];

  constructor(options: Partial<RateLimiterOptions> = {}) {
    this.options = { ...DEFAULT_RATE_LIMITER_OPTIONS, ...options };
    this.tokens = this.options.maxTokens;
    this.lastRefillTime = Date.now();
  }

  /**
   * Wait until a token is available, then consume it.
   *
   * If the bucket is empty the caller is queued and will be resolved as
   * soon as a token becomes available (via the internal refill timer).
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }

    // Wait for the next token to become available.
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
      this.scheduleRefill();
    });
  }

  /**
   * Non-blocking attempt to acquire a token.
   *
   * Returns `true` and consumes a token if one is available, or `false`
   * without blocking if the bucket is empty.
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }

    return false;
  }

  /** Return the number of tokens currently available. */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  // -- internal helpers -----------------------------------------------------

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefillTime) / 1000; // seconds
    const newTokens = elapsed * this.options.refillRate;

    if (newTokens > 0) {
      this.tokens = Math.min(
        this.options.maxTokens,
        this.tokens + newTokens
      );
      this.lastRefillTime = now;
    }
  }

  private scheduleRefill(): void {
    // Time until the next whole token is available.
    const msPerToken = 1000 / this.options.refillRate;

    setTimeout(() => {
      this.refill();
      this.drainQueue();
    }, msPerToken);
  }

  private drainQueue(): void {
    while (this.waitQueue.length > 0 && this.tokens >= 1) {
      this.tokens--;
      const resolve = this.waitQueue.shift()!;
      resolve();
    }

    // If there are still waiters, schedule another refill cycle.
    if (this.waitQueue.length > 0) {
      this.scheduleRefill();
    }
  }
}
