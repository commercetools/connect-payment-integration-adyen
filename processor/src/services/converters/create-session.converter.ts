import { CreateCheckoutSessionRequest } from '@adyen/api-library/lib/src/typings/checkout/createCheckoutSessionRequest';
import { config } from '../../config/config';
import {
  buildReturnUrl,
  convertAllowedPaymentMethodsToAdyenFormat,
  populateCartAddress,
  mapCoCoCartItemsToAdyenLineItems,
  populateApplicationInfo,
  getShopperStatement,
} from './helper.converter';
import { CreateSessionRequestDTO } from '../../dtos/adyen-payment.dto';
import { Cart, CurrencyConverters, Payment } from '@commercetools/connect-payments-sdk';
import { getFutureOrderNumberFromContext } from '../../libs/fastify/context/context';
import { paymentSDK } from '../../payment-sdk';
import { CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING, CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';
import { CreateCheckoutSessionResponse } from '@adyen/api-library/lib/src/typings/checkout/createCheckoutSessionResponse';

export class CreateSessionConverter {
  public convertRequest(opts: {
    data: CreateSessionRequestDTO;
    cart: Cart;
    payment: Payment;
  }): CreateCheckoutSessionRequest {
    const allowedPaymentMethods = convertAllowedPaymentMethodsToAdyenFormat();
    const futureOrderNumber = getFutureOrderNumberFromContext();
    const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart: opts.cart });
    const shopperStatement = getShopperStatement();
    return {
      ...opts.data,
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
      returnUrl: buildReturnUrl(opts.payment.id),
      channel: opts.data.channel ? opts.data.channel : CreateCheckoutSessionRequest.ChannelEnum.Web,
      ...(allowedPaymentMethods.length > 0 && { allowedPaymentMethods }),
      lineItems: mapCoCoCartItemsToAdyenLineItems(opts.cart),
      ...(opts.cart.billingAddress && {
        billingAddress: populateCartAddress(opts.cart.billingAddress),
      }),
      ...(deliveryAddress && {
        deliveryAddress: populateCartAddress(deliveryAddress),
      }),
      shopperEmail: opts.cart.customerEmail,
      ...(futureOrderNumber && { merchantOrderReference: futureOrderNumber }),
      applicationInfo: populateApplicationInfo(),
      ...(shopperStatement && { shopperStatement }),
    };
  }

  public convertResponse(opts: { response: CreateCheckoutSessionResponse }): CreateCheckoutSessionResponse {
    return {
      ...opts.response,
      amount: {
        value: CurrencyConverters.convertWithMapping({
          mapping: CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING,
          amount: opts.response.amount.value,
          currencyCode: opts.response.amount.currency,
        }),
        currency: opts.response.amount.currency,
      },
    };
  }
}
