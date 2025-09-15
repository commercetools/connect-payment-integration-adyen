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
  convertAdyenCardBrandToCTFormat,
  convertCTCardBrandToAdyenFormat,
} from '../../../src/services/converters/helper.converter';
import { Address as AdyenAddress } from '@adyen/api-library/lib/src/typings/checkout/address';
import { Address } from '@commercetools/connect-payments-sdk';
import { GenericIssuerPaymentMethodDetails } from '@adyen/api-library/lib/src/typings/checkout/genericIssuerPaymentMethodDetails';
import { LineItem } from '@adyen/api-library/lib/src/typings/checkout/lineItem';
import { Cart, LineItem as CoCoLineItem, CustomLineItem, ShippingInfo } from '@commercetools/connect-payments-sdk';
import CoCoCartSimpleJSON from '../../data/coco-cart-simple-shipping.json';
import CoCoCartMultipleJSON from '../../data/coco-cart-multiple-shipping.json';
import CoCoCartCLPJSON from '../../data/coco-cart-clp.json';
import CartDiscounts from '../../data/cart-discounts.json';

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

  test('convertCTCardBrandToAdyenFormat', async () => {
    const inputTable = [
      ['Amex', 'amex'],
      ['Maestro', 'maestro'],
      ['Mastercard', 'mc'],
      ['Visa', 'visa'],
      ['some-random-value-which-is-not-known', 'Unknown'],
      [undefined, 'Unknown'],
    ];

    for (const testData of inputTable) {
      const ctName = testData[0];
      const adyenName = testData[1];

      const result = convertCTCardBrandToAdyenFormat(ctName);

      expect(result).toEqual(adyenName);
    }
  });

  test('convertAdyenCardBrandToCTFormat', async () => {
    const inputTable = [
      ['amex', 'Amex'],
      ['maestro', 'Maestro'],
      ['mc', 'Mastercard'],
      ['visa', 'Visa'],
      ['some-random-value-which-is-not-known', 'Unknown'],
      [undefined, 'Unknown'],
    ];

    for (const testData of inputTable) {
      const adyenName = testData[0];
      const ctName = testData[1];

      const result = convertAdyenCardBrandToCTFormat(adyenName);

      expect(result).toEqual(ctName);
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

  test('should map the CoCo line items to Adyen line items', () => {
    const input = CoCoCartSimpleJSON.lineItems as CoCoLineItem[];

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
    const input: CustomLineItem[] = CoCoCartSimpleJSON.customLineItems as CustomLineItem[];

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
    const input: ShippingInfo = CoCoCartSimpleJSON.shippingInfo as ShippingInfo;

    const actual = mapCoCoShippingInfoToAdyenLineItem([
      { shippingInfo: input, shippingAddress: CoCoCartSimpleJSON.shippingAddress },
    ]);
    const expected: LineItem[] = [
      {
        description: 'Shipping - Standard Delivery',
        quantity: 1,
        amountExcludingTax: 1344,
        amountIncludingTax: 1599,
        taxAmount: 255,
        taxPercentage: 1900,
      },
    ];

    expect(actual).toEqual(expected);
  });

  test('should map CoCo shipping info to Adyen line item when multiple shipping', () => {
    const actual = mapCoCoShippingInfoToAdyenLineItem([
      {
        shippingInfo: CoCoCartMultipleJSON.shipping[0].shippingInfo as ShippingInfo,
        shippingAddress: CoCoCartMultipleJSON.shipping[0].shippingAddress,
      },
      {
        shippingInfo: CoCoCartMultipleJSON.shipping[1].shippingInfo as ShippingInfo,
        shippingAddress: CoCoCartMultipleJSON.shipping[1].shippingAddress,
      },
    ]);
    const expected: LineItem[] = [
      {
        amountExcludingTax: 9091,
        amountIncludingTax: 10000,
        description: 'Shipping - ddelizia-delivery',
        quantity: 1,
        taxAmount: 909,
        taxPercentage: 1000,
      },
      {
        amountExcludingTax: 870,
        amountIncludingTax: 1000,
        description: 'Shipping - Express Delivery',
        quantity: 1,
        taxAmount: 130,
        taxPercentage: 1500,
      },
    ];

    expect(actual).toEqual(expected);
  });

  test('should map CoCo discount info to Adyen line item', () => {
    const input = CoCoCartSimpleJSON.discountOnTotalPrice as any;

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
    const input = CoCoCartSimpleJSON as Cart;

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
        description: 'Shipping - Standard Delivery',
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

  test('should map a CoCo cart to Adyen line items when shipping mode is Multiple', () => {
    const input = CoCoCartMultipleJSON as Cart;

    const actual = mapCoCoCartItemsToAdyenLineItems(input);
    const expected: LineItem[] = [
      {
        amountExcludingTax: 817,
        amountIncludingTax: 899,
        description: 'Willow Teapot',
        id: 'WTP-09',
        quantity: 1,
        taxAmount: 82,
        taxPercentage: 0,
      },
      {
        amountExcludingTax: 9091,
        amountIncludingTax: 10000,
        description: 'Shipping - ddelizia-delivery',
        quantity: 1,
        taxAmount: 909,
        taxPercentage: 1000,
      },
      {
        amountExcludingTax: 870,
        amountIncludingTax: 1000,
        description: 'Shipping - Express Delivery',
        quantity: 1,
        taxAmount: 130,
        taxPercentage: 1500,
      },
    ];

    expect(actual).toEqual(expected);
  });

  test('should map the CoCo line items to Adyen line items taking into account Adyen deviations', () => {
    // CLP currencyCode according to ISO_4217 has 0 fractionDigits but Adyen expects 2 fractionDigits
    const input = CoCoCartCLPJSON.lineItems as CoCoLineItem[];

    const actual = mapCoCoLineItemToAdyenLineItem(input[0]);
    const expected: LineItem = {
      id: 'TST-02',
      description: 'Teak Serving Platter',
      quantity: 1,
      amountExcludingTax: 13400,
      amountIncludingTax: 15000,
      taxAmount: 1600,
      taxPercentage: 1200,
    };
    expect(actual).toEqual(expected);
  });

  /**
   * cart has the following discounts applied:
   * - direct product-discount with 10% off
   * - cart-discount which target the product with 5% off
   * - cart-discount which targets the total price with 10% off
   *
   * cart has single product with a quantity of 2
   * 200000 is the product price per one unit
   * 400000 is total product price without any discounts (200000 * 2 = 400000)
   *
   * Product discounts:
   *  20000 is the total product discounts (10% off, 200000 * 0.1 = 20000). Then on the remaining price, 180000 is the following cart-discount applied:
   *   9000 is the total cart-discount which targets the product (5% off, 180000 * 0.05 = 9000)
   *      +
   *  29000 is the total product related discounts on this cart, per one unit
   *
   * 342000 (lineItem.totalPrice, includes all product related discounts and multiplied by quantity) (400000 - 29000 * 2)
   *
   * Cart discount on totalPrice:
   *  34200 is the total discountOnTotalPrice (cart-discounts, 10% off on the total price of everything, 342000 * 0.1)
   *
   *  Final result:
   *  400000
   *   58000 (product-discount * quantity)
   *   34200 (total price discount)
   *       -
   * 307800 (cart.totalPrice user has to pay)
   */
  test('should map a CoCo cart which contains product-discounts and cart-discounts-which-target-products and cart-discounts on totalPrice to Adyen line items', () => {
    const cocoCartWithDiscountsApplied = CartDiscounts as Cart;

    const actual = mapCoCoCartItemsToAdyenLineItems(cocoCartWithDiscountsApplied, 'afterpaytouch');
    const expected: LineItem[] = [
      {
        id: 'MTSS-01',
        description: 'Modern Three Seater Sofa',
        quantity: 2,
        amountExcludingTax: 171500,
        amountIncludingTax: 200000,
        taxAmount: 28500,
        taxPercentage: 2000,
      },
      {
        id: 'MTSS-01-discount',
        description: 'Modern Three Seater Sofa discount',
        quantity: 2,
        amountIncludingTax: -29000,
      },
      {
        description: 'Discount',
        quantity: 1,
        amountExcludingTax: -28500,
        amountIncludingTax: -34200,
        taxAmount: -5700,
      },
    ];

    expect(actual).toEqual(expected);

    const totalPriceOfLineItem = actual[0]!.amountIncludingTax! * actual[0]!.quantity!;
    const totalProductDiscount = actual[1]!.amountIncludingTax! * actual[1]!.quantity!;
    const totalPriceDiscount = actual[2]!.amountIncludingTax!;

    const sum = totalPriceOfLineItem + totalProductDiscount + totalPriceDiscount;
    const cartTotalPrice = cocoCartWithDiscountsApplied.totalPrice.centAmount;

    expect(cocoCartWithDiscountsApplied.lineItems).toHaveLength(1);
    expect(sum).toEqual(cartTotalPrice);
  });
});
