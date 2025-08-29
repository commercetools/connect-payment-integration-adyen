import { getSavedPaymentsConfig } from '../../src/config/saved-payment-method.config';

describe('saved-payment-method.config', () => {
  test('should have the supported payment method types set', async () => {
    expect(getSavedPaymentsConfig().config.supportedPaymentMethodTypes).toStrictEqual({
      scheme: {
        oneOffPayments: true,
      },
    });
  });
});
