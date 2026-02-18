import { afterEach, describe, expect, test } from '@jest/globals';
import { defaultPaymentMethodConfig, getPaymentMethodConfig } from '../../src/config/payment-method.config';

describe('payment-method.config', () => {
  afterEach(() => {
    delete process.env.ADYEN_PAYMENT_METHODS_CONFIG;
  });

  test('should return default config when env var is not set', () => {
    const config = getPaymentMethodConfig();
    expect(config).toStrictEqual(defaultPaymentMethodConfig);
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

  test('should ignore invalid payment method entries', () => {
    process.env.ADYEN_PAYMENT_METHODS_CONFIG = JSON.stringify({
      bcmc: { supportSeparateCapture: true },
      invalid_entry: { supportSeparateCapture: 'yes' }, // should be boolean
      another_invalid: null, // should be object
    });
    const config = getPaymentMethodConfig();
    expect(config).toStrictEqual({
      ...defaultPaymentMethodConfig,
      bcmc: { supportSeparateCapture: true },
    });
  });

  test('should ignore when JSON is not an object', () => {
    process.env.ADYEN_PAYMENT_METHODS_CONFIG = JSON.stringify(['array', 'not', 'object']);
    const config = getPaymentMethodConfig();
    expect(config).toStrictEqual(defaultPaymentMethodConfig);
  });

  test('should add new payment methods from overrides', () => {
    process.env.ADYEN_PAYMENT_METHODS_CONFIG = JSON.stringify({
      new_method: { supportSeparateCapture: true },
    });
    const config = getPaymentMethodConfig();
    expect(config).toStrictEqual({
      ...defaultPaymentMethodConfig,
      new_method: { supportSeparateCapture: true },
    });
  });
});
