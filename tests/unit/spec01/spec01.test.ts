import { Customer } from '../../../src/spec01/customer';
import { Transaction } from '../../../src/spec01/transaction';
import { Payment } from '../../../src/spec01/payment';
import { Refund } from '../../../src/spec01/refund';
import { Credit } from '../../../src/spec01/credit';
import { Deposit } from '../../../src/spec01/deposit';
import { PaymentMethod } from '../../../src/spec01/payment-method';
import { Card } from '../../../src/spec01/card';
import { BankAccount } from '../../../src/spec01/bank-account';
import { Account } from '../../../src/spec01/account';
import { AccessToken, ClientToken } from '../../../src/spec01/access-token';
import { clearObjectCache } from '../../../src/core/model';

beforeEach(() => clearObjectCache());

describe('Spec01 - Core Objects', () => {
  describe('Customer', () => {
    it('should have correct spec (V2: polymorphic Account)', () => {
      expect(Customer.getMergedSpec().object).toBe('account');
      expect(Customer.getEndpoint()).toBe('/accounts');
      expect(Customer.getMergedSpec().polymorphic).toEqual({ type: 'customer' });
    });

    it('should expose typed properties', () => {
      const c = new Customer({ name: 'Jane', type: 'customer', contact_details: { email: 'jane@test.com' } });
      expect(c.name).toBe('Jane');
      expect(c.type).toBe('customer');
    });
  });

  describe('Transaction hierarchy', () => {
    it('Transaction should have correct spec', () => {
      expect(Transaction.getMergedSpec().object).toBe('transaction');
      expect(Transaction.getEndpoint()).toBe('/transactions');
    });

    it('Payment should be polymorphic with type=payment', () => {
      const spec = Payment.getMergedSpec();
      expect(spec.polymorphic).toEqual({ type: 'payment' });
      expect(spec.endpoint).toBe('/transactions');

      const payment = new Payment({ amount: 99.99 });
      expect(payment.type).toBe('payment');
      expect(payment.amount).toBe(99.99);
    });

    it('Refund should be polymorphic with type=refund', () => {
      const spec = Refund.getMergedSpec();
      expect(spec.polymorphic).toEqual({ type: 'refund' });

      const refund = new Refund({ amount: 50, type: 'refund' });
      expect(refund.type).toBe('refund');
      expect(refund.amount).toBe(50);
    });

    it('Credit should be polymorphic with type=deposit (V2 deprecation)', () => {
      expect(Credit.getMergedSpec().polymorphic).toEqual({ type: 'deposit' });
    });

    it('Deposit should be polymorphic with type=deposit', () => {
      expect(Deposit.getMergedSpec().polymorphic).toEqual({ type: 'deposit' });
    });

    it('Transaction instances should have common properties', () => {
      const txn = new Transaction({
        id: 'txn_1',
        amount: 150.00,
        status: 'processed',
        description: 'Test payment',
      });
      expect(txn.amount).toBe(150.00);
      expect(txn.status).toBe('processed');
      expect(txn.description).toBe('Test payment');
    });
  });

  describe('PaymentMethod hierarchy', () => {
    it('PaymentMethod should have correct spec', () => {
      expect(PaymentMethod.getMergedSpec().object).toBe('payment_method');
      expect(PaymentMethod.getEndpoint()).toBe('/payment_methods');
    });

    it('Card should be polymorphic with type=card', () => {
      const card = new Card({
        card_number: '4242424242424242',
        expiry: '12/25',
        last_four: '4242',
        brand: 'visa',
      });
      expect(card.type).toBe('card');
      expect(card.cardNumber).toBe('4242424242424242');
      expect(card.expiry).toBe('12/25');
      expect(card.lastFour).toBe('4242');
      expect(card.brand).toBe('visa');
    });

    it('BankAccount should be polymorphic with type=bank_account', () => {
      const bank = new BankAccount({
        account_number: '123456789',
        routing_number: '021000021',
        account_type: 'checking',
      });
      expect(bank.type).toBe('bank_account');
      expect(bank.accountNumber).toBe('123456789');
      expect(bank.routingNumber).toBe('021000021');
      expect(bank.accountType).toBe('checking');
    });
  });

  describe('Account', () => {
    it('should have correct spec', () => {
      expect(Account.getMergedSpec().object).toBe('account');
      expect(Account.getEndpoint()).toBe('/accounts');
    });
  });

  describe('AccessToken', () => {
    it('should have correct spec', () => {
      expect(AccessToken.getMergedSpec().object).toBe('access_token');
    });

    it('ClientToken should be polymorphic with type=client', () => {
      expect(ClientToken.getMergedSpec().polymorphic).toEqual({ type: 'client' });
    });
  });
});
