import { CreateCheckoutSessionRequest } from '@adyen/api-library/lib/src/typings/checkout/createCheckoutSessionRequest';
import { config } from '../../config/config';
import {
  buildReturnUrl,
  convertAllowedPaymentMethodsToAdyenFormat,
  populateCartAddress,
  mapCoCoCartItemsToAdyenLineItems,
} from './helper.converter';
import { CreateSessionRequestDTO } from '../../dtos/adyen-payment.dto';
import { Cart, Payment } from '@commercetools/connect-payments-sdk';
import { getFutureOrderNumberFromContext } from '../../libs/fastify/context/context';
import { paymentSDK } from '../../payment-sdk';

export class CreateSessionConverter {
  public convertRequest(opts: {
    data: CreateSessionRequestDTO;
    cart: Cart;
    payment: Payment;
  }): CreateCheckoutSessionRequest {
    const allowedPaymentMethods = convertAllowedPaymentMethodsToAdyenFormat();
    const futureOrderNumber = getFutureOrderNumberFromContext();
    const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart: opts.cart });
    return {
      ...opts.data,
      amount: {
        value: opts.payment.amountPlanned.centAmount,
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
    };
  }
}
