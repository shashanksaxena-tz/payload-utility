/**
 * Session - Authentication and object binding for the Payload ARM framework.
 *
 * A Session binds an API key and configuration to all model operations,
 * providing scoped access to Payload API objects.
 */

import { Request, RequestOptions } from './request';
import { Model, ModelOperations, ModelData } from './model';
import { validateApiKey } from './utils';
import { MiddlewareChain, RequestContext, ResponseContext } from './middleware';
import { PayloadEventEmitter } from './events';
import { RetryExecutor, RetryStrategy, CircuitBreaker, RateLimiter } from './retry';
import { MetadataManager, AppMetadata } from './metadata';
import { StorageAdapter } from '../storage/types';

// --- Spec01 Imports ---
import { Customer } from '../spec01/customer';
import { Transaction } from '../spec01/transaction';
import { Payment } from '../spec01/payment';
import { Refund } from '../spec01/refund';
import { Credit } from '../spec01/credit';
import { Deposit } from '../spec01/deposit';
import { Withdraw } from '../spec01/withdraw';
import { Payout } from '../spec01/payout';
import { PaymentMethod } from '../spec01/payment-method';
import { Card } from '../spec01/card';
import { BankAccount } from '../spec01/bank-account';
import { Account } from '../spec01/account';
import { AccessToken, ClientToken } from '../spec01/access-token';

// --- Spec02 Imports ---
import { BillingSchedule } from '../spec02/billing-schedule';
import { BillingCharge } from '../spec02/billing-charge';
import { Invoice } from '../spec02/invoice';
import { InvoiceItem } from '../spec02/invoice-item';
import { LineItem, ChargeItem, PaymentItem } from '../spec02/line-item';
import { Webhook } from '../spec02/webhook';
import { WebhookLog } from '../spec02/webhook-log';
import { Entity } from '../spec02/entity';
import { Stakeholder } from '../spec02/stakeholder';
import { Transfer } from '../spec02/transfer';
import { ProcessingAccount } from '../spec02/processing-account';
import { ProcessingAgreement } from '../spec02/processing-agreement';
import { PaymentLink } from '../spec02/payment-link';
import { Intent } from '../spec02/intent';
import { Ledger } from '../spec02/ledger';
import { Profile } from '../spec02/profile';
import { Org } from '../spec02/org';

export interface SessionConfig {
  apiUrl?: string;
  apiVersion?: string;
  timeout?: number;
  middleware?: MiddlewareChain;
  events?: PayloadEventEmitter;
  retry?: Partial<RetryStrategy>;
  circuitBreaker?: { failureThreshold?: number; resetTimeout?: number };
  rateLimiter?: { maxTokens?: number; refillRate?: number };
  metadata?: Partial<AppMetadata>;
  storage?: StorageAdapter;
  onRequest?: (ctx: RequestContext) => void;
  onResponse?: (ctx: ResponseContext) => void;
  onError?: (err: Error) => void;
}

const DEFAULT_API_URL = 'https://api.payload.com';
const DEFAULT_TIMEOUT = 30000;

export class Session {
  private readonly request: Request;
  private readonly apiKey: string;
  private readonly config: SessionConfig;
  private readonly _middleware: MiddlewareChain;
  private readonly _events: PayloadEventEmitter;
  private readonly _metadataManager: MetadataManager | null;
  private readonly _storage: StorageAdapter | null;

  // --- Spec01 Operations ---
  public readonly Customer: ModelOperations<Customer>;
  public readonly Transaction: ModelOperations<Transaction>;
  public readonly Payment: ModelOperations<Payment>;
  public readonly Refund: ModelOperations<Refund>;
  public readonly Credit: ModelOperations<Credit>;
  public readonly Deposit: ModelOperations<Deposit>;
  public readonly Withdraw: ModelOperations<Withdraw>;
  public readonly Payout: ModelOperations<Payout>;
  public readonly PaymentMethod: ModelOperations<PaymentMethod>;
  public readonly Card: ModelOperations<Card>;
  public readonly BankAccount: ModelOperations<BankAccount>;
  public readonly Account: ModelOperations<Account>;
  public readonly AccessToken: ModelOperations<AccessToken>;
  public readonly ClientToken: ModelOperations<ClientToken>;

  // --- Spec02 Operations ---
  public readonly BillingSchedule: ModelOperations<BillingSchedule>;
  public readonly BillingCharge: ModelOperations<BillingCharge>;
  public readonly Invoice: ModelOperations<Invoice>;
  public readonly InvoiceItem: ModelOperations<InvoiceItem>;
  public readonly LineItem: ModelOperations<LineItem>;
  public readonly ChargeItem: ModelOperations<ChargeItem>;
  public readonly PaymentItem: ModelOperations<PaymentItem>;
  public readonly Webhook: ModelOperations<Webhook>;
  public readonly WebhookLog: ModelOperations<WebhookLog>;
  public readonly Entity: ModelOperations<Entity>;
  public readonly Stakeholder: ModelOperations<Stakeholder>;
  public readonly Transfer: ModelOperations<Transfer>;
  public readonly ProcessingAccount: ModelOperations<ProcessingAccount>;
  public readonly ProcessingAgreement: ModelOperations<ProcessingAgreement>;
  public readonly PaymentLink: ModelOperations<PaymentLink>;
  public readonly Intent: ModelOperations<Intent>;
  public readonly Ledger: ModelOperations<Ledger>;
  public readonly Profile: ModelOperations<Profile>;
  public readonly Org: ModelOperations<Org>;

  constructor(apiKey: string, config: SessionConfig = {}) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('API key is required');
    }

    if (!validateApiKey(apiKey)) {
      console.warn(
        'Warning: API key format may be invalid. Expected format: secret_key_<id> or client_key_<id>'
      );
    }

    this.apiKey = apiKey;
    this.config = config;

    // Initialize middleware chain (use provided or create new)
    this._middleware = config.middleware || new MiddlewareChain();

    // Register shorthand hooks as middleware if provided
    if (config.onRequest || config.onResponse || config.onError) {
      this._middleware.use({
        name: 'session-hooks',
        before: config.onRequest
          ? (ctx) => { config.onRequest!(ctx); return ctx; }
          : undefined,
        after: config.onResponse
          ? (res, _req) => { config.onResponse!(res); return res; }
          : undefined,
        onError: config.onError
          ? (err, _req) => { config.onError!(err); }
          : undefined,
      });
    }

    // Initialize event emitter (use provided or create new)
    this._events = config.events || new PayloadEventEmitter();

    // Initialize retry executor if configured
    const retryExecutor = config.retry ? new RetryExecutor(config.retry) : undefined;

    // Initialize circuit breaker if configured
    const circuitBreaker = config.circuitBreaker
      ? new CircuitBreaker(config.circuitBreaker)
      : undefined;

    // Initialize rate limiter if configured
    const rateLimiter = config.rateLimiter
      ? new RateLimiter(config.rateLimiter)
      : undefined;

    // Initialize metadata manager if configured
    this._metadataManager = config.metadata
      ? new MetadataManager(config.metadata)
      : null;

    // Store storage adapter reference
    this._storage = config.storage || null;

    const requestOptions: RequestOptions = {
      apiUrl: config.apiUrl || DEFAULT_API_URL,
      apiKey: this.apiKey,
      apiVersion: config.apiVersion || 'v2.0',
      timeout: config.timeout || DEFAULT_TIMEOUT,
      middleware: this._middleware,
      events: this._events,
      retry: retryExecutor,
      circuitBreaker,
      rateLimiter,
    };

    this.request = new Request(requestOptions);

    // --- Bind Spec01 ---
    this.Customer = this.createOps(Customer);
    this.Transaction = this.createOps(Transaction);
    this.Payment = this.createOps(Payment);
    this.Refund = this.createOps(Refund);
    this.Credit = this.createOps(Credit);
    this.Deposit = this.createOps(Deposit);
    this.Withdraw = this.createOps(Withdraw);
    this.Payout = this.createOps(Payout);
    this.PaymentMethod = this.createOps(PaymentMethod);
    this.Card = this.createOps(Card);
    this.BankAccount = this.createOps(BankAccount);
    this.Account = this.createOps(Account);
    this.AccessToken = this.createOps(AccessToken);
    this.ClientToken = this.createOps(ClientToken);

    // --- Bind Spec02 ---
    this.BillingSchedule = this.createOps(BillingSchedule);
    this.BillingCharge = this.createOps(BillingCharge);
    this.Invoice = this.createOps(Invoice);
    this.InvoiceItem = this.createOps(InvoiceItem);
    this.LineItem = this.createOps(LineItem);
    this.ChargeItem = this.createOps(ChargeItem);
    this.PaymentItem = this.createOps(PaymentItem);
    this.Webhook = this.createOps(Webhook);
    this.WebhookLog = this.createOps(WebhookLog);
    this.Entity = this.createOps(Entity);
    this.Stakeholder = this.createOps(Stakeholder);
    this.Transfer = this.createOps(Transfer);
    this.ProcessingAccount = this.createOps(ProcessingAccount);
    this.ProcessingAgreement = this.createOps(ProcessingAgreement);
    this.PaymentLink = this.createOps(PaymentLink);
    this.Intent = this.createOps(Intent);
    this.Ledger = this.createOps(Ledger);
    this.Profile = this.createOps(Profile);
    this.Org = this.createOps(Org);
  }

  private createOps<T extends Model>(
    ModelClass: new (data: Record<string, unknown>) => T
  ): ModelOperations<T> {
    return new ModelOperations<T>(
      ModelClass,
      ModelClass as unknown as typeof Model,
      this.request
    );
  }

  /** Get the underlying request instance */
  getRequest(): Request {
    return this.request;
  }

  /** Get the session's API key (masked for security) */
  getMaskedApiKey(): string {
    if (this.apiKey.length > 15) {
      return this.apiKey.substring(0, 15) + '...' + this.apiKey.substring(this.apiKey.length - 4);
    }
    return '***';
  }

  /** Get the middleware chain for adding/inspecting middleware */
  getMiddleware(): MiddlewareChain {
    return this._middleware;
  }

  /** Get the event emitter for subscribing to SDK events */
  getEvents(): PayloadEventEmitter {
    return this._events;
  }

  /** Get the metadata manager, or null if not configured */
  getMetadataManager(): MetadataManager | null {
    return this._metadataManager;
  }

  /** Get the storage adapter, or null if not configured */
  getStorage(): StorageAdapter | null {
    return this._storage;
  }
}
