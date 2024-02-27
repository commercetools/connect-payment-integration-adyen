import { PaymentRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRequest';
import { config } from '../../config/config';
import { ThreeDSRequestData } from '@adyen/api-library/lib/src/typings/checkout/threeDSRequestData';
import { Cart, Payment } from '@commercetools/platform-sdk';
import { populateCartAddress, populateLineItems } from './helper.converter';
import { getProcessorUrlFromContext } from '../../libs/fastify/context/context';
import { CreatePaymentRequestDTO } from '../../dtos/adyen-payment.dto';

export class CreatePaymentConverter {
  constructor() {}

  public async convert(opts: { data: CreatePaymentRequestDTO; cart: Cart; payment: Payment }): Promise<PaymentRequest> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { paymentReference: _, ...requestData } = opts.data;
    return {
      ...requestData,
      amount: {
        value: opts.payment.amountPlanned.centAmount,
        currency: opts.payment.amountPlanned.currencyCode,
      },
      reference: opts.payment.id,
      merchantAccount: config.adyenMerchantAccount,
      countryCode: opts.cart.country,
      shopperEmail: opts.cart.customerEmail,
      returnUrl: getProcessorUrlFromContext() + `/payments/details?paymentReference=${opts.payment.id}`,
      ...(opts.cart.billingAddress && {
        billingAddress: populateCartAddress(opts.cart.billingAddress),
      }),
      ...(opts.cart.shippingAddress && {
        deliveryAddress: populateCartAddress(opts.cart.shippingAddress),
      }),
      ...this.populateAddionalPaymentMethodData(opts.data, opts.cart),
    };
  }

  private populateAddionalPaymentMethodData(data: CreatePaymentRequestDTO, cart: Cart) {
    switch (data.paymentMethod.type) {
      case 'scheme':
        return this.populateAdditionalCardData();
      case 'klarna':
      case 'klarna_paynow':
      case 'klarna_account': {
        return {
          lineItems: populateLineItems(cart),
        };
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
}
