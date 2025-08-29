import { CreatePaymentConverter } from '../../../src/services/converters/create-payment.converter';
import { describe, test, expect, jest } from '@jest/globals';
import * as Helpers from '../../../src/services/converters/helper.converter';
import { Payment, type TPaymentRest } from '@commercetools/composable-commerce-test-data/payment';
import { CartRest, type TCartRest } from '@commercetools/composable-commerce-test-data/cart';
import { CreatePaymentRequestDTO } from '../../../src/dtos/adyen-payment.dto';
import { Cart } from '@commercetools/connect-payments-sdk';
import { paymentSDK } from '../../../src/payment-sdk';

jest.spyOn(Helpers, 'buildReturnUrl').mockReturnValue('https://commercetools.com');

describe('create-payment.converter', () => {
  const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService);

  test('should map over all required fields', async () => {
    const cartRandom = CartRest.random()
      .lineItems([])
      .customLineItems([])
      .buildRest<TCartRest>({
        omitFields: ['billingAddress', 'shippingAddress'],
      }) as Cart;
    const paymentRandom = Payment.random().buildRest<TPaymentRest>();
    const paymentRequestDTO: CreatePaymentRequestDTO = {} as CreatePaymentRequestDTO;

    const result = await converter.convertRequest({
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

  test('should set the additional data for afterpaytouch', async () => {
    const cartRandom = CartRest.random().customLineItems([]).buildRest<TCartRest>({}) as Cart;
    const paymentRandom = Payment.random().buildRest<TPaymentRest>();
    const paymentRequestDTO: CreatePaymentRequestDTO = {
      paymentMethod: { type: 'afterpaytouch' },
    } as CreatePaymentRequestDTO;

    const result = await converter.convertRequest({
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

  // TODO: SCC-3447: implement the create-payment.converter saved payment methods data mapper functionality
  describe('saved payment methods data', () => {
    test.todo('it should return empty object if the feature is disabled');
    test.todo(
      'it should return empty object if the the given type of payment method is not supported for tokenisation',
    );
    test.todo(
      'it should return empty object if the customer does not want to tokenise for the first time NOR pay with an existing token',
    );
    test.todo('it should return throw an "ErrorRequiredField" if no customerId is set on the cart');
    test.todo(
      'it should return throw an "ErrorInternalConstraintViolated" if the given tokenId does NOT belong to the customerId set on the cart',
    );
    test.todo('it should return the required saved payment methods data for tokenising for the first time');
    test.todo('it should return the required saved payment methods data when paying with an tokenId');
  });
});
