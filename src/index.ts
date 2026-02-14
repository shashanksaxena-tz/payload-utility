/**
 * Payload Utility - ARM-based SDK for the Payload Payment Gateway
 *
 * This library provides a complete TypeScript implementation of the
 * Payload API Relational Model (ARM) framework with support for both
 * Spec01 (core) and Spec02 (advanced) API objects.
 *
 * Architecture:
 * - Core: ARM framework (Session, Model, Request, Attr, Exceptions)
 * - Spec01: Core objects (Transaction, Payment, Customer, PaymentMethod)
 * - Spec02: Advanced objects (Billing, Invoice, Entity, Transfer, Webhook, Ledger)
 * - Ledger: Two-way (double-entry) ledger management system
 *
 * Usage:
 *   import { Session, attr } from 'payload-utility';
 *   const pl = new Session('secret_key_your_key_here');
 *
 *   // Spec01 - Core operations
 *   const customer = await pl.Customer.create({ name: 'Jane Doe', email: 'jane@example.com' });
 *   const payment = await pl.Payment.create({ amount: 100.00, payment_method: { type: 'card' } });
 *
 *   // Spec02 - Advanced operations
 *   const invoice = await pl.Invoice.create({ customer_id: customer.id, total_amount: 250.00 });
 *   const webhook = await pl.Webhook.create({ url: 'https://example.com/hook', events: ['payment.created'] });
 *
 *   // Ledger management
 *   import { LedgerManager } from 'payload-utility';
 *   const ledger = new LedgerManager(pl);
 *   await ledger.createBalancedEntry({
 *     debit: { accountId: 'acct_1', amount: 100, entryType: 'debit', description: 'Revenue' },
 *     credit: { accountId: 'acct_2', amount: 100, entryType: 'credit', description: 'Receivable' },
 *   });
 */

// --- Core ---
export { Session, SessionConfig } from './core/session';
export { Model, ModelSpec, ModelData, ModelOperations, QueryBuilder, clearObjectCache } from './core/model';
export { Request, RequestOptions, RequestConfig, QueryOptions, ApiResponse } from './core/request';
export { attr, AttrChain, Filter, FilterOperator, serializeFilters } from './core/attr';
export {
  PayloadError,
  UnknownResponse,
  BadRequest,
  InvalidAttributes,
  TransactionDeclined,
  Unauthorized,
  Forbidden,
  NotFound,
  TooManyRequests,
  InternalServerError,
  ServiceUnavailable,
  Exceptions,
} from './core/exceptions';

// --- Spec01: Core Objects ---
export { Account } from './spec01/account';
export { Customer } from './spec01/customer';
export {
  Transaction,
  TransactionStatus,
  TransactionParticipant,
  TransactionSource,
  TransferType,
  TransactionType,
} from './spec01/transaction';
export { Payment } from './spec01/payment';
export { Refund } from './spec01/refund';
export { Credit } from './spec01/credit';
export { Deposit } from './spec01/deposit';
export { Withdraw } from './spec01/withdraw';
export { Payout } from './spec01/payout';
export { PaymentMethod } from './spec01/payment-method';
export { Card } from './spec01/card';
export { BankAccount } from './spec01/bank-account';
export { AccessToken, ClientToken } from './spec01/access-token';

// --- Spec02: Advanced Objects ---
export { BillingSchedule } from './spec02/billing-schedule';
export { BillingCharge } from './spec02/billing-charge';
export { Invoice } from './spec02/invoice';
export { InvoiceItem } from './spec02/invoice-item';
export { LineItem, ChargeItem, PaymentItem } from './spec02/line-item';
export { Webhook } from './spec02/webhook';
export { WebhookLog } from './spec02/webhook-log';
export { Entity } from './spec02/entity';
export { Stakeholder } from './spec02/stakeholder';
export { Transfer } from './spec02/transfer';
export { ProcessingAccount } from './spec02/processing-account';
export { ProcessingAgreement } from './spec02/processing-agreement';
export { PaymentLink } from './spec02/payment-link';
export { Intent } from './spec02/intent';
export { Ledger } from './spec02/ledger';
export { Profile } from './spec02/profile';
export { Org } from './spec02/org';

// --- Ledger Management ---
export {
  LedgerManager,
  LedgerEntry,
  LedgerPair,
  AccountBalance,
  ReconciliationResult,
  LedgerTransaction,
  DailyBalance,
  MonthlyBalance,
  AccountStatement,
  TrialBalanceRow,
  TrialBalance,
} from './ledger/ledger-manager';

// --- Middleware & Hooks ---
export { MiddlewareChain, Middleware, BeforeRequestHook, AfterResponseHook, ErrorHook, RequestContext, ResponseContext } from './core/middleware';

// --- Events ---
export { PayloadEventEmitter, SDKEvent, EventData } from './core/events';

// --- Retry & Resilience ---
export { RetryExecutor, RetryStrategy, CircuitBreaker, RateLimiter, DEFAULT_RETRY_STRATEGY } from './core/retry';

// --- Webhook Verification ---
export { WebhookVerifier, WebhookEvent, WebhookVerificationError } from './core/webhook-verify';

// --- Metadata Tracking ---
export { MetadataManager, AppMetadata, withMetadata } from './core/metadata';

// --- Storage Adapters ---
export { StorageAdapter, StoredLedgerEntry, LedgerQuery } from './storage/types';
export { MemoryAdapter } from './storage/memory-adapter';
export { JsonFileAdapter } from './storage/json-file-adapter';
// Note: SQLiteAdapter requires optional `better-sqlite3` dependency
// Users should import directly: import { SQLiteAdapter } from 'payload-utility/dist/storage/sqlite-adapter';

// --- Tenant Reports ---
export { TenantReportGenerator } from './ledger/tenant-reports';
