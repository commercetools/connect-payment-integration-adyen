import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

describe('payment-method.config', () => {
  // Use a helper to re-require the module after resetting the cache
  const getModule = () => {
    jest.resetModules();
    return require('../../src/config/payment-method.config');
  };

  beforeEach(() => {
    // Start each test with a clean slate
    delete process.env.ADYEN_PAYMENT_METHODS_CONFIG;
  });

  afterEach(() => {
    delete process.env.ADYEN_PAYMENT_METHODS_CONFIG;
  });

  test('should return default config when env var is not set', () => {
    const { getPaymentMethodConfig, defaultPaymentMethodConfig } = getModule();
    const config = getPaymentMethodConfig();
    expect(config).toStrictEqual(defaultPaymentMethodConfig);
  });

  test('should merge overrides from ADYEN_PAYMENT_METHODS_CONFIG', () => {
    process.env.ADYEN_PAYMENT_METHODS_CONFIG = JSON.stringify({
      bcmc: { supportSeparateCapture: true },
      bancontact: { supportSeparateCapture: true },
    });

    const { getPaymentMethodConfig, defaultPaymentMethodConfig } = getModule();
    const config = getPaymentMethodConfig();

    expect(config).toStrictEqual({
      ...defaultPaymentMethodConfig,
      bcmc: { supportSeparateCapture: true },
      bancontact: { supportSeparateCapture: true },
    });
  });

  test('should ignore malformed JSON in ADYEN_PAYMENT_METHODS_CONFIG', () => {
    process.env.ADYEN_PAYMENT_METHODS_CONFIG = '{not-json';
    const { getPaymentMethodConfig, defaultPaymentMethodConfig } = getModule();

    const config = getPaymentMethodConfig();
    expect(config).toStrictEqual(defaultPaymentMethodConfig);
  });

  test('should ignore invalid payment method entries', () => {
    process.env.ADYEN_PAYMENT_METHODS_CONFIG = JSON.stringify({
      bcmc: { supportSeparateCapture: true },
      invalid_entry: { supportSeparateCapture: 'yes' },
      another_invalid: null,
    });

    const { getPaymentMethodConfig, defaultPaymentMethodConfig } = getModule();
    const config = getPaymentMethodConfig();

    expect(config).toStrictEqual({
      ...defaultPaymentMethodConfig,
      bcmc: { supportSeparateCapture: true },
    });
  });

  test('should ignore when JSON is not an object', () => {
    process.env.ADYEN_PAYMENT_METHODS_CONFIG = JSON.stringify(['array']);
    const { getPaymentMethodConfig, defaultPaymentMethodConfig } = getModule();

    const config = getPaymentMethodConfig();
    expect(config).toStrictEqual(defaultPaymentMethodConfig);
  });

  test('should add new payment methods from overrides', () => {
    process.env.ADYEN_PAYMENT_METHODS_CONFIG = JSON.stringify({
      new_method: { supportSeparateCapture: true },
    });

    const { getPaymentMethodConfig, defaultPaymentMethodConfig } = getModule();
    const config = getPaymentMethodConfig();

    expect(config).toStrictEqual({
      ...defaultPaymentMethodConfig,
      new_method: { supportSeparateCapture: true },
    });
  });
});
