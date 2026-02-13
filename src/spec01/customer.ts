import { ModelSpec } from '../core/model';
import { Account } from './account';

/**
 * Customer - Polymorphic child of Account.
 * In Payload V2, customers are Account objects with type='customer'.
 * There is no separate /customers endpoint; all operations go through /accounts.
 */
export class Customer extends Account {
  static spec: ModelSpec = {
    object: 'account',
    endpoint: '/accounts',
    polymorphic: { type: 'customer' },
  };
}
