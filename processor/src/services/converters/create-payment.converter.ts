import { PaymentRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRequest';
import { ThreeDSRequestData } from '@adyen/api-library/lib/src/typings/checkout/threeDSRequestData';

import { config } from '../../config/config';
import {
  Cart,
  CurrencyConverters,
  Payment,
  CommercetoolsPaymentMethodService,
  ErrorRequiredField,
  ErrorInternalConstraintViolated,
} from '@commercetools/connect-payments-sdk';
import {
  buildReturnUrl,
  getShopperStatement,
  populateApplicationInfo,
  populateCartAddress,
  mapCoCoCartItemsToAdyenLineItems,
} from './helper.converter';
import { CreatePaymentRequestDTO } from '../../dtos/adyen-payment.dto';
import { getFutureOrderNumberFromContext } from '../../libs/fastify/context/context';
import { paymentSDK } from '../../payment-sdk';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';
import { randomUUID } from 'node:crypto';
import { getStoredPaymentMethodsConfig } from '../../config/stored-payment-methods.config';
import { PaymentAmount } from '@commercetools/connect-payments-sdk/dist/commercetools/types/payment.type';

type ExpressPayment = {
  amountPlanned: PaymentAmount;
  id: string;
};
export class CreatePaymentConverter {
  private ctPaymentMethodService: CommercetoolsPaymentMethodService;

  constructor(ctPaymentMethodService: CommercetoolsPaymentMethodService) {
    this.ctPaymentMethodService = ctPaymentMethodService;
  }

  public async convertRequest(opts: {
    data: CreatePaymentRequestDTO;
    cart: Cart;
    payment: Payment;
  }): Promise<PaymentRequest> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { paymentReference: _, ...requestData } = opts.data;
    const futureOrderNumber = getFutureOrderNumberFromContext();
    const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart: opts.cart });
    const shopperStatement = getShopperStatement();

    const storedPaymentMethodsData = await this.populateStoredPaymentMethodsData(opts.data, opts.cart);
    return {
      ...requestData,
      amount: {
        value: CurrencyConverters.convertWithMapping({
          mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
          amount: opts.payment.amountPlanned.centAmount,
          currencyCode: opts.payment.amountPlanned.currencyCode,
        }),
        currency: opts.payment.amountPlanned.currencyCode,
      },
      reference: opts.payment.id,
      merchantAccount: config.adyenMerchantAccount,
      countryCode: opts.cart.billingAddress?.country || opts.cart.country,
      shopperEmail: opts.cart.customerEmail,
      returnUrl: buildReturnUrl(opts.payment.id),
      ...(opts.cart.billingAddress && {
        billingAddress: populateCartAddress(opts.cart.billingAddress),
      }),
      ...(deliveryAddress && {
        deliveryAddress: populateCartAddress(deliveryAddress),
      }),
      ...(futureOrderNumber && { merchantOrderReference: futureOrderNumber }),
      ...this.populateAdditionalPaymentMethodData(opts.data, opts.cart),
      applicationInfo: populateApplicationInfo(),
      ...(shopperStatement && { shopperStatement }),
      ...storedPaymentMethodsData,
    };
  }

  public async convertExpressRequest(opts: {
    data: CreatePaymentRequestDTO;
    cart: Cart;
    payment: ExpressPayment;
  }): Promise<PaymentRequest> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { paymentReference: _, ...requestData } = opts.data;
    const futureOrderNumber = getFutureOrderNumberFromContext();
    const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart: opts.cart });
    const shopperStatement = getShopperStatement();

    return {
      ...requestData,
      amount: {
        value: CurrencyConverters.convertWithMapping({
          mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
          amount: opts.payment.amountPlanned.centAmount,
          currencyCode: opts.payment.amountPlanned.currencyCode,
        }),
        currency: opts.payment.amountPlanned.currencyCode,
      },
      reference: opts.payment.id,
      merchantAccount: config.adyenMerchantAccount,
      countryCode: opts.cart.billingAddress?.country || opts.cart.country,
      shopperEmail: opts.cart.customerEmail,
      returnUrl: buildReturnUrl(opts.payment.id),
      ...(opts.cart.billingAddress && {
        billingAddress: populateCartAddress(opts.cart.billingAddress),
      }),
      ...(deliveryAddress && {
        deliveryAddress: populateCartAddress(deliveryAddress),
      }),
      ...(futureOrderNumber && { merchantOrderReference: futureOrderNumber }),
      ...this.populateAdditionalPaymentMethodData(opts.data, opts.cart),
      applicationInfo: populateApplicationInfo(),
      ...(shopperStatement && { shopperStatement }),
    };
  }

  public async populateStoredPaymentMethodsData(
    data: Pick<CreatePaymentRequestDTO, 'paymentMethod' | 'storePaymentMethod'>,
    cart: Pick<Cart, 'id' | 'customerId'>,
  ) {
    if (!getStoredPaymentMethodsConfig().enabled) {
      return;
    }

    const paymentMethodType = data.paymentMethod.type;
    if (
      typeof paymentMethodType !== 'string' ||
      !Object.keys(getStoredPaymentMethodsConfig().config.supportedPaymentMethodTypes).includes(paymentMethodType)
    ) {
      return;
    }

    const storedPaymentMethodIdKeyValuePair = Object.entries(data.paymentMethod).find(
      (keyValuePair) => keyValuePair[0] === 'storedPaymentMethodId',
    );

    const payWithExistingToken = storedPaymentMethodIdKeyValuePair !== undefined;
    const tokeniseForFirstTime = data.storePaymentMethod;

    // User does not want to store token for the first time nor pay with existing one
    if (!tokeniseForFirstTime && !payWithExistingToken) {
      return;
    }

    const customerReference = cart.customerId;

    if (!customerReference) {
      throw new ErrorRequiredField('customerId', {
        privateMessage: 'The customerId is not set on the cart yet the customer wants to tokenize the payment',
        privateFields: {
          cart: {
            id: cart.id,
            typeId: 'cart',
          },
        },
      });
    }

    if (payWithExistingToken) {
      const storedPaymentMethodId = storedPaymentMethodIdKeyValuePair[1];
      const doesTokenBelongsToCustomer = await this.ctPaymentMethodService.doesTokenBelongsToCustomer({
        customerId: customerReference,
        paymentInterface: getStoredPaymentMethodsConfig().config.paymentInterface,
        interfaceAccount: getStoredPaymentMethodsConfig().config.interfaceAccount,
        tokenValue: storedPaymentMethodId,
      });

      if (!doesTokenBelongsToCustomer) {
        throw new ErrorInternalConstraintViolated(
          'The provided token does not belong to the given customer for any payment method currently stored.',
          {
            privateFields: {
              cart: {
                id: cart.id,
                typeId: 'cart',
              },
              customerId: customerReference,
              paymentInterface: getStoredPaymentMethodsConfig().config.paymentInterface,
              interfaceAccount: getStoredPaymentMethodsConfig().config.interfaceAccount,
            },
          },
        );
      }
    }

    const shopperInteraction = payWithExistingToken
      ? PaymentRequest.ShopperInteractionEnum.ContAuth // For paying with existing tokens
      : PaymentRequest.ShopperInteractionEnum.Ecommerce; // When tokenising for the first time

    return {
      recurringProcessingModel: PaymentRequest.RecurringProcessingModelEnum.CardOnFile, // always the same static value
      shopperInteraction,
      shopperReference: customerReference,
      ...(tokeniseForFirstTime ? { storePaymentMethod: true } : {}), // only applicable when user wants to tokenise payment details for the first time
      paymentMethod: data.paymentMethod,
    };
  }

  private populateAdditionalPaymentMethodData(data: CreatePaymentRequestDTO, cart: Cart) {
    switch (data?.paymentMethod?.type) {
      case 'scheme':
        return this.populateAdditionalCardData();
      case 'klarna':
      case 'klarna_paynow':
      case 'klarna_account':
      case 'paypal': {
        return {
          lineItems: mapCoCoCartItemsToAdyenLineItems(cart, data.paymentMethod.type),
        };
      }
      // clearpay is the same as afterpaytouch
      case 'clearpay':
      case 'afterpaytouch': {
        return this.populateAfterpayData(cart, data.paymentMethod.type);
      }
      case 'klarna_b2b': {
        return this.populateKlarnaB2BData(cart, data.paymentMethod.type);
      }
      default:
        return {};
    }
  }

  private populateAdditionalCardData() {
    return {
      authenticationData: {
        threeDSRequestData: {
          nativeThreeDS: ThreeDSRequestData.NativeThreeDSEnum.Preferred,
        },
      },
    };
  }

  private populateAfterpayData(cart: Cart, paymentMethodType: string): Partial<PaymentRequest> {
    const { billingAddress, shippingAddress } = cart;

    const lineItems = mapCoCoCartItemsToAdyenLineItems(cart, paymentMethodType);

    return {
      shopperReference: cart.customerId ?? cart.anonymousId ?? randomUUID(),
      shopperName: {
        firstName: billingAddress?.firstName ?? shippingAddress?.firstName ?? '',
        lastName: billingAddress?.lastName ?? shippingAddress?.lastName ?? '',
      },
      telephoneNumber: (billingAddress?.phone || shippingAddress?.phone) ?? undefined,
      lineItems,
    };
  }

  private populateKlarnaB2BData(cart: Cart, paymentMethodType: string): Partial<PaymentRequest> {
    const { billingAddress } = cart;
    const { firstName, lastName, company } = billingAddress || {};

    const lineItems = mapCoCoCartItemsToAdyenLineItems(cart, paymentMethodType);
    return {
      shopperName: {
        firstName: firstName ?? '',
        lastName: lastName ?? '',
      },
      company: {
        name: company ?? '',
      },
      lineItems,
    };
  }
}
