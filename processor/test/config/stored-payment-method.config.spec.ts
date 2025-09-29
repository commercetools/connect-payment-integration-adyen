import { getStoredPaymentMethodsConfig } from '../../src/config/stored-payment-methods.config';

describe('stored-payment-methods.config', () => {
  test('should have the supported payment method types set', async () => {
    expect(getStoredPaymentMethodsConfig().config.supportedPaymentMethodTypes).toStrictEqual({
      scheme: {
        oneOffPayments: true,
      },
    });
  });
});
