import { describe, expect, test } from '@jest/globals';
import { getStoredPaymentMethodsConfig } from '../../src/config/stored-payment-methods.config';

describe('stored-payment-methods.config', () => {
  test('should have the supported payment method types set', async () => {
    expect(getStoredPaymentMethodsConfig().config.supportedPaymentMethodTypes).toStrictEqual({
      scheme: {
        oneOffPayments: true,
        recurringPayments: true,
      },
      googlepay: {
        oneOffPayments: false,
        recurringPayments: true,
      },
      applepay: {
        oneOffPayments: false,
        recurringPayments: true,
      },
      klarna_paynow: {
        oneOffPayments: false,
        recurringPayments: true,
      },
      klarna: {
        oneOffPayments: false,
        recurringPayments: true,
      },
      klarna_account: {
        oneOffPayments: false,
        recurringPayments: true,
      },
    });
  });
});
