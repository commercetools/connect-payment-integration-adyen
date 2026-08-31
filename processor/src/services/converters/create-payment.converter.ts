import { PaymentRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRequest';
import { ThreeDSRequestData } from '@adyen/api-library/lib/src/typings/checkout/threeDSRequestData';

import { config, getConfig } from '../../config/config';
import {
  Cart,
  CurrencyConverters,
  Payment,
  CommercetoolsPaymentMethodService,
  ErrorInternalConstraintViolated,
  PaymentMethod,
  CommercetoolsCartService,
} from '@commercetools/connect-payments-sdk';
import {
  buildReturnUrl,
  getShopperStatement,
  populateApplicationInfo,
  populateCartAddress,
  mapCoCoCartItemsToAdyenLineItems,
  getCountryCodeFromCart,
  extractShopperName,
  extractStoredPaymentMethodId,
} from './helper.converter';
import { CreatePaymentRequestDTO } from '../../dtos/adyen-payment.dto';
import { getFutureOrderNumberFromContext } from '../../libs/fastify/context/context';
import { paymentSDK } from '../../payment-sdk';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';
import { randomUUID } from 'node:crypto';
import {
  getStoredPaymentMethodsConfig,
  isTokenizationEnabled,
  SupportedStoredPaymentMethodsTypes,
} from '../../config/stored-payment-methods.config';
import { PaymentAmount } from '@commercetools/connect-payments-sdk/dist/commercetools/types/payment.type';
import { AdyenApi } from '../../clients/adyen.client';

type ExpressPayment = {
  amountPlanned: PaymentAmount;
  id: string;
};
export class CreatePaymentConverter {
  private ctPaymentMethodService: CommercetoolsPaymentMethodService;
  private ctCartService: CommercetoolsCartService;

  constructor(ctPaymentMethodService: CommercetoolsPaymentMethodService, ctCartService: CommercetoolsCartService) {
    this.ctPaymentMethodService = ctPaymentMethodService;
    this.ctCartService = ctCartService;
  }

  public async convertRequest(opts: {
    data: CreatePaymentRequestDTO;
    cart: Cart;
    payment: Payment;
  }): Promise<PaymentRequest> {
    const requestData = opts.data;
    const futureOrderNumber = getFutureOrderNumberFromContext();
    const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart: opts.cart });
    const shopperStatement = getShopperStatement();
    const shopperName = extractShopperName(opts.cart);
    const storedPaymentMethodsData = await this.populateStoredPaymentMethodsData(opts.data, opts.cart);
    const lineItems = mapCoCoCartItemsToAdyenLineItems(opts.cart, opts.data.paymentMethod?.type);
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
      countryCode: getCountryCodeFromCart(opts.cart),
      shopperEmail: opts.cart.customerEmail,
      returnUrl: buildReturnUrl(opts.payment.id),
      ...(opts.cart.billingAddress && {
        billingAddress: populateCartAddress(opts.cart.billingAddress),
      }),
      ...(deliveryAddress && {
        deliveryAddress: populateCartAddress(deliveryAddress),
      }),
      ...(futureOrderNumber && { merchantOrderReference: futureOrderNumber }),
      ...(lineItems.length > 0 && { lineItems }),
      ...this.populateAdditionalPaymentMethodData(opts.data, opts.cart),
      applicationInfo: populateApplicationInfo(),
      ...(shopperStatement && { shopperStatement }),
      ...storedPaymentMethodsData,
      ...(shopperName && { shopperName }),
    };
  }

  /**
   * Creates a payment request payload to the Adyen payments API. Intended to be used in the `/operations/transactions` API for "server-to-server" types of payments.
   *
   * It can be extended in the future for "UnscheduledCardOnFile" type of payments.
   */
  public async convertPaymentRequestForRecurringTokenPayments(opts: {
    cart: Cart;
    payment: Payment;
    paymentMethod: PaymentMethod;
    futureOrderNumber?: string;
  }): Promise<PaymentRequest> {
    const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart: opts.cart });
    const shopperStatement = getShopperStatement();
    const lineItems = mapCoCoCartItemsToAdyenLineItems(opts.cart);

    const customersTokenDetailsFromAdyen = await AdyenApi().RecurringApi.getTokensForStoredPaymentDetails(
      opts.cart.customerId,
      getConfig().adyenMerchantAccount,
    );

    const tokenDetailsFromAdyen = customersTokenDetailsFromAdyen.storedPaymentMethods?.find(
      (tokenDetails) => tokenDetails.id === opts.paymentMethod.token?.value,
    );

    return {
      // START: paying with stored payment method specific values
      // When paying a recurring cart it will always be Subscription cause they are "server-to-server" payments. One-Off payments are always user initiated and follow the "normal" payment flow.
      recurringProcessingModel: PaymentRequest.RecurringProcessingModelEnum.Subscription,
      shopperInteraction: PaymentRequest.ShopperInteractionEnum.ContAuth, // when paying with an existing token/stored-payment-method then the shopperInteraction is always ContAuth
      shopperReference: opts.cart.customerId,
      paymentMethod: {
        storedPaymentMethodId: opts.paymentMethod.token?.value,
        brand: tokenDetailsFromAdyen?.brand,
      },
      // END: paying with stored payment method specific values
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
      countryCode: getCountryCodeFromCart(opts.cart),
      shopperEmail: opts.cart.customerEmail,
      returnUrl: '', // TS and adyen payment API has this property as mandatory. However when paying via server to server (aka Subscription) this has no effect.
      ...(opts.cart.billingAddress && {
        billingAddress: populateCartAddress(opts.cart.billingAddress),
      }),
      ...(deliveryAddress && {
        deliveryAddress: populateCartAddress(deliveryAddress),
      }),
      ...(opts.futureOrderNumber && { merchantOrderReference: opts.futureOrderNumber }),
      ...(lineItems.length > 0 && { lineItems }),
      applicationInfo: populateApplicationInfo(),
      ...(shopperStatement && { shopperStatement }),
    };
  }

  public async convertExpressRequest(opts: {
    data: CreatePaymentRequestDTO;
    cart: Cart;
    payment: ExpressPayment;
  }): Promise<PaymentRequest> {
    const requestData = opts.data;
    const futureOrderNumber = getFutureOrderNumberFromContext();
    const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart: opts.cart });
    const shopperStatement = getShopperStatement();
    const shopperName = extractShopperName(opts.cart);
    const lineItems = mapCoCoCartItemsToAdyenLineItems(opts.cart, opts.data.paymentMethod?.type);

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
      countryCode: getCountryCodeFromCart(opts.cart),
      shopperEmail: opts.cart.customerEmail,
      returnUrl: buildReturnUrl(opts.payment.id),
      ...(opts.cart.billingAddress && {
        billingAddress: populateCartAddress(opts.cart.billingAddress),
      }),
      ...(deliveryAddress && {
        deliveryAddress: populateCartAddress(deliveryAddress),
      }),
      ...(futureOrderNumber && { merchantOrderReference: futureOrderNumber }),
      ...(lineItems.length > 0 && { lineItems }),
      ...this.populateAdditionalPaymentMethodData(opts.data, opts.cart),
      applicationInfo: populateApplicationInfo(),
      ...(shopperStatement && { shopperStatement }),
      ...(shopperName && { shopperName }),
    };
  }

  public async populateStoredPaymentMethodsData(
    data: Pick<CreatePaymentRequestDTO, 'paymentMethod' | 'storePaymentMethod'>,
    cart: Cart,
  ) {
    if (!isTokenizationEnabled()) {
      return;
    }

    const paymentMethodType = data.paymentMethod.type;
    const paymentMethodConfig =
      typeof paymentMethodType === 'string'
        ? getStoredPaymentMethodsConfig().config.supportedPaymentMethodTypes[paymentMethodType]
        : undefined;
    if (!paymentMethodConfig) {
      return;
    }

    const storedPaymentMethodId = extractStoredPaymentMethodId(data.paymentMethod);
    const isRecurringOrder = this.ctCartService.isRecurringCart(cart);

    if (storedPaymentMethodId) {
      return isRecurringOrder
        ? this.payWithExistingTokenForRecurringOrder({ data, cart, paymentMethodConfig, storedPaymentMethodId })
        : this.payWithExistingTokenForOneOff({ data, cart, storedPaymentMethodId });
    }

    return isRecurringOrder
      ? this.tokeniseForRecurringOrder({ data, cart, paymentMethodConfig })
      : this.tokeniseForOneOff({ data, cart, paymentMethodConfig });
  }

  /**
   * Fresh payment, client explicitly asked to store it, on a regular (non-recurring) cart.
   */
  private async tokeniseForOneOff(opts: {
    data: Pick<CreatePaymentRequestDTO, 'paymentMethod' | 'storePaymentMethod'>;
    cart: Cart;
    paymentMethodConfig: SupportedStoredPaymentMethodsTypes[string];
  }) {
    const { data, cart, paymentMethodConfig } = opts;

    const shouldStore =
      getStoredPaymentMethodsConfig().enabled &&
      !!data.storePaymentMethod &&
      paymentMethodConfig.oneOffPayments &&
      this.isTokenizationAllowedForCartCountry(paymentMethodConfig, cart);

    if (!shouldStore) {
      return;
    }

    const customerReference = this.requireCustomerId(cart);

    return {
      recurringProcessingModel: PaymentRequest.RecurringProcessingModelEnum.CardOnFile,
      shopperInteraction: PaymentRequest.ShopperInteractionEnum.Ecommerce,
      shopperReference: customerReference,
      storePaymentMethod: true,
      paymentMethod: data.paymentMethod,
    };
  }

  /**
   * Fresh payment on a recurring cart. Storage is forced regardless of what the client requested,
   * since future occurrences need a token to charge automatically.
   */
  private async tokeniseForRecurringOrder(opts: {
    data: Pick<CreatePaymentRequestDTO, 'paymentMethod' | 'storePaymentMethod'>;
    cart: Cart;
    paymentMethodConfig: SupportedStoredPaymentMethodsTypes[string];
  }) {
    const { data, cart, paymentMethodConfig } = opts;

    const shouldStore =
      getConfig().adyenRecurringPaymentsEnabled &&
      paymentMethodConfig.recurringPayments &&
      this.isTokenizationAllowedForCartCountry(paymentMethodConfig, cart);

    if (!shouldStore) {
      return;
    }

    const customerReference = this.requireCustomerId(cart);

    return {
      recurringProcessingModel: PaymentRequest.RecurringProcessingModelEnum.Subscription,
      shopperInteraction: PaymentRequest.ShopperInteractionEnum.Ecommerce,
      shopperReference: customerReference,
      storePaymentMethod: true,
      paymentMethod: data.paymentMethod,
    };
  }

  /**
   * Paying with an already-stored token on a regular (non-recurring) cart.
   */
  private async payWithExistingTokenForOneOff(opts: {
    data: Pick<CreatePaymentRequestDTO, 'paymentMethod' | 'storePaymentMethod'>;
    cart: Cart;
    storedPaymentMethodId: string;
  }) {
    const { data, cart, storedPaymentMethodId } = opts;

    if (!getStoredPaymentMethodsConfig().enabled) {
      throw new ErrorInternalConstraintViolated(
        'Stored payment methods are not enabled, so an existing token cannot be used to pay.',
        {
          privateFields: {
            cart: { id: cart.id, typeId: 'cart' },
          },
        },
      );
    }

    const customerReference = this.requireCustomerId(cart);
    await this.assertTokenBelongsToCustomer(storedPaymentMethodId, customerReference, cart);

    return {
      recurringProcessingModel: PaymentRequest.RecurringProcessingModelEnum.CardOnFile,
      shopperInteraction: PaymentRequest.ShopperInteractionEnum.ContAuth,
      shopperReference: customerReference,
      paymentMethod: data.paymentMethod,
    };
  }

  /**
   * Paying with an already-stored token on a recurring cart.
   */
  private async payWithExistingTokenForRecurringOrder(opts: {
    data: Pick<CreatePaymentRequestDTO, 'paymentMethod' | 'storePaymentMethod'>;
    cart: Cart;
    paymentMethodConfig: SupportedStoredPaymentMethodsTypes[string];
    storedPaymentMethodId: string;
  }) {
    const { data, cart, paymentMethodConfig, storedPaymentMethodId } = opts;

    if (!getConfig().adyenRecurringPaymentsEnabled || !paymentMethodConfig.recurringPayments) {
      throw new ErrorInternalConstraintViolated(
        'The payment method type of the provided token does not support recurring payments, yet the cart is a recurring cart.',
        {
          privateFields: {
            cart: { id: cart.id, typeId: 'cart' },
            paymentMethodType: data.paymentMethod.type,
          },
        },
      );
    }

    const customerReference = this.requireCustomerId(cart);
    await this.assertTokenBelongsToCustomer(storedPaymentMethodId, customerReference, cart);

    return {
      recurringProcessingModel: PaymentRequest.RecurringProcessingModelEnum.Subscription,
      shopperInteraction: PaymentRequest.ShopperInteractionEnum.ContAuth,
      shopperReference: customerReference,
      paymentMethod: data.paymentMethod,
    };
  }

  private requireCustomerId(cart: Cart): string {
    if (!cart.customerId) {
      throw new ErrorInternalConstraintViolated('The cart does not have a customerId set.', {
        privateFields: {
          cart: { id: cart.id, typeId: 'cart' },
        },
      });
    }
    return cart.customerId;
  }

  private async assertTokenBelongsToCustomer(tokenValue: string, customerId: string, cart: Cart): Promise<void> {
    const doesTokenBelongsToCustomer = await this.ctPaymentMethodService.doesTokenBelongsToCustomer({
      customerId,
      paymentInterface: getStoredPaymentMethodsConfig().config.paymentInterface,
      interfaceAccount: getStoredPaymentMethodsConfig().config.interfaceAccount,
      tokenValue,
    });

    if (!doesTokenBelongsToCustomer) {
      throw new ErrorInternalConstraintViolated(
        'The provided token does not belong to the given customer for any payment method currently stored.',
        {
          privateFields: {
            cart: { id: cart.id, typeId: 'cart' },
            customerId,
            paymentInterface: getStoredPaymentMethodsConfig().config.paymentInterface,
            interfaceAccount: getStoredPaymentMethodsConfig().config.interfaceAccount,
          },
        },
      );
    }
  }

  private isTokenizationAllowedForCartCountry(
    paymentMethodConfig: SupportedStoredPaymentMethodsTypes[string],
    cart: Cart,
  ): boolean {
    if (!paymentMethodConfig.tokenizationAllowedCountries) {
      return true;
    }

    const countryCode = getCountryCodeFromCart(cart);
    return !!countryCode && paymentMethodConfig.tokenizationAllowedCountries.includes(countryCode);
  }

  private populateAdditionalPaymentMethodData(data: CreatePaymentRequestDTO, cart: Cart) {
    switch (data?.paymentMethod?.type) {
      case 'scheme':
        return this.populateAdditionalCardData();
      // clearpay is the same as afterpaytouch
      case 'clearpay':
      case 'afterpaytouch': {
        return this.populateAfterpayData(cart, data.paymentMethod.type);
      }
      case 'klarna_b2b': {
        return this.populateKlarnaB2BData(cart, data.paymentMethod.type);
      }
      case 'econtext': {
        return this.populateJCSData({
          ...data,
          shopperEmail: data.shopperEmail ?? cart.customerEmail,
          telephoneNumber:
            data.telephoneNumber ?? cart.billingAddress?.phone ?? cart.shippingAddress?.phone ?? undefined,
        });
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
      telephoneNumber: (billingAddress?.phone || shippingAddress?.phone) ?? undefined,
      lineItems,
    };
  }

  private populateKlarnaB2BData(cart: Cart, paymentMethodType: string): Partial<PaymentRequest> {
    const { billingAddress } = cart;
    const { company } = billingAddress || {};

    const lineItems = mapCoCoCartItemsToAdyenLineItems(cart, paymentMethodType);
    return {
      company: {
        name: company ?? '',
      },
      lineItems,
    };
  }

  private populateJCSData(data: CreatePaymentRequestDTO): Partial<PaymentRequest> {
    // econtext_stores requires shopper details inside the paymentMethod object,
    // not at the top level (where the Adyen Web component puts them as shopperName etc.)
    const { shopperName, shopperEmail, telephoneNumber } = data;
    return {
      paymentMethod: {
        ...(data.paymentMethod as object),
        firstName: shopperName?.firstName,
        lastName: shopperName?.lastName,
        shopperEmail: shopperEmail,
        telephoneNumber: telephoneNumber,
        type: 'econtext_stores',
      } as typeof data.paymentMethod,
    };
  }
}
