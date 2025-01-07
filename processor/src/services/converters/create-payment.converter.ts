import { PaymentRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRequest';
import { config } from '../../config/config';
import { ThreeDSRequestData } from '@adyen/api-library/lib/src/typings/checkout/threeDSRequestData';
import { Cart, Payment } from '@commercetools/connect-payments-sdk';
import { buildReturnUrl, mapCoCoCartItemsToAdyenLineItems, populateCartAddress } from './helper.converter';
import { CreatePaymentRequestDTO } from '../../dtos/adyen-payment.dto';
import { getFutureOrderNumberFromContext } from '../../libs/fastify/context/context';
import { paymentSDK } from '../../payment-sdk';

export class CreatePaymentConverter {
  public convertRequest(opts: { data: CreatePaymentRequestDTO; cart: Cart; payment: Payment }): PaymentRequest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { paymentReference: _, ...requestData } = opts.data;
    const futureOrderNumber = getFutureOrderNumberFromContext();
    const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart: opts.cart });
    return {
      ...requestData,
      amount: {
        value: opts.payment.amountPlanned.centAmount,
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
    };
  }

  private populateAddionalPaymentMethodData(data: CreatePaymentRequestDTO, cart: Cart) {
    switch (data?.paymentMethod?.type) {
      case 'scheme':
        return this.populateAdditionalCardData();
      case 'klarna':
      case 'klarna_paynow':
      case 'klarna_account': {
        return {
          lineItems: mapCoCoCartItemsToAdyenLineItems(cart),
        };
      }
      case 'klarna_b2b': {
        return this.populateKlarnaB2BData(cart);
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

  private populateKlarnaB2BData(cart: Cart): Partial<PaymentRequest> {
    const { billingAddress } = cart;
    const { firstName, lastName, email, company } = billingAddress || {};

    const hasValidBillingAddress = (): boolean => {
      return !!(company && firstName && lastName && email);
    };

    const lineItems = mapCoCoCartItemsToAdyenLineItems(cart);

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
