# Future Improvements Plan - Payload Utility

## Priority 1: Production Readiness

### 1.1 Retry Logic with Exponential Backoff
- Add configurable retry policy to Request class
- Default: 3 retries with exponential backoff (1s, 2s, 4s)
- Retry on: 429 (rate limited), 503 (service unavailable), network errors
- Do NOT retry on: 400, 401, 403, 404 (client errors)

### 1.2 Connection Pooling
- Replace per-request connections with HTTP keep-alive agent
- Use `http.Agent` / `https.Agent` with `keepAlive: true`
- Configure max sockets per host

### 1.3 Request Timeout Configuration
- Per-operation timeout overrides
- Separate connect timeout vs read timeout
- Graceful timeout handling with descriptive errors

### 1.4 Rate Limit Awareness
- Parse `Retry-After` header from 429 responses
- Implement client-side rate limit tracking
- Optional request queuing when approaching rate limits

## Priority 2: Developer Experience

### 2.1 Auto-Pagination
- Add `allPaginated()` method that auto-fetches all pages
- Async iterator support: `for await (const customer of session.Customer.iterate())`
- Configurable page size

### 2.2 Webhook Signature Verification
- `Webhook.verifySignature(payload, signature, secret)` static method
- HMAC-SHA256 signature validation
- Timestamp-based replay attack prevention

### 2.3 TypeScript Strict Mode Enhancements
- Add branded types for IDs (e.g., `CustomerId`, `TransactionId`)
- Improve generic constraints on ModelOperations
- Add discriminated union types for polymorphic objects

### 2.4 Logging and Observability
- Pluggable logger interface (console, winston, pino, etc.)
- Request/response logging at configurable verbosity levels
- Performance metrics (request duration, cache hit rate)

## Priority 3: Advanced Features

### 3.1 Batch Operations
- `session.Customer.createMany([...])` for bulk creation
- Batch update and delete operations
- Transaction-level atomicity where API supports it

### 3.2 Idempotency Support
- Automatic `Idempotency-Key` header generation
- Configurable idempotency key strategies
- Key-based deduplication for retry safety

### 3.3 Enhanced Ledger Manager
- Audit trail logging for all ledger operations
- Configurable rounding modes for financial calculations
- Multi-currency support with exchange rate tracking
- Period-based closing and opening balances
- Report generation (trial balance, income statement)

### 3.4 Webhook Event Processing
- Event deserialization into typed objects
- Event handler registration (`session.on('payment.created', handler)`)
- Dead letter queue for failed processing

## Priority 4: Ecosystem Integration

### 4.1 Framework Adapters
- Express.js middleware for webhook handling
- Fastify plugin
- NestJS module

### 4.2 Testing Utilities
- Mock server as standalone package
- Factory functions for test data generation
- Snapshot testing helpers for API responses

### 4.3 CLI Tool
- Command-line interface for common operations
- `payload customers list --limit 10`
- `payload payments create --amount 100`

## Priority 5: Performance Optimization

### 5.1 LRU Cache with TTL
- Replace unbounded Map cache with LRU cache
- Configurable max size and TTL per object type
- Cache statistics and monitoring

### 5.2 Request Batching
- Automatic request coalescing for concurrent reads of the same resource
- Configurable batch window

### 5.3 Streaming Support
- Stream large result sets instead of loading all into memory
- Support for server-sent events (SSE) for real-time updates

## Implementation Timeline

| Phase | Items | Estimated Effort |
|-------|-------|-----------------|
| Phase 1 | Retry, connection pooling, rate limiting | Foundation |
| Phase 2 | Auto-pagination, webhook verification, logging | Developer experience |
| Phase 3 | Batch ops, idempotency, enhanced ledger | Advanced features |
| Phase 4 | Framework adapters, CLI, testing utils | Ecosystem |
| Phase 5 | LRU cache, request batching, streaming | Performance |
