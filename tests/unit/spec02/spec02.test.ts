import { BillingSchedule } from '../../../src/spec02/billing-schedule';
import { BillingCharge } from '../../../src/spec02/billing-charge';
import { Invoice } from '../../../src/spec02/invoice';
import { InvoiceItem } from '../../../src/spec02/invoice-item';
import { LineItem, ChargeItem, PaymentItem } from '../../../src/spec02/line-item';
import { Webhook } from '../../../src/spec02/webhook';
import { WebhookLog } from '../../../src/spec02/webhook-log';
import { Entity } from '../../../src/spec02/entity';
import { Stakeholder } from '../../../src/spec02/stakeholder';
import { Transfer } from '../../../src/spec02/transfer';
import { ProcessingAccount } from '../../../src/spec02/processing-account';
import { ProcessingAgreement } from '../../../src/spec02/processing-agreement';
import { PaymentLink } from '../../../src/spec02/payment-link';
import { Intent } from '../../../src/spec02/intent';
import { Ledger } from '../../../src/spec02/ledger';
import { Profile } from '../../../src/spec02/profile';
import { Org } from '../../../src/spec02/org';
import { clearObjectCache } from '../../../src/core/model';

beforeEach(() => clearObjectCache());

describe('Spec02 - Advanced Objects', () => {
  describe('BillingSchedule', () => {
    it('should have correct spec', () => {
      expect(BillingSchedule.getMergedSpec().object).toBe('billing_schedule');
      expect(BillingSchedule.getEndpoint()).toBe('/billing_schedules');
    });

    it('should expose properties', () => {
      const bs = new BillingSchedule({
        status: 'active',
        start_date: '2024-01-01',
        description: 'Monthly subscription',
        type: 'recurring',
      });
      expect(bs.status).toBe('active');
      expect(bs.startDate).toBe('2024-01-01');
      expect(bs.description).toBe('Monthly subscription');
      expect(bs.type).toBe('recurring');
    });
  });

  describe('BillingCharge', () => {
    it('should have correct spec', () => {
      expect(BillingCharge.getMergedSpec().object).toBe('billing_charge');
      expect(BillingCharge.getEndpoint()).toBe('/billing_charges');
    });

    it('should expose properties', () => {
      const bc = new BillingCharge({
        billing_schedule_id: 'bscd_1',
        amount: 29.99,
        description: 'Monthly charge',
        qty: 1,
        total: 29.99,
      });
      expect(bc.billingScheduleId).toBe('bscd_1');
      expect(bc.amount).toBe(29.99);
      expect(bc.qty).toBe(1);
      expect(bc.total).toBe(29.99);
    });
  });

  describe('Invoice', () => {
    it('should have correct spec', () => {
      expect(Invoice.getMergedSpec().object).toBe('invoice');
      expect(Invoice.getEndpoint()).toBe('/invoices');
    });

    it('should expose properties', () => {
      const inv = new Invoice({
        number: 'INV-001',
        status: 'draft',
        due_date: '2024-04-01',
        description: 'Test invoice',
      });
      expect(inv.number).toBe('INV-001');
      expect(inv.status).toBe('draft');
      expect(inv.dueDate).toBe('2024-04-01');
    });
  });

  describe('InvoiceItem', () => {
    it('should have correct spec', () => {
      expect(InvoiceItem.getMergedSpec().object).toBe('line_item');
      expect(InvoiceItem.getEndpoint()).toBe('/line_items');
    });

    it('should expose properties', () => {
      const item = new InvoiceItem({
        invoice_id: 'inv_1',
        description: 'Consulting',
        amount: 250.00,
        entry_type: 'charge',
        qty: 5,
      });
      expect(item.invoiceId).toBe('inv_1');
      expect(item.amount).toBe(250.00);
      expect(item.entryType).toBe('charge');
      expect(item.qty).toBe(5);
    });
  });

  describe('LineItem hierarchy', () => {
    it('LineItem should have correct spec', () => {
      expect(LineItem.getMergedSpec().object).toBe('line_item');
      expect(LineItem.getEndpoint()).toBe('/line_items');
    });

    it('ChargeItem should be polymorphic with entry_type=charge', () => {
      const spec = ChargeItem.getMergedSpec();
      expect(spec.polymorphic).toEqual({ entry_type: 'charge' });

      const item = new ChargeItem({ amount: 100 });
      expect(item.entryType).toBe('charge');
    });

    it('PaymentItem should be polymorphic with entry_type=payment', () => {
      const spec = PaymentItem.getMergedSpec();
      expect(spec.polymorphic).toEqual({ entry_type: 'payment' });

      const item = new PaymentItem({ amount: 100 });
      expect(item.entryType).toBe('payment');
    });
  });

  describe('Webhook', () => {
    it('should have correct spec', () => {
      expect(Webhook.getMergedSpec().object).toBe('webhook');
      expect(Webhook.getEndpoint()).toBe('/webhooks');
    });

    it('should expose properties', () => {
      const wh = new Webhook({
        url: 'https://example.com/hook',
        trigger: 'payment',
      });
      expect(wh.url).toBe('https://example.com/hook');
      expect(wh.trigger).toBe('payment');
    });
  });

  describe('WebhookLog', () => {
    it('should have correct spec', () => {
      expect(WebhookLog.getMergedSpec().object).toBe('webhook_log');
      expect(WebhookLog.getEndpoint()).toBe('/webhook_logs');
    });

    it('should expose properties', () => {
      const log = new WebhookLog({
        webhook_id: 'wh_1',
        trigger: 'payment',
        http_status: 200,
        url: 'https://example.com/hook',
      });
      expect(log.webhookId).toBe('wh_1');
      expect(log.trigger).toBe('payment');
      expect(log.httpStatus).toBe(200);
    });
  });

  describe('Entity (LegalEntity)', () => {
    it('should have correct spec', () => {
      expect(Entity.getMergedSpec().object).toBe('entity');
      expect(Entity.getEndpoint()).toBe('/entities');
    });

    it('should expose properties', () => {
      const entity = new Entity({
        legal_name: 'Acme Corp',
        type: 'business',
        phone_number: '555-1234',
        country: 'US',
        tax_id: { value: '123456789' },
      });
      expect(entity.legalName).toBe('Acme Corp');
      expect(entity.type).toBe('business');
      expect(entity.phoneNumber).toBe('555-1234');
      expect(entity.country).toBe('US');
    });
  });

  describe('Stakeholder (LegalEntityOwner)', () => {
    it('should have correct spec', () => {
      expect(Stakeholder.getMergedSpec().object).toBe('legal_entity_owner');
      expect(Stakeholder.getEndpoint()).toBe('/legal_entity_owners');
    });

    it('should expose properties', () => {
      const sh = new Stakeholder({
        legal_entity_id: 'le_1',
        first_name: 'John',
        last_name: 'Doe',
        ownership: 51.0,
        title: 'CEO',
      });
      expect(sh.legalEntityId).toBe('le_1');
      expect(sh.firstName).toBe('John');
      expect(sh.ownership).toBe(51.0);
    });
  });

  describe('Transfer', () => {
    it('should have correct spec', () => {
      expect(Transfer.getMergedSpec().object).toBe('transaction');
      expect(Transfer.getEndpoint()).toBe('/transactions');
      expect(Transfer.getMergedSpec().polymorphic).toEqual({ type: 'transfer' });
    });

    it('should expose properties', () => {
      const transfer = new Transfer({
        amount: 500.00,
        sender_id: 'acct_1',
        receiver_id: 'acct_2',
        status: 'completed',
      });
      expect(transfer.amount).toBe(500.00);
      expect(transfer.senderId).toBe('acct_1');
      expect(transfer.receiverId).toBe('acct_2');
    });
  });

  describe('ProcessingAccount', () => {
    it('should have correct spec', () => {
      expect(ProcessingAccount.getMergedSpec().object).toBe('processing_account');
      expect(ProcessingAccount.getEndpoint()).toBe('/processing_accounts');
    });

    it('should expose properties', () => {
      const pa = new ProcessingAccount({
        name: 'Main Processing',
        status: 'active',
        legal_entity_id: 'le_1',
        industry: 'technology',
      });
      expect(pa.name).toBe('Main Processing');
      expect(pa.status).toBe('active');
      expect(pa.legalEntityId).toBe('le_1');
    });
  });

  describe('ProcessingAgreement (Operation)', () => {
    it('should have correct spec', () => {
      expect(ProcessingAgreement.getMergedSpec().object).toBe('operation');
      expect(ProcessingAgreement.getEndpoint()).toBe('/operations');
    });

    it('should expose properties', () => {
      const op = new ProcessingAgreement({
        amount: 100,
        status: 'complete',
        type: 'process',
        transaction_id: 'txn_1',
      });
      expect(op.amount).toBe(100);
      expect(op.status).toBe('complete');
      expect(op.type).toBe('process');
      expect(op.transactionId).toBe('txn_1');
    });
  });

  describe('PaymentLink', () => {
    it('should have correct spec', () => {
      expect(PaymentLink.getMergedSpec().object).toBe('payment_link');
      expect(PaymentLink.getEndpoint()).toBe('/payment_links');
    });

    it('should expose properties', () => {
      const link = new PaymentLink({
        url: 'https://pay.payload.com/link_1',
        amount: 100,
        description: 'Test payment',
        status: 'active',
      });
      expect(link.url).toBe('https://pay.payload.com/link_1');
      expect(link.amount).toBe(100);
      expect(link.status).toBe('active');
    });
  });

  describe('Intent', () => {
    it('should have correct spec', () => {
      expect(Intent.getMergedSpec().object).toBe('intent');
      expect(Intent.getEndpoint()).toBe('/intents');
    });

    it('should expose properties', () => {
      const intent = new Intent({
        status: 'pending',
        type: 'checkout_page',
        client_token_id: 'ct_test_123',
      });
      expect(intent.status).toBe('pending');
      expect(intent.type).toBe('checkout_page');
      expect(intent.clientTokenId).toBe('ct_test_123');
    });
  });

  describe('Ledger (TransactionLedger)', () => {
    it('should have correct spec', () => {
      expect(Ledger.getMergedSpec().object).toBe('transaction_ledger');
      expect(Ledger.getEndpoint()).toBe('/transaction_ledgers');
    });

    it('should expose properties and computed flags', () => {
      const debit = new Ledger({
        transaction_id: 'txn_1',
        account_id: 'acct_1',
        amount: 100,
        entry_type: 'debit',
        balance_before: 500,
        balance_after: 600,
      });
      expect(debit.isDebit).toBe(true);
      expect(debit.isCredit).toBe(false);
      expect(debit.balanceBefore).toBe(500);
      expect(debit.balanceAfter).toBe(600);

      const credit = new Ledger({ entry_type: 'credit' });
      expect(credit.isDebit).toBe(false);
      expect(credit.isCredit).toBe(true);
    });
  });

  describe('Profile', () => {
    it('should have correct spec', () => {
      expect(Profile.getMergedSpec().object).toBe('profile');
    });
  });

  describe('Org', () => {
    it('should have correct spec', () => {
      expect(Org.getMergedSpec().object).toBe('org');
      expect(Org.getEndpoint()).toBe('/orgs');
    });

    it('should expose properties', () => {
      const org = new Org({
        name: 'Acme Corp',
        org_type: 'platform',
        industry: 'technology',
      });
      expect(org.name).toBe('Acme Corp');
      expect(org.orgType).toBe('platform');
      expect(org.industry).toBe('technology');
    });
  });
});
