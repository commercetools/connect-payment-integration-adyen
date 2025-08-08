import { PaymentRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRequest';
import { ThreeDSRequestData } from '@adyen/api-library/lib/src/typings/checkout/threeDSRequestData';

import { config } from '../../config/config';
import {
  Cart,
  CurrencyConverters,
  Payment,
  CommercetoolsPaymentMethodService,
  ErrorRequiredField,
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
import { supportedSavedPaymentMethodTypes } from '../../config/payment-method.config';
import { getSavedPaymentsConfig } from '../../config/saved-payment-method.config';

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

    const savedPaymentMethodData = await this.populateSavedPaymentMethodData(opts.data, opts.cart);

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
      ...this.populateAddionalPaymentMethodData(opts.data, opts.cart),
      applicationInfo: populateApplicationInfo(),
      ...(shopperStatement && { shopperStatement }),
      ...savedPaymentMethodData,
    };
  }

  private async populateSavedPaymentMethodData(data: CreatePaymentRequestDTO, cart: Cart) {
    if (!getSavedPaymentsConfig().enabled) {
      return;
    }

    const paymentMethodType = data.paymentMethod.type;
    if (
      typeof paymentMethodType !== 'string' ||
      !Object.keys(supportedSavedPaymentMethodTypes).includes(paymentMethodType)
    ) {
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

    // TODO: SCC-3447: talk with Juan to see if we can use the same attributes for storePaymentMethod and storedPaymentMethodId (and thus NOT receive the cocoSavedPaymentMethodId)

    // drop-in provide it via "storePaymentMethod" and non-dropin provides via "storePaymentDetails"
    const userWantsToStorePaymentDetails = data.storePaymentMethod || data.storePaymentDetails ? true : false;

    // In the case of drop-in component the token is already provided ootb as the "storedPaymentMethodId"
    const includesStoredPaymentMethodId = Object.keys(data.paymentMethod).includes('storedPaymentMethodId');

    const payWithExistingToken = includesStoredPaymentMethodId || data.cocoSavedPaymentMethodId !== undefined;

    if (includesStoredPaymentMethodId && data.cocoSavedPaymentMethodId) {
      return;
    }

    // In case user does not want to store token nor pay with existing one return nothing
    if (!userWantsToStorePaymentDetails && !payWithExistingToken) {
      console.log('not storing nor paying with existing');
      return;
    }

    const shopperInteraction = payWithExistingToken
      ? PaymentRequest.ShopperInteractionEnum.ContAuth // For paying with existing tokens
      : PaymentRequest.ShopperInteractionEnum.Ecommerce; // When tokenising for the first time

    const res = {
      recurringProcessingModel: PaymentRequest.RecurringProcessingModelEnum.CardOnFile,
      shopperInteraction,
      shopperReference: customerReference,
      ...(userWantsToStorePaymentDetails ? { storePaymentMethod: userWantsToStorePaymentDetails } : {}), // only applicable when user wants to tokenise payment details for the first time
      paymentMethod: {
        ...data.paymentMethod, // for drop-in the "storedPaymentMethodId" is provided ootb and thus only required to expand
        ...(data.cocoSavedPaymentMethodId
          ? {
              storedPaymentMethodId: await this.getStoredTokenIdFromCoCo(
                cart.id,
                customerReference,
                data.cocoSavedPaymentMethodId,
              ),
            }
          : {}), // for non-dropin get the token from CoCo payment-methods
      },
    };

    return res;
  }

  private async getStoredTokenIdFromCoCo(
    cartId: string,
    customerReference: string,
    cocoPaymentMethodId: string,
  ): Promise<string> {
    const paymentMethodFromCoCo = await this.ctPaymentMethodService.get({
      customerId: customerReference,
      id: cocoPaymentMethodId,
      paymentInterface: getSavedPaymentsConfig().config.paymentInterface,
      interfaceAccount: getSavedPaymentsConfig().config.interfaceAccount,
    });

    const token = paymentMethodFromCoCo.token;

    if (!token) {
      throw new ErrorRequiredField('token', {
        privateMessage:
          'The token attribute is not set on the CT payment method yet the user wants to pay with the payment method',
        privateFields: {
          cart: {
            id: cartId,
            typeId: 'cart',
          },
          paymentMethod: {
            id: paymentMethodFromCoCo.id,
            typeId: 'payment-method',
          },
          customer: {
            id: customerReference,
            typeId: 'customer',
          },
        },
      });
    }

    return token.value;
  }

  private populateAddionalPaymentMethodData(data: CreatePaymentRequestDTO, cart: Cart) {
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
    const { firstName, lastName, email, company } = billingAddress || {};

    const hasValidBillingAddress = (): boolean => {
      return !!(company && firstName && lastName && email);
    };

    const lineItems = mapCoCoCartItemsToAdyenLineItems(cart, paymentMethodType);

    if (hasValidBillingAddress()) {
      return {
        shopperName: {
          firstName: firstName ?? '',
          lastName: lastName ?? '',
        },
        company: {
          name: company ?? '',
        },
        shopperEmail: email,
        lineItems,
      };
    } else {
      return {
        lineItems,
      };
    }
  }
}
