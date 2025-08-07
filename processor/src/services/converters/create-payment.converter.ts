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

    // TODO: SCC-3447: this optional string value is given as a new parameter to this function by the SPA/enabler. Change this around. (undefined means no existing payment method will be used). Could this differ between web-component and drop-in?
    const cocoSavedPaymentMethod = '5cb63117-e92c-4891-94dc-6349d1600649';
    // const cocoSavedPaymentMethod = undefined;

    // TODO: SCC-3447: this boolean value is given as a new parameter to this function by the SPA/enabler if the customer wants to save the pm. Could this differ between web-component and drop-in?
    const shouldUseOrStorePaymentMethod = true; // opts.data.storePaymentMethod ? true : false; // for testing right now use the value from the adyen build-in component. (web-component or drop-in)

    const savedPaymentMethodData = await this.populateSavedPaymentMethodData(
      opts.data,
      opts.cart,
      shouldUseOrStorePaymentMethod,
      cocoSavedPaymentMethod,
    );

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

  private async populateSavedPaymentMethodData(
    data: CreatePaymentRequestDTO,
    cart: Cart,
    shouldUseOrStorePaymentMethod: boolean,
    cocoPaymentMethodId?: string,
  ) {
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

    if (!shouldUseOrStorePaymentMethod) {
      // Customer does not want to save payment method
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

    // Customer wants to pay with an already saved payment method
    if (cocoPaymentMethodId) {
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
              id: cart.id,
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

      return {
        recurringProcessingModel: PaymentRequest.RecurringProcessingModelEnum.CardOnFile,
        shopperInteraction: PaymentRequest.ShopperInteractionEnum.ContAuth,
        shopperReference: customerReference,
        paymentMethod: {
          // TODO: SCC-3447: all explicit and implicit data that is required should be added here. The Adyen web-component and drop-in provide this in the incoming request but the token is retrieved from Coco saved pm. Do we need to combine anything?
          ...data.paymentMethod,
          storedPaymentMethodId: token.value,
        },
      };
    }

    // Customer wants to store the payment method
    return {
      recurringProcessingModel: PaymentRequest.RecurringProcessingModelEnum.CardOnFile,
      shopperInteraction: PaymentRequest.ShopperInteractionEnum.Ecommerce,
      shopperReference: customerReference,
      storePaymentMethod: true,
      paymentMethod: {
        // TODO: SCC-3447: all explicit and implicit data that is required should be added here. The Adyen web-component and drop-in provide this in the incoming request. Is this always the case?
        ...data.paymentMethod,
      },
    };
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
