import { CreatePaymentConverter } from '../../../src/services/converters/create-payment.converter';
import { describe, test, expect, jest } from '@jest/globals';
import * as Helpers from '../../../src/services/converters/helper.converter';
import { Payment, type TPaymentRest } from '@commercetools/composable-commerce-test-data/payment';
import { CartRest, type TCartRest } from '@commercetools/composable-commerce-test-data/cart';
import { CreatePaymentRequestDTO } from '../../../src/dtos/adyen-payment.dto';
import {
  Cart,
  ErrorInternalConstraintViolated,
  ErrorRequiredField,
  PaymentMethod,
} from '@commercetools/connect-payments-sdk';
import { paymentSDK } from '../../../src/payment-sdk';
import * as StoredPaymentMethodsConfig from '../../../src/config/stored-payment-methods.config';
import { DefaultPaymentMethodService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment-method.service';
import { RecurringApi } from '@adyen/api-library/lib/src/services/checkout/recurringApi';

jest.spyOn(Helpers, 'buildReturnUrl').mockReturnValue('https://commercetools.com');

describe('create-payment.converter', () => {
  const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService, paymentSDK.ctCartService);

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
      shopperName: {
        firstName: '',
        lastName: '',
      },
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

  test('should extract shopper name from billing address if it is present in the cart', async () => {
    const cartRandom = CartRest.random()
      .lineItems([])
      .customLineItems([])
      .billingAddress({
        firstName: 'John',
        lastName: 'Doe',
        country: 'US',
      })
      .buildRest<TCartRest>({}) as Cart;
    const paymentRandom = Payment.random().buildRest<TPaymentRest>();
    const paymentRequestDTO: CreatePaymentRequestDTO = {} as CreatePaymentRequestDTO;

    const result = await converter.convertRequest({
      data: paymentRequestDTO,
      cart: cartRandom,
      payment: paymentRandom,
    });

    expect(result).toStrictEqual(
      expect.objectContaining({
        shopperName: {
          firstName: 'John',
          lastName: 'Doe',
        },
      }),
    );
  });

  test('should extract shopper name from shipping address if billing address is omitted', async () => {
    const cartRandom = CartRest.random()
      .lineItems([])
      .customLineItems([])
      .shippingAddress({
        firstName: 'Jane',
        lastName: 'Doe',
        country: 'ES',
      })
      .buildRest<TCartRest>({
        omitFields: ['billingAddress'],
      }) as Cart;
    const paymentRandom = Payment.random().buildRest<TPaymentRest>();
    const paymentRequestDTO: CreatePaymentRequestDTO = {} as CreatePaymentRequestDTO;

    const result = await converter.convertRequest({
      data: paymentRequestDTO,
      cart: cartRandom,
      payment: paymentRandom,
    });

    expect(result).toStrictEqual(
      expect.objectContaining({
        shopperName: {
          firstName: 'Jane',
          lastName: 'Doe',
        },
      }),
    );
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

  describe('stored payment methods data', () => {
    const paymentInterface = 'paymentInterface';
    const interfaceAccount = 'interfaceAccount';

    test('it should return undefined if the feature is disabled', async () => {
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService, paymentSDK.ctCartService);

      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
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

      const result = await converter.populateStoredPaymentMethodsData(paymentRequestDTO, cartRandom);

      expect(result).toBeUndefined();
    });

    test('it should return undefined if the the given type of payment method is not supported for tokenisation', async () => {
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService, paymentSDK.ctCartService);

      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
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

      const result = await converter.populateStoredPaymentMethodsData(paymentRequestDTO, cartRandom);

      expect(result).toBeUndefined();
    });

    test('it should return undefined if the customer does not want to tokenise for the first time NOR pay with an existing token', async () => {
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService, paymentSDK.ctCartService);

      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
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

      const result = await converter.populateStoredPaymentMethodsData(paymentRequestDTO, cartRandom);

      expect(result).toBeUndefined();
    });

    test('it should return throw an "ErrorRequiredField" if no customerId is set on the cart', async () => {
      const storedPaymentMethodId = 'abcdefgh';
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService, paymentSDK.ctCartService);

      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
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

      const result = converter.populateStoredPaymentMethodsData(paymentRequestDTO, cartRandom);

      expect(result).rejects.toThrow(new ErrorRequiredField('customerId'));
    });

    test('it should return throw an "ErrorInternalConstraintViolated" if the given tokenId does NOT belong to the customerId set on the cart', async () => {
      const storedPaymentMethodId = 'abcdefgh';
      const customerId = '52a5774d-38c0-40b4-a2c6-512c5af6396e';
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService, paymentSDK.ctCartService);

      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
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

      const result = converter.populateStoredPaymentMethodsData(paymentRequestDTO, cartRandom);

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

    test('it should return the required stored payment methods data for tokenising for the first time', async () => {
      const customerId = '52a5774d-38c0-40b4-a2c6-512c5af6396e';
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService, paymentSDK.ctCartService);

      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
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
        .origin('Customer')
        .buildRest<TCartRest>({}) as Cart;
      const paymentRequestDTO: CreatePaymentRequestDTO = {
        paymentMethod: { type: 'scheme' },
        storePaymentMethod: true,
      } as CreatePaymentRequestDTO;

      const result = await converter.populateStoredPaymentMethodsData(paymentRequestDTO, cartRandom);

      expect(result).toStrictEqual({
        recurringProcessingModel: 'CardOnFile',
        shopperInteraction: 'Ecommerce',
        shopperReference: customerId,
        storePaymentMethod: true,
        paymentMethod: paymentRequestDTO.paymentMethod,
      });
    });

    test('it should return the required stored payment methods data when paying with an tokenId', async () => {
      const storedPaymentMethodId = 'abcdefgh';
      const customerId = '52a5774d-38c0-40b4-a2c6-512c5af6396e';
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService, paymentSDK.ctCartService);

      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
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
        .origin('Customer')
        .buildRest<TCartRest>({}) as Cart;
      const paymentRequestDTO: CreatePaymentRequestDTO = {
        paymentMethod: { type: 'scheme', storedPaymentMethodId },
      } as CreatePaymentRequestDTO;

      const result = await converter.populateStoredPaymentMethodsData(paymentRequestDTO, cartRandom);

      expect(result).toStrictEqual({
        recurringProcessingModel: 'CardOnFile',
        shopperInteraction: 'ContAuth',
        shopperReference: customerId,
        paymentMethod: paymentRequestDTO.paymentMethod,
      });
    });

    test('it should return the required stored payment methods data for tokenising for the first time when the cart is considered a recurring-cart', async () => {
      const customerId = '52a5774d-38c0-40b4-a2c6-512c5af6396e';
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService, paymentSDK.ctCartService);

      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
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
        .origin('RecurringOrder')
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;
      const paymentRequestDTO: CreatePaymentRequestDTO = {
        paymentMethod: { type: 'scheme' },
        storePaymentMethod: true,
      } as CreatePaymentRequestDTO;

      const result = await converter.populateStoredPaymentMethodsData(paymentRequestDTO, cartRandom);

      expect(result).toStrictEqual({
        recurringProcessingModel: 'Subscription',
        shopperInteraction: 'Ecommerce',
        shopperReference: customerId,
        storePaymentMethod: true,
        paymentMethod: paymentRequestDTO.paymentMethod,
      });
    });

    test('it should return the required stored payment methods data when paying with an tokenId when the cart is considered a recurring-cart', async () => {
      const storedPaymentMethodId = 'abcdefgh';
      const customerId = '52a5774d-38c0-40b4-a2c6-512c5af6396e';
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService, paymentSDK.ctCartService);

      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
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
        .origin('RecurringOrder')
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;
      const paymentRequestDTO: CreatePaymentRequestDTO = {
        paymentMethod: { type: 'scheme', storedPaymentMethodId },
      } as CreatePaymentRequestDTO;

      const result = await converter.populateStoredPaymentMethodsData(paymentRequestDTO, cartRandom);

      expect(result).toStrictEqual({
        recurringProcessingModel: 'Subscription',
        shopperInteraction: 'ContAuth',
        shopperReference: customerId,
        paymentMethod: paymentRequestDTO.paymentMethod,
      });
    });
  });

  describe('convertPaymentRequestForRecurringTokenPayments', () => {
    test('it should return the create-payment-request for Adyen recurring token payments', async () => {
      const merchantReference = 'some-merchant-reference';
      const customerId = '52a5774d-38c0-40b4-a2c6-512c5af6396e';
      const paymentMethodId = '23e979e0-6a1d-4920-8849-3c4c1d9f10f8';
      const paymentId = 'be6d6779-342c-4c48-b7d8-77e3f8030feb';
      const futureOrderNumber = 'futureOrderNumber-123';

      const adyenTokenId = 'abcdefgh';
      const converter = new CreatePaymentConverter(paymentSDK.ctPaymentMethodService, paymentSDK.ctCartService);

      const cartRandom = CartRest.random()
        .customerId(customerId)
        .customerEmail('johannes.vermeer@yahoo.com')
        .shippingMode('Single')
        .billingAddress({
          firstName: 'Johannes',
          lastName: 'Vermeer',
          streetName: 'Vlamingstraat',
          streetNumber: '42',
          additionalStreetInfo: '',
          postalCode: '2611 KX',
          city: 'Delft',
          country: 'NL',
          phone: '+16175245223',
          region: 'South Holland',
          email: 'Johannes.Vermeer@example.com',
        })
        .shippingAddress({
          firstName: 'Johannes',
          lastName: 'Vermeer',
          streetName: 'Vlamingstraat',
          streetNumber: '42',
          additionalStreetInfo: '',
          postalCode: '2611 KX',
          city: 'Delft',
          country: 'NL',
          phone: '+16175245223',
          region: 'South Holland',
          email: 'Johannes.Vermeer@example.com',
        })
        .buildRest<TCartRest>({}) as Cart;

      const paymentRandom = Payment.random().id(paymentId).buildRest<TPaymentRest>();

      const paymentMethod: PaymentMethod = {
        id: paymentMethodId,
        createdAt: '',
        lastModifiedAt: '',
        paymentMethodStatus: 'Active',
        version: 1,
        default: false,
        token: {
          value: adyenTokenId,
        },
      };

      jest.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: merchantReference,
        shopperReference: customerId,
        storedPaymentMethods: [
          {
            id: adyenTokenId,
            type: 'scheme',
            lastFour: '1234',
            brand: 'visa',
            expiryMonth: '03',
            expiryYear: '30',
          },
        ],
      });

      const result = await converter.convertPaymentRequestForRecurringTokenPayments({
        cart: cartRandom,
        payment: paymentRandom,
        paymentMethod,
        futureOrderNumber,
      });

      expect(result).toStrictEqual({
        recurringProcessingModel: 'Subscription',
        shopperInteraction: 'ContAuth',
        shopperReference: '52a5774d-38c0-40b4-a2c6-512c5af6396e',
        paymentMethod: {
          storedPaymentMethodId: 'abcdefgh',
          brand: 'visa',
        },
        amount: {
          value: paymentRandom.amountPlanned.centAmount,
          currency: paymentRandom.amountPlanned.currencyCode,
        },
        reference: 'be6d6779-342c-4c48-b7d8-77e3f8030feb',
        merchantAccount: 'adyenMerchantAccount',
        merchantOrderReference: 'futureOrderNumber-123',
        countryCode: 'NL',
        shopperEmail: 'johannes.vermeer@yahoo.com',
        returnUrl: '',
        billingAddress: {
          country: 'NL',
          city: 'Delft',
          street: 'Vlamingstraat',
          houseNumberOrName: '42',
          postalCode: '2611 KX',
          stateOrProvince: 'South Holland',
        },
        deliveryAddress: {
          country: 'NL',
          city: 'Delft',
          street: 'Vlamingstraat',
          houseNumberOrName: '42',
          postalCode: '2611 KX',
          stateOrProvince: 'South Holland',
        },
        applicationInfo: {
          externalPlatform: {
            name: 'commercetools-connect',
            integrator: 'commercetools',
          },
          merchantApplication: {
            name: 'adyen-commercetools',
          },
        },
      });
    });
  });
});
