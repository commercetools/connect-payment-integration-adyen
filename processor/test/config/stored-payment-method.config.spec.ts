import { describe, expect, test } from '@jest/globals';
import { getStoredPaymentMethodsConfig } from '../../src/config/stored-payment-methods.config';

describe('stored-payment-methods.config', () => {
  test('should have the supported payment method types set', async () => {
    expect(getStoredPaymentMethodsConfig().config.supportedPaymentMethodTypes).toStrictEqual({
      scheme: {
        oneOffPayments: { enabled: true },
        recurringPayments: { enabled: true },
      },
      googlepay: {
        oneOffPayments: { enabled: false },
        recurringPayments: { enabled: true },
      },
      applepay: {
        oneOffPayments: { enabled: false },
        recurringPayments: { enabled: true },
      },
      klarna_paynow: {
        oneOffPayments: { enabled: false },
        recurringPayments: { enabled: true },
      },
      klarna: {
        oneOffPayments: { enabled: false },
        recurringPayments: { enabled: true },
      },
      klarna_account: {
        oneOffPayments: { enabled: false },
        recurringPayments: { enabled: true },
      },
      afterpaytouch: {
        oneOffPayments: { enabled: false },
        recurringPayments: { enabled: true, allowedCountries: ['AU', 'NZ'] },
      },
    });
  });
});
