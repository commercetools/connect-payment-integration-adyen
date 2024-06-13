import { config } from '../../config/config';
import { PaymentCaptureRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentCaptureRequest';
import { CapturePaymentRequest } from '../types/operation.type';
import { LineItem } from '@adyen/api-library/lib/src/typings/checkout/lineItem';
import { mapCoCoCartItemsToAdyenLineItems, mapCoCoOrderItemsToAdyenLineItems } from './helper.converter';
import { log } from '../../libs/logger';
import {
  CommercetoolsCartService,
  CommercetoolsOrderService,
  ErrorReferencedResourceNotFound,
} from '@commercetools/connect-payments-sdk';

/**
 * These payment methods require line items to be send to Adyen for capturing payments
 */
export const METHODS_REQUIRE_LINE_ITEMS = ['klarna', 'klarna_account', 'klarna_paynow'];

export class CapturePaymentConverter {
  private ctCartService: CommercetoolsCartService;
  private ctOrderService: CommercetoolsOrderService;

  constructor(ctCartService: CommercetoolsCartService, ctOrderService: CommercetoolsOrderService) {
    this.ctCartService = ctCartService;
    this.ctOrderService = ctOrderService;
  }

  public async convertRequest(opts: CapturePaymentRequest): Promise<PaymentCaptureRequest> {
    // Only process if the payment method requires it so we don't fetch order/cart unnecessary.
    let adyenLineItems: LineItem[] | undefined = undefined;
    if (
      opts.payment.paymentMethodInfo.method &&
      METHODS_REQUIRE_LINE_ITEMS.includes(opts.payment.paymentMethodInfo.method)
    ) {
      adyenLineItems = await this.retrievePaymentAssociatedLineItems(opts.payment.id);
    }

    return {
      merchantAccount: config.adyenMerchantAccount,
      reference: opts.payment.id,
      amount: {
        currency: opts.amount.currencyCode,
        value: opts.amount.centAmount,
      },
      lineItems: adyenLineItems,
    };
  }

  private async retrievePaymentAssociatedLineItems(paymentId: string): Promise<LineItem[]> {
    // First try fetching the order
    try {
      const order = await this.ctOrderService.getOrderByPaymentId({ paymentId });
      return mapCoCoOrderItemsToAdyenLineItems(order);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not find order for the given paymentId';
      log.warn(msg, {
        cause: error,
        paymentId,
      });
    }

    // Fallback to the cart
    try {
      const cart = await this.ctCartService.getCartByPaymentId({ paymentId });
      return mapCoCoCartItemsToAdyenLineItems(cart);
    } catch (error) {
      throw new ErrorReferencedResourceNotFound('cart', paymentId, {
        cause: error,
        fields: {
          paymentId,
        },
      });
    }
  }
}
