# Architecture Review - Payload Utility

## System Overview

The Payload Utility implements an **API Relational Model (ARM)** framework for the Payload payment gateway (payload.co). It follows the same architectural pattern used by the official Payload SDKs (payload-node, payload-python, payload-java, etc.).

## Architecture Layers

```
┌─────────────────────────────────────────────┐
│            Application Layer                │
│     (LedgerManager, Business Logic)         │
├─────────────────────────────────────────────┤
│          Spec02: Advanced Objects           │
│  Billing, Invoice, Entity, Transfer,        │
│  Webhook, Ledger, Processing, Intent        │
├─────────────────────────────────────────────┤
│          Spec01: Core Objects               │
│  Transaction, Payment, Customer,            │
│  PaymentMethod, Card, BankAccount           │
├─────────────────────────────────────────────┤
│           Core ARM Framework                │
│  Session, Model, Request, Attr, Exceptions  │
├─────────────────────────────────────────────┤
│         Transport (Node.js HTTP)            │
└─────────────────────────────────────────────┘
```

### 1. Core ARM Framework (`src/core/`)

| Component | Responsibility |
|-----------|---------------|
| **Session** | Authentication binding, API key management, object operation factory |
| **Model** | Base ORM-like class with CRUD operations, polymorphic spec merging, identity map caching |
| **Request** | HTTP request builder, URL construction, auth headers, response parsing, error mapping |
| **Attr** | Proxy-based query filter builder with operator overloading |
| **Exceptions** | HTTP status code-mapped error hierarchy |
| **Utils** | Query string serialization, deep clone, pluralization, URL building, ID sanitization |

### 2. Spec01: Core Objects (`src/spec01/`)

Fundamental payment processing types following the Payload API object hierarchy:
- **Transaction hierarchy** (polymorphic): Transaction > Payment, Refund, Credit, Deposit
- **PaymentMethod hierarchy** (polymorphic): PaymentMethod > Card, BankAccount
- **Account types**: Account, Customer
- **Authentication**: AccessToken, ClientToken

### 3. Spec02: Advanced Objects (`src/spec02/`)

Extended business objects for the full Payload API surface:
- **Billing**: BillingSchedule, BillingCharge
- **Invoicing**: Invoice, InvoiceItem, LineItem (> ChargeItem, PaymentItem)
- **Webhooks**: Webhook, WebhookLog
- **Business entities (v2)**: Entity, Stakeholder, Profile, Org
- **Fund management**: Transfer, ProcessingAccount, ProcessingAgreement
- **Payment flows**: PaymentLink, Intent
- **Accounting**: Ledger (TransactionLedger)

### 4. Ledger Management (`src/ledger/`)

Double-entry bookkeeping layer built on top of the Ledger API object:
- Balanced debit/credit entry creation
- Multi-leg transaction support
- Account balance computation
- Reconciliation and imbalance detection
- Reversal entries for corrections

## Key Design Decisions

### 1. Polymorphic Spec Pattern
Objects use a `static spec` definition merged up the prototype chain. This enables:
- Automatic type discrimination (e.g., `Payment` adds `type=payment` filter)
- Endpoint sharing (e.g., all Transaction subtypes use `/transactions`)
- Clean inheritance without duplicating configuration

### 2. WeakMap-Based Spec Caching
The merged spec cache uses `WeakMap<Function, ModelSpec>` keyed by class constructor. This avoids the static property sharing issue where subclasses would inherit a parent's cached spec.

### 3. Identity Map Pattern
The `objectCache` (Map) ensures that fetching the same object ID returns the same instance, maintaining reference consistency and reducing redundant API calls.

### 4. Session-Scoped Operations
All API operations are scoped to a `Session` instance that binds the API key and configuration. This allows multiple concurrent sessions with different credentials.

### 5. Proxy-Based Attr
The filter builder uses ES6 Proxy for dynamic property chaining (`attr.amount.gt(100)`), providing a fluent API that mimics the Python SDK's operator overloading.

## Data Flow

```
User Code
  │
  ├─> Session.Customer.create({...})
  │     │
  │     ├─> ModelOperations.create()
  │     │     │
  │     │     ├─> Merges polymorphic fields into body
  │     │     ├─> Request.post(endpoint, body)
  │     │     │     │
  │     │     │     ├─> Builds URL with query params
  │     │     │     ├─> Adds Basic Auth header
  │     │     │     ├─> HTTP POST to Payload API
  │     │     │     └─> Parses response / maps errors
  │     │     │
  │     │     ├─> Creates Model instance from response
  │     │     ├─> Binds request instance for future CRUD
  │     │     └─> Caches in identity map
  │     │
  │     └─> Returns typed Model instance
  │
  ├─> customer.update({...})
  │     └─> Same flow via instance method
  │
  └─> Session.Customer.filterBy(attr.name.eq('Jane'))
        └─> QueryBuilder.filterBy() → .all() → filtered GET request
```

## Strengths

1. **Consistent with official SDKs**: Follows the same ARM pattern as payload-node and payload-python
2. **Type safety**: Full TypeScript with typed accessors and interfaces
3. **Polymorphic dispatch**: Clean inheritance model for Transaction and PaymentMethod hierarchies
4. **Extensible**: Adding new API objects requires only a new class with a spec definition
5. **Testable**: Clean separation of concerns allows unit testing at each layer
6. **Double-entry ledger**: Business-level accounting operations built on API primitives

## Areas for Improvement

1. **Connection pooling**: Current implementation creates new connections per request
2. **Retry logic**: No built-in retry/backoff for transient failures
3. **Pagination**: QueryBuilder doesn't auto-paginate large result sets
4. **Webhook signature verification**: No built-in HMAC validation for incoming webhooks
5. **Rate limiting**: No client-side rate limit tracking or queuing
