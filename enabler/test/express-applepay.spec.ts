import { describe, test, expect, jest, beforeEach } from '@jest/globals';

/**
 * Captures the options object handed to Adyen's `ApplePay` constructor so the tests can assert on the
 * ApplePayPaymentRequest the shopper's browser would actually receive.
 */
const applePayConstructorCalls: Record<string, any>[] = [];

jest.mock('@adyen/adyen-web', () => ({
  ApplePay: class {
    constructor(_core: unknown, options: Record<string, any>) {
      applePayConstructorCalls.push(options);
    }
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ApplePayExpressBuilder } = require('../src/express/applepay');

const build = (applePayConfig?: { usesOwnCertificate: boolean }) => {
  const builder = new ApplePayExpressBuilder({
    adyenCheckout: {} as any,
    processorUrl: 'https://processor.example',
    sessionId: 'session-id',
    countryCode: 'AU',
    currencyCode: 'AUD',
    applePayConfig,
    paymentMethodConfig: { merchantId: 'MerchantId_TEST', merchantName: 'Merchant' },
    onComplete: () => {},
  });

  builder.build({
    allowedCountries: ['AU'],
    initialAmount: { currencyCode: 'AUD', centAmount: 154495, fractionDigits: 2 },
    onPayButtonClick: async () => ({ sessionId: 'session-id' }),
  } as any);

  return applePayConstructorCalls[applePayConstructorCalls.length - 1];
};

beforeEach(() => {
  applePayConstructorCalls.length = 0;
});

describe('ApplePayExpressBuilder merchant validation', () => {
  test('registers onValidateMerchant when the merchant uses its own Apple Pay certificate', () => {
    // Merchants with their own Apple Pay merchant identifier must validate against their own certificate, which
    // only happens if the callback is wired up. The non-express component (components/payment-methods/applepay.ts)
    // reads the same flag off baseOptions; the express builder used to drop it, leaving merchant validation
    // unregistered for express payments only.
    const options = build({ usesOwnCertificate: true });

    expect(typeof options.onValidateMerchant).toBe('function');
  });

  test('omits onValidateMerchant when Adyen’s certificate is used', () => {
    const options = build({ usesOwnCertificate: false });

    expect(options.onValidateMerchant).toBeUndefined();
  });

  test('omits onValidateMerchant when no applePayConfig is provided', () => {
    const options = build(undefined);

    expect(options.onValidateMerchant).toBeUndefined();
  });
});
