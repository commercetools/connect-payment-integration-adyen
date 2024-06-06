import { describe, test, expect, afterEach, jest, beforeEach } from '@jest/globals';
import {
  convertPaymentMethodFromAdyenFormat,
  convertPaymentMethodToAdyenFormat,
  populateCartAddress,
  mapCoCoCartItemsToAdyenLineItems,
  mapCoCoLineItemToAdyenLineItem,
  mapCoCoCustomLineItemToAdyenLineItem,
  mapCoCoShippingInfoToAdyenLineItem,
  mapCoCoDiscountOnTotalPriceToAdyenLineItem,
} from '../../../src/services/converters/helper.converter';
import { LineItem } from '@adyen/api-library/lib/src/typings/checkout/lineItem';
import { Address as AdyenAddress } from '@adyen/api-library/lib/src/typings/checkout/address';
import {
  Address,
  Cart,
  LineItem as CoCoLineItem,
  CustomLineItem,
  ShippingInfo,
} from '@commercetools/connect-payments-sdk';
import CoCoCartJSON from '../../data/coco-cart.json';

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

  test('should map the CoCo line items to Adyen line items', () => {
    const input = CoCoCartJSON.lineItems as CoCoLineItem[];

    const actual = mapCoCoLineItemToAdyenLineItem(input[0]);
    const expected: LineItem = {
      id: 'WCSI-09',
      description: 'Walnut Counter Stool',
      quantity: 1,
      amountExcludingTax: 7562,
      amountIncludingTax: 8999,
      taxAmount: 1437,
      taxPercentage: 1900,
    };

    expect(actual).toEqual(expected);
  });

  test('should map the CoCo custom line items to Adyen line items', () => {
    const input: CustomLineItem[] = CoCoCartJSON.customLineItems as CustomLineItem[];

    const actual = mapCoCoCustomLineItemToAdyenLineItem(input[0]);
    const expected: LineItem = {
      id: 'fbb6ea54-e96b-4ebe-b4c9-ccad345bd5d6',
      description: 'Walnut Counter Stool',
      quantity: 1,
      amountExcludingTax: 7562,
      amountIncludingTax: 8999,
      taxAmount: 1437,
      taxPercentage: 1900,
    };

    expect(actual).toEqual(expected);
  });

  test('should map CoCo shipping info to Adyen line item', () => {
    const input: ShippingInfo = CoCoCartJSON.shippingInfo as ShippingInfo;

    const actual = mapCoCoShippingInfoToAdyenLineItem(input);
    const expected: LineItem = {
      description: 'Shipping',
      quantity: 1,
      amountExcludingTax: 1344,
      amountIncludingTax: 1599,
      taxAmount: 255,
      taxPercentage: 1900,
    };

    expect(actual).toEqual(expected);
  });

  test('should map CoCo shipping info to Adyen line item', () => {
    const input = CoCoCartJSON.discountOnTotalPrice as any;

    const actual = mapCoCoDiscountOnTotalPriceToAdyenLineItem({ discountOnTotalPrice: input });
    const expected: LineItem = {
      description: 'Discount',
      quantity: 1,
      amountExcludingTax: -891,
      amountIncludingTax: -1060,
      taxAmount: -169,
    };

    expect(actual).toEqual(expected);
  });

  test('should map a CoCo cart to Adyen line items', () => {
    const input = CoCoCartJSON as Cart;

    const actual = mapCoCoCartItemsToAdyenLineItems(input);
    const expected: LineItem[] = [
      {
        id: 'WCSI-09',
        description: 'Walnut Counter Stool',
        quantity: 1,
        amountExcludingTax: 7562,
        amountIncludingTax: 8999,
        taxAmount: 1437,
        taxPercentage: 1900,
      },
      {
        id: 'fbb6ea54-e96b-4ebe-b4c9-ccad345bd5d6',
        description: 'Walnut Counter Stool',
        quantity: 1,
        amountExcludingTax: 7562,
        amountIncludingTax: 8999,
        taxAmount: 1437,
        taxPercentage: 1900,
      },
      {
        description: 'Shipping',
        quantity: 1,
        amountExcludingTax: 1344,
        amountIncludingTax: 1599,
        taxAmount: 255,
        taxPercentage: 1900,
      },
      {
        description: 'Discount',
        quantity: 1,
        amountExcludingTax: -891,
        amountIncludingTax: -1060,
        taxAmount: -169,
      },
    ];

    expect(actual).toEqual(expected);
  });
});
