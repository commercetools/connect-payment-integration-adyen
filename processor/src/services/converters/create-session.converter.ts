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

export class CreateSessionConverter {
  public convertRequest(opts: {
    data: CreateSessionRequestDTO;
    cart: Cart;
    payment: Payment;
  }): CreateCheckoutSessionRequest {
    const allowedPaymentMethods = convertAllowedPaymentMethodsToAdyenFormat();
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
      ...(opts.cart.shippingAddress && {
        deliveryAddress: populateCartAddress(opts.cart.shippingAddress),
      }),
      shopperEmail: opts.cart.customerEmail,
    };
  }
}
