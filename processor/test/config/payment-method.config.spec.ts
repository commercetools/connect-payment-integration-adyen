import { afterEach, describe, expect, test } from '@jest/globals';
import { defaultPaymentMethodConfig, getPaymentMethodConfig } from '../../src/config/payment-method.config';

describe('payment-method.config', () => {
  afterEach(() => {
    delete process.env.ADYEN_PAYMENT_METHODS_CONFIG;
  });

  test('should merge overrides from ADYEN_PAYMENT_METHODS_CONFIG', () => {
    process.env.ADYEN_PAYMENT_METHODS_CONFIG = JSON.stringify({
      bcmc: { supportSeparateCapture: true },
      bancontact: { supportSeparateCapture: true },
    });
    const config = getPaymentMethodConfig();
    expect(config).toStrictEqual({
      ...defaultPaymentMethodConfig,
      bcmc: { supportSeparateCapture: true },
      bancontact: { supportSeparateCapture: true },
    });
  });

  test('should ignore malformed JSON in ADYEN_PAYMENT_METHODS_CONFIG', () => {
    process.env.ADYEN_PAYMENT_METHODS_CONFIG = '{not-json';
    const config = getPaymentMethodConfig();
    expect(config).toStrictEqual(defaultPaymentMethodConfig);
  });
});
