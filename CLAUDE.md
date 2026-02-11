# Payload Utility

## Project Overview
ARM-based TypeScript SDK for the Payload payment gateway (payload.co). Implements Spec01 (core payment objects) and Spec02 (advanced billing, invoicing, entities, webhooks, ledger).

## Commands
- `npm run build` - Compile TypeScript to dist/
- `npm test` - Run all tests with coverage
- `npm run test:unit` - Run unit tests only
- `npm run test:mock` - Run integration tests with mock server

## Architecture
- `src/core/` - ARM framework (Session, Model, Request, Attr, Exceptions)
- `src/spec01/` - Core objects (Transaction, Payment, Customer, PaymentMethod)
- `src/spec02/` - Advanced objects (Billing, Invoice, Entity, Transfer, Webhook, Ledger)
- `src/ledger/` - Two-way (double-entry) ledger management
- `tests/` - Unit and integration tests with mock Payload API server

## Key Patterns
- Polymorphic spec merging via prototype chain (Payment extends Transaction)
- WeakMap-based per-class spec caching
- Proxy-based Attr filter builder for query construction
- Session-scoped ModelOperations binding
