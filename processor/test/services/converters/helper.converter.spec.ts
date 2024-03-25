import { describe, test, expect, afterEach, jest, beforeEach } from '@jest/globals';
import {
  convertPaymentMethodFromAdyenFormat,
  convertPaymentMethodToAdyenFormat,
  populateCartAddress,
} from '../../../src/services/converters/helper.converter';
import { Address as AdyenAddress } from '@adyen/api-library/lib/src/typings/checkout/address';
import { Address } from '@commercetools/connect-payments-sdk';
describe('helper.converter', () => {
  beforeEach(() => {
    jest.setTimeout(10000);
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('convertPaymentMethodFromAdyenFormat', async () => {
    const paymentMethod1 = 'scheme';
    const paymentMethod2 = 'klarna';
    const result1: string = convertPaymentMethodFromAdyenFormat(paymentMethod1);
    const result2: string = convertPaymentMethodFromAdyenFormat(paymentMethod2);
    expect(result1).toStrictEqual('card');
    expect(result2).toStrictEqual('klarna');
  });

  test('convertPaymentMethodToAdyenFormat', async () => {
    const paymentMethod1 = 'card';
    const paymentMethod2 = 'klarna';
    const result1: string = convertPaymentMethodToAdyenFormat(paymentMethod1);
    const result2: string = convertPaymentMethodToAdyenFormat(paymentMethod2);
    expect(result1).toStrictEqual('scheme');
    expect(result2).toStrictEqual('klarna');
  });

  test('populateCartAddress', async () => {
    const address1: Address = {
      country: 'Germany',
      city: 'Munich',
      streetName: 'Adam-Lehmann-Straße',
      streetNumber: '44',
      state: 'Bavaria',
      postalCode: '80797',
    };

    const result1: AdyenAddress = populateCartAddress(address1);

    expect(result1?.country).toStrictEqual('Germany');
    expect(result1?.city).toStrictEqual('Munich');
    expect(result1?.street).toStrictEqual('Adam-Lehmann-Straße');
    expect(result1?.stateOrProvince).toStrictEqual('Bavaria');
    expect(result1?.houseNumberOrName).toStrictEqual('44');
    expect(result1?.postalCode).toStrictEqual('80797');

    const address2: Address = {
      country: '',
    };

    const result2: AdyenAddress = populateCartAddress(address2);

    expect(result2?.country).toStrictEqual('');
    expect(result2?.city).toStrictEqual('');
    expect(result2?.street).toStrictEqual('');
    expect(result2?.stateOrProvince).toStrictEqual(undefined);
    expect(result2?.houseNumberOrName).toStrictEqual('');
    expect(result2?.postalCode).toStrictEqual('');
  });
});
