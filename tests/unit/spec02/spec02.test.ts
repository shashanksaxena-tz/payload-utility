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
        customer_id: 'cust_1',
        amount: 29.99,
        frequency: 'monthly',
        interval: 1,
        status: 'active',
        start_date: '2024-01-01',
      });
      expect(bs.customerId).toBe('cust_1');
      expect(bs.amount).toBe(29.99);
      expect(bs.frequency).toBe('monthly');
      expect(bs.interval).toBe(1);
      expect(bs.status).toBe('active');
    });
  });

  describe('BillingCharge', () => {
    it('should have correct spec', () => {
      expect(BillingCharge.getMergedSpec().object).toBe('billing_charge');
      expect(BillingCharge.getEndpoint()).toBe('/billing_charges');
    });

    it('should expose properties', () => {
      const bc = new BillingCharge({
        billing_schedule_id: 'bs_1',
        amount: 29.99,
        status: 'completed',
        attempt_count: 1,
      });
      expect(bc.billingScheduleId).toBe('bs_1');
      expect(bc.amount).toBe(29.99);
      expect(bc.attemptCount).toBe(1);
    });
  });

  describe('Invoice', () => {
    it('should have correct spec', () => {
      expect(Invoice.getMergedSpec().object).toBe('invoice');
      expect(Invoice.getEndpoint()).toBe('/invoices');
    });

    it('should expose properties', () => {
      const inv = new Invoice({
        customer_id: 'cust_1',
        number: 'INV-001',
        total_amount: 250.00,
        amount_due: 250.00,
        amount_paid: 0,
        currency: 'USD',
        status: 'draft',
      });
      expect(inv.customerId).toBe('cust_1');
      expect(inv.number).toBe('INV-001');
      expect(inv.totalAmount).toBe(250.00);
      expect(inv.amountDue).toBe(250.00);
      expect(inv.currency).toBe('USD');
    });
  });

  describe('InvoiceItem', () => {
    it('should have correct spec', () => {
      expect(InvoiceItem.getMergedSpec().object).toBe('invoice_item');
    });

    it('should expose properties', () => {
      const item = new InvoiceItem({
        invoice_id: 'inv_1',
        description: 'Consulting',
        quantity: 5,
        unit_price: 50.00,
        amount: 250.00,
      });
      expect(item.invoiceId).toBe('inv_1');
      expect(item.quantity).toBe(5);
      expect(item.unitPrice).toBe(50.00);
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
        events: ['payment.created', 'payment.updated'],
        status: 'active',
      });
      expect(wh.url).toBe('https://example.com/hook');
      expect(wh.events).toEqual(['payment.created', 'payment.updated']);
      expect(wh.status).toBe('active');
    });
  });

  describe('WebhookLog', () => {
    it('should have correct spec', () => {
      expect(WebhookLog.getMergedSpec().object).toBe('webhook_log');
    });

    it('should expose properties', () => {
      const log = new WebhookLog({
        webhook_id: 'wh_1',
        event_type: 'payment.created',
        response_status: 200,
        success: true,
        attempt_number: 1,
      });
      expect(log.webhookId).toBe('wh_1');
      expect(log.responseStatus).toBe(200);
      expect(log.success).toBe(true);
    });
  });

  describe('Entity', () => {
    it('should have correct spec', () => {
      expect(Entity.getMergedSpec().object).toBe('entity');
      expect(Entity.getEndpoint()).toBe('/entities');
    });

    it('should expose properties', () => {
      const entity = new Entity({
        legal_name: 'Acme Corp',
        dba_name: 'Acme',
        entity_type: 'llc',
        ein: '12-3456789',
      });
      expect(entity.legalName).toBe('Acme Corp');
      expect(entity.dbaName).toBe('Acme');
      expect(entity.entityType).toBe('llc');
      expect(entity.ein).toBe('12-3456789');
    });
  });

  describe('Stakeholder', () => {
    it('should have correct spec', () => {
      expect(Stakeholder.getMergedSpec().object).toBe('stakeholder');
    });

    it('should expose properties', () => {
      const sh = new Stakeholder({
        entity_id: 'ent_1',
        first_name: 'John',
        last_name: 'Doe',
        ownership_percentage: 51.0,
        title: 'CEO',
      });
      expect(sh.entityId).toBe('ent_1');
      expect(sh.firstName).toBe('John');
      expect(sh.ownershipPercentage).toBe(51.0);
    });
  });

  describe('Transfer', () => {
    it('should have correct spec', () => {
      expect(Transfer.getMergedSpec().object).toBe('transfer');
      expect(Transfer.getEndpoint()).toBe('/transfers');
    });

    it('should expose properties', () => {
      const transfer = new Transfer({
        amount: 500.00,
        source_account_id: 'acct_1',
        destination_account_id: 'acct_2',
        status: 'completed',
      });
      expect(transfer.amount).toBe(500.00);
      expect(transfer.sourceAccountId).toBe('acct_1');
      expect(transfer.destinationAccountId).toBe('acct_2');
    });
  });

  describe('ProcessingAccount', () => {
    it('should have correct spec', () => {
      expect(ProcessingAccount.getMergedSpec().object).toBe('processing_account');
    });
  });

  describe('ProcessingAgreement', () => {
    it('should have correct spec', () => {
      expect(ProcessingAgreement.getMergedSpec().object).toBe('processing_agreement');
    });
  });

  describe('PaymentLink', () => {
    it('should have correct spec', () => {
      expect(PaymentLink.getMergedSpec().object).toBe('payment_link');
    });

    it('should expose properties', () => {
      const link = new PaymentLink({
        url: 'https://pay.payload.co/link_1',
        amount: 100,
        description: 'Test payment',
      });
      expect(link.url).toBe('https://pay.payload.co/link_1');
      expect(link.amount).toBe(100);
    });
  });

  describe('Intent', () => {
    it('should have correct spec', () => {
      expect(Intent.getMergedSpec().object).toBe('intent');
      expect(Intent.getEndpoint()).toBe('/intents');
    });

    it('should expose properties', () => {
      const intent = new Intent({
        amount: 200,
        currency: 'USD',
        status: 'requires_payment_method',
        client_secret: 'cs_test_123',
        metadata: { order_id: 'ord_1' },
      });
      expect(intent.amount).toBe(200);
      expect(intent.clientSecret).toBe('cs_test_123');
      expect(intent.metadata).toEqual({ order_id: 'ord_1' });
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
    it('should have correct spec with custom endpoint', () => {
      expect(Org.getMergedSpec().object).toBe('org');
      expect(Org.getEndpoint()).toBe('/accounts/orgs');
    });
  });
});
