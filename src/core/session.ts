/**
 * Session - Authentication and object binding for the Payload ARM framework.
 *
 * A Session binds an API key and configuration to all model operations,
 * providing scoped access to Payload API objects.
 */

import { Request, RequestOptions } from './request';
import { Model, ModelOperations, ModelData } from './model';
import { validateApiKey } from './utils';

// --- Spec01 Imports ---
import { Customer } from '../spec01/customer';
import { Transaction } from '../spec01/transaction';
import { Payment } from '../spec01/payment';
import { Refund } from '../spec01/refund';
import { Credit } from '../spec01/credit';
import { Deposit } from '../spec01/deposit';
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
}

const DEFAULT_API_URL = 'https://api.payload.co';
const DEFAULT_TIMEOUT = 30000;

export class Session {
  private readonly request: Request;
  private readonly apiKey: string;
  private readonly config: SessionConfig;

  // --- Spec01 Operations ---
  public readonly Customer: ModelOperations<Customer>;
  public readonly Transaction: ModelOperations<Transaction>;
  public readonly Payment: ModelOperations<Payment>;
  public readonly Refund: ModelOperations<Refund>;
  public readonly Credit: ModelOperations<Credit>;
  public readonly Deposit: ModelOperations<Deposit>;
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

    const requestOptions: RequestOptions = {
      apiUrl: config.apiUrl || DEFAULT_API_URL,
      apiKey: this.apiKey,
      apiVersion: config.apiVersion,
      timeout: config.timeout || DEFAULT_TIMEOUT,
    };

    this.request = new Request(requestOptions);

    // --- Bind Spec01 ---
    this.Customer = this.createOps(Customer);
    this.Transaction = this.createOps(Transaction);
    this.Payment = this.createOps(Payment);
    this.Refund = this.createOps(Refund);
    this.Credit = this.createOps(Credit);
    this.Deposit = this.createOps(Deposit);
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
}
