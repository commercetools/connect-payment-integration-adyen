import { PaymentRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRequest';
import { config } from '../../config/config';
import { ThreeDSRequestData } from '@adyen/api-library/lib/src/typings/checkout/threeDSRequestData';
import { Cart, CurrencyConverters, Payment } from '@commercetools/connect-payments-sdk';
import { buildReturnUrl, getShopperStatement, populateApplicationInfo, populateCartAddress } from './helper.converter';
import { mapCoCoCartItemsToAdyenLineItems } from './lineitem.converter';
import { CreatePaymentRequestDTO } from '../../dtos/adyen-payment.dto';
import { getFutureOrderNumberFromContext } from '../../libs/fastify/context/context';
import { paymentSDK } from '../../payment-sdk';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';
import { AfterpayDetails } from '@adyen/api-library/lib/src/typings/checkout/afterpayDetails';

export class CreatePaymentConverter {
  public convertRequest(opts: { data: CreatePaymentRequestDTO; cart: Cart; payment: Payment }): PaymentRequest {
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
      ...this.populateAddionalPaymentMethodData(opts.data, opts.cart),
      applicationInfo: populateApplicationInfo(),
      ...(shopperStatement && { shopperStatement }),
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
          lineItems: mapCoCoCartItemsToAdyenLineItems(cart),
        };
      }
      case AfterpayDetails.TypeEnum.Afterpaytouch: {
        return this.populateAfterpayData(cart);
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

  private populateAfterpayData(cart: Cart): Partial<PaymentRequest> {
    // TODO: SCC-3189: for web-components type at least on the test environment a form is shown which we need to fill in. It has it's own billing/shipping information. What do with that?
    const { billingAddress } = cart;

    const lineItems = mapCoCoCartItemsToAdyenLineItems(cart);

    return {
      shopperReference: cart.customerId, // TODO: SCC-3189: validate if the cart.customerId is correct or we should send a different value
      // TODO: SCC-3189: the shoppername is mandatory but on cart not, how to deal with that here?
      // TODO: SCC-3189: should we only try and extract from the billingAddress but never the shippingAddress?
      shopperName: {
        firstName: billingAddress?.firstName ?? '',
        lastName: billingAddress?.lastName ?? '',
      },
      telephoneNumber: cart.billingAddress?.phone || cart.shippingAddress?.phone, // TODO: SCC-3189: validate if this is correct
      lineItems,
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
