import { describe, test, expect } from '@jest/globals';
import { PaymentComponentsConverter } from '../../../src/services/converters/payment-components.converter';

describe('payment-components.converter', () => {
  const converter = new PaymentComponentsConverter();

  test('convertResponse returns the embedded dropin', () => {
    const result = converter.convertResponse();
    expect(result.dropins).toEqual([{ type: 'embedded' }]);
  });

  test('convertResponse includes zip in components', () => {
    const result = converter.convertResponse();
    expect(result.components).toContainEqual({ type: 'zip' });
  });

  test('convertResponse includes all expected components', () => {
    const result = converter.convertResponse();
    const types = result.components.map((c) => c.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'afterpay',
        'applepay',
        'bancontactcard',
        'bancontactmobile',
        'blik',
        'card',
        'eps',
        'fpx',
        'googlepay',
        'ideal',
        'klarna_billie',
        'klarna_pay_later',
        'klarna_pay_now',
        'klarna_pay_overtime',
        'mobilepay',
        'paypal',
        'przelewy24',
        'sepadirectdebit',
        'swish',
        'twint',
        'vipps',
        'clearpay',
        'mbway',
        'trustly',
        'zip',
      ]),
    );
  });

  test('convertResponse includes express methods', () => {
    const result = converter.convertResponse();
    expect(result.express).toEqual([{ type: 'applepay' }, { type: 'googlepay' }, { type: 'paypal' }]);
  });
});
