# Security Review - Payload Utility

## Overview

This document reviews the security posture of the Payload Utility SDK, covering authentication, data handling, input validation, and potential attack vectors.

## Authentication Security

### API Key Handling
- **Status**: PASS
- API keys are validated against expected format (`secret_key_*` / `client_key_*`)
- Keys are transmitted via HTTP Basic Auth (Base64-encoded), which is standard for Payload's API
- `getMaskedApiKey()` prevents accidental logging of full API keys
- Keys are not stored in plaintext files (`.env` is in `.gitignore`)

### Recommendations
- Consider adding API key rotation support
- Implement key expiry awareness for ClientTokens
- Add a `clearSession()` method to explicitly zero-out key references

## Input Validation

### URL/ID Sanitization
- **Status**: PASS
- `sanitizeId()` uses `encodeURIComponent` and strips dangerous characters
- Prevents path traversal attacks via ID injection (e.g., `../../admin`)
- Query parameters are properly encoded via Node.js `URL` API

### Request Body
- **Status**: PASS (with notes)
- JSON serialization is handled by `JSON.stringify()` (safe)
- No raw string interpolation in URL construction
- Body content is sent as `application/json` with proper Content-Type header

### Potential Risk: Server-Side Request Forgery (SSRF)
- **Status**: LOW RISK
- The `apiUrl` is configurable via `SessionConfig.apiUrl`
- An attacker who controls the config could redirect API calls to an arbitrary server
- **Mitigation**: The API URL should be validated or restricted to known Payload domains in production

## Data Handling

### Sensitive Data
- **Status**: REVIEW NEEDED
- Card numbers (`card_number`) are passed through the SDK as plain strings
- PCI DSS compliance requires tokenization before card data reaches the merchant's server
- The SDK should be used with Payload's client-side tokenization (PaymentForm/ClientToken) for PCI compliance

### Object Cache
- **Status**: ACCEPTABLE
- The identity map cache (`objectCache`) holds object references in memory
- No TTL or size limits - could grow unbounded in long-running processes
- Sensitive data (card numbers, SSN) may persist in cache

### Recommendations
- Add `clearObjectCache()` calls after operations involving sensitive data
- Consider implementing TTL-based cache eviction
- Mask sensitive fields (card_number, ssn) in `toJSON()` output

## Error Handling

### Exception Hierarchy
- **Status**: PASS
- Errors are properly typed and mapped from HTTP status codes
- `TransactionDeclined` preserves transaction details for debugging
- No sensitive data is exposed in error messages

### Error Propagation
- **Status**: PASS
- HTTP errors are caught and wrapped in typed exceptions
- JSON parse errors produce `UnknownResponse` (safe fallback)
- Network errors propagate as standard Node.js errors

## Transport Security

### HTTPS
- **Status**: PASS
- Default API URL uses HTTPS (`https://api.payload.co`)
- The Request module supports both HTTP and HTTPS transports
- HTTP should only be used for local development/testing

### Headers
- **Status**: PASS
- `X-Request-Id` is generated per-request for tracing
- `User-Agent` identifies the SDK version
- `X-API-Version` is set when specified

### Recommendations
- Enforce HTTPS-only in production mode
- Add certificate pinning option for high-security deployments
- Implement request signing for webhook deliveries

## Injection Vulnerabilities

### SQL Injection
- **Not Applicable**: SDK communicates via REST API, not direct database access

### Command Injection
- **Status**: PASS
- No shell execution or `exec()` calls in the codebase
- All external communication is via HTTP/HTTPS

### XSS
- **Not Applicable**: SDK is server-side only, no HTML rendering

### Prototype Pollution
- **Status**: PASS
- `deepClone()` uses `Object.entries()` iteration (safe)
- No use of `Object.assign()` with untrusted input on prototypes

## Ledger Security

### Double-Entry Integrity
- **Status**: PASS
- `createBalancedEntry()` validates debit == credit before creation
- `createMultiLegEntry()` validates total debits == total credits
- Negative amounts are rejected
- Same-account self-transfers are rejected
- Reversal entries use the reversal pattern (no mutation of existing entries)

### Recommendations
- Add idempotency keys to prevent duplicate ledger entries
- Implement audit logging for all ledger operations
- Add transaction-level locking for concurrent ledger operations

## Overall Risk Assessment

| Category | Risk Level | Notes |
|----------|-----------|-------|
| Authentication | LOW | Standard Basic Auth, key validation |
| Input Validation | LOW | Proper sanitization and encoding |
| Data Handling | MEDIUM | PCI compliance depends on usage pattern |
| Transport | LOW | HTTPS by default |
| Injection | LOW | No injection vectors identified |
| Ledger Integrity | LOW | Strong validation, immutable entries |

## Summary

The Payload Utility SDK follows security best practices for a payment gateway SDK:
- No critical vulnerabilities identified
- Input sanitization is properly implemented
- Authentication follows the standard Payload pattern
- The main area requiring attention is PCI DSS compliance guidance for integrators
