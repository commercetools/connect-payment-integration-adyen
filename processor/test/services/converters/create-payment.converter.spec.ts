import { CreatePaymentConverter } from '../../../src/services/converters/create-payment.converter';
import { describe, test, expect } from '@jest/globals';
import * as Helpers from '../../../src/services/converters/helper.converter';
import { Payment, type TPaymentRest } from '@commercetools/composable-commerce-test-data/payment';
import { CartRest, type TCartRest } from '@commercetools/composable-commerce-test-data/cart';
import { CreatePaymentRequestDTO } from '../../../src/dtos/adyen-payment.dto';

jest.spyOn(Helpers, 'buildReturnUrl').mockReturnValue('https://commercetools.com');

describe('create-payment.converter', () => {
  const converter = new CreatePaymentConverter();

  test('should map over all required fields', () => {
    const cartRandom = CartRest.random()
      .lineItems([])
      .customLineItems([])
      .buildRest<TCartRest>({
        omitFields: ['billingAddress', 'shippingAddress'],
      });
    const paymentRandom = Payment.random().buildRest<TPaymentRest>();
    const paymentRequestDTO: CreatePaymentRequestDTO = {} as CreatePaymentRequestDTO;

    const result = converter.convertRequest({
      data: paymentRequestDTO,
      cart: cartRandom,
      payment: paymentRandom,
    });

    const expected = {
      amount: {
        value: paymentRandom.amountPlanned.centAmount,
        currency: paymentRandom.amountPlanned.currencyCode,
      },
      reference: paymentRandom.id,
      merchantAccount: 'adyenMerchantAccount',
      countryCode: cartRandom.country,
      shopperEmail: cartRandom.customerEmail,
      returnUrl: 'https://commercetools.com',
      applicationInfo: {
        externalPlatform: {
          name: 'commercetools-connect',
          integrator: 'commercetools',
        },
        merchantApplication: {
          name: 'adyen-commercetools',
        },
      },
    };

    expect(result).toStrictEqual(expected);
  });

  test('should set the additional data for afterpaytouch', () => {
    const cartRandom = CartRest.random().customLineItems([]).buildRest<TCartRest>({});
    const paymentRandom = Payment.random().buildRest<TPaymentRest>();
    const paymentRequestDTO: CreatePaymentRequestDTO = {
      paymentMethod: { type: 'afterpaytouch' },
    } as CreatePaymentRequestDTO;

    const result = converter.convertRequest({
      data: paymentRequestDTO,
      cart: cartRandom,
      payment: paymentRandom,
    });

    const expected = {
      paymentMethod: { type: 'afterpaytouch' },
      shopperReference: cartRandom.customerId,
      shopperName: {
        firstName: cartRandom.billingAddress?.firstName,
        lastName: cartRandom.billingAddress?.lastName,
      },
      telephoneNumber: cartRandom.billingAddress?.phone,
      lineItems: expect.arrayContaining([]),
    };

    expect(result).toStrictEqual(expect.objectContaining(expected));
  });
});
