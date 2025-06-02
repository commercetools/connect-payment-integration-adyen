import { describe, test, expect, afterEach, jest, beforeEach } from '@jest/globals';
import {
  convertPaymentMethodFromAdyenFormat,
  convertPaymentMethodToAdyenFormat,
  populateCartAddress,
} from '../../../src/services/converters/helper.converter';
import { Address as AdyenAddress } from '@adyen/api-library/lib/src/typings/checkout/address';
import { Address } from '@commercetools/connect-payments-sdk';
import { GenericIssuerPaymentMethodDetails } from '@adyen/api-library/lib/src/typings/checkout/genericIssuerPaymentMethodDetails';

describe('helper.converter', () => {
  beforeEach(() => {
    jest.setTimeout(10000);
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('convertPaymentMethodFromAdyenFormat', async () => {
    const inputTable = [
      ['scheme', 'card'],
      ['klarna', 'klarna_pay_later'],
      ['klarna_paynow', 'klarna_pay_now'],
      ['klarna_account', 'klarna_pay_overtime'],
      ['bcmc', 'bancontactcard'],
      ['bcmc_mobile', 'bancontactmobile'],
      ['klarna_b2b', 'klarna_billie'],
      [GenericIssuerPaymentMethodDetails.TypeEnum.OnlineBankingPl, 'przelewy24'],
      ['afterpaytouch', 'afterpay'],
      ['unknown_method_should_return_this_value', 'unknown_method_should_return_this_value'],
    ];

    for (const testData of inputTable) {
      const adyenName = testData[0];
      const checkoutName = testData[1];

      const result = convertPaymentMethodFromAdyenFormat(adyenName);

      expect(result).toEqual(checkoutName);
    }
  });

  test('convertPaymentMethodToAdyenFormat', async () => {
    const inputTable = [
      ['card', 'scheme'],
      ['klarna_pay_later', 'klarna'],
      ['klarna_pay_now', 'klarna_paynow'],
      ['klarna_pay_overtime', 'klarna_account'],
      ['bancontactcard', 'bcmc'],
      ['bancontactmobile', 'bcmc_mobile'],
      ['klarna_billie', 'klarna_b2b'],
      ['przelewy24', GenericIssuerPaymentMethodDetails.TypeEnum.OnlineBankingPl],
      ['afterpay', 'afterpaytouch'],
      ['unknown_method_should_return_this_value', 'unknown_method_should_return_this_value'],
    ];

    for (const testData of inputTable) {
      const adyenName = testData[0];
      const checkoutName = testData[1];

      const result = convertPaymentMethodToAdyenFormat(adyenName);

      expect(result).toEqual(checkoutName);
    }
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
