import { CreatePaymentConverter } from '../../../src/services/converters/create-payment.converter';
import { describe, test, expect, jest } from '@jest/globals';
import * as Helpers from '../../../src/services/converters/helper.converter';
import { Payment, type TPaymentRest } from '@commercetools/composable-commerce-test-data/payment';
import { CartRest, type TCartRest } from '@commercetools/composable-commerce-test-data/cart';
import { CreatePaymentRequestDTO } from '../../../src/dtos/adyen-payment.dto';
import { Cart, ErrorInternalConstraintViolated, ErrorRequiredField } from '@commercetools/connect-payments-sdk';
import { paymentSDK } from '../../../src/payment-sdk';
import * as SavedPaymentsConfig from '../../../src/config/saved-payment-method.config';
import { DefaultPaymentMethodService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment-method.service';

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

  describe('saved payment methods data', () => {
    const paymentInterface = 'paymentInterface';
    const interfaceAccount = 'interfaceAccount';

    test('it should return undefined if the feature is disabled', async () => {
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService);

      jest.spyOn(SavedPaymentsConfig, 'getSavedPaymentsConfig').mockReturnValue({
        enabled: false,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });

      const cartRandom = CartRest.random().lineItems([]).customLineItems([]).buildRest<TCartRest>({}) as Cart;
      const paymentRequestDTO: CreatePaymentRequestDTO = {
        paymentMethod: { type: 'scheme' },
      } as CreatePaymentRequestDTO;

      const result = await converter.populateSavedPaymentMethodData(paymentRequestDTO, cartRandom);

      expect(result).toBeUndefined();
    });

    test('it should return undefined if the the given type of payment method is not supported for tokenisation', async () => {
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService);

      jest.spyOn(SavedPaymentsConfig, 'getSavedPaymentsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });

      const cartRandom = CartRest.random().lineItems([]).customLineItems([]).buildRest<TCartRest>({}) as Cart;
      const paymentRequestDTO: CreatePaymentRequestDTO = {
        paymentMethod: { type: 'afterpaytouch' },
      } as CreatePaymentRequestDTO;

      const result = await converter.populateSavedPaymentMethodData(paymentRequestDTO, cartRandom);

      expect(result).toBeUndefined();
    });

    test('it should return undefined if the customer does not want to tokenise for the first time NOR pay with an existing token', async () => {
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService);

      jest.spyOn(SavedPaymentsConfig, 'getSavedPaymentsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });

      const cartRandom = CartRest.random().lineItems([]).customLineItems([]).buildRest<TCartRest>({}) as Cart;
      const paymentRequestDTO: CreatePaymentRequestDTO = {
        paymentMethod: { type: 'scheme' },
      } as CreatePaymentRequestDTO;

      const result = await converter.populateSavedPaymentMethodData(paymentRequestDTO, cartRandom);

      expect(result).toBeUndefined();
    });

    test('it should return throw an "ErrorRequiredField" if no customerId is set on the cart', async () => {
      const storedPaymentMethodId = 'abcdefgh';
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService);

      jest.spyOn(SavedPaymentsConfig, 'getSavedPaymentsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .buildRest<TCartRest>({
          omitFields: ['customerId'],
        }) as Cart;
      const paymentRequestDTO: CreatePaymentRequestDTO = {
        paymentMethod: { type: 'scheme', storedPaymentMethodId },
        storePaymentMethod: true,
      } as CreatePaymentRequestDTO;

      const result = converter.populateSavedPaymentMethodData(paymentRequestDTO, cartRandom);

      expect(result).rejects.toThrow(new ErrorRequiredField('customerId'));
    });

    test('it should return throw an "ErrorInternalConstraintViolated" if the given tokenId does NOT belong to the customerId set on the cart', async () => {
      const storedPaymentMethodId = 'abcdefgh';
      const customerId = '52a5774d-38c0-40b4-a2c6-512c5af6396e';
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService);

      jest.spyOn(SavedPaymentsConfig, 'getSavedPaymentsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });
      jest.spyOn(DefaultPaymentMethodService.prototype, 'doesTokenBelongsToCustomer').mockResolvedValueOnce(false);

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;
      const paymentRequestDTO: CreatePaymentRequestDTO = {
        paymentMethod: { type: 'scheme', storedPaymentMethodId },
        storePaymentMethod: true,
      } as CreatePaymentRequestDTO;

      const result = converter.populateSavedPaymentMethodData(paymentRequestDTO, cartRandom);

      expect(result).rejects.toThrow(
        new ErrorInternalConstraintViolated(
          'The provided token does not belong to the given customer for any payment method currently stored.',
        ),
      );
      expect(DefaultPaymentMethodService.prototype.doesTokenBelongsToCustomer).toHaveBeenCalledWith({
        customerId,
        paymentInterface,
        interfaceAccount,
        tokenValue: storedPaymentMethodId,
      });
    });

    test('it should return the required saved payment methods data for tokenising for the first time', async () => {
      const customerId = '52a5774d-38c0-40b4-a2c6-512c5af6396e';
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService);

      jest.spyOn(SavedPaymentsConfig, 'getSavedPaymentsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });
      jest.spyOn(DefaultPaymentMethodService.prototype, 'doesTokenBelongsToCustomer').mockResolvedValueOnce(true);

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;
      const paymentRequestDTO: CreatePaymentRequestDTO = {
        paymentMethod: { type: 'scheme' },
        storePaymentMethod: true,
      } as CreatePaymentRequestDTO;

      const result = await converter.populateSavedPaymentMethodData(paymentRequestDTO, cartRandom);

      expect(result).toStrictEqual({
        recurringProcessingModel: 'CardOnFile',
        shopperInteraction: 'Ecommerce',
        shopperReference: customerId,
        storePaymentMethod: true,
        paymentMethod: paymentRequestDTO.paymentMethod,
      });
    });

    test('it should return the required saved payment methods data when paying with an tokenId', async () => {
      const storedPaymentMethodId = 'abcdefgh';
      const customerId = '52a5774d-38c0-40b4-a2c6-512c5af6396e';
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService);

      jest.spyOn(SavedPaymentsConfig, 'getSavedPaymentsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });
      jest.spyOn(DefaultPaymentMethodService.prototype, 'doesTokenBelongsToCustomer').mockResolvedValueOnce(true);

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;
      const paymentRequestDTO: CreatePaymentRequestDTO = {
        paymentMethod: { type: 'scheme', storedPaymentMethodId },
      } as CreatePaymentRequestDTO;

      const result = await converter.populateSavedPaymentMethodData(paymentRequestDTO, cartRandom);

      expect(result).toStrictEqual({
        recurringProcessingModel: 'CardOnFile',
        shopperInteraction: 'ContAuth',
        shopperReference: customerId,
        paymentMethod: paymentRequestDTO.paymentMethod,
      });
    });
  });
});
