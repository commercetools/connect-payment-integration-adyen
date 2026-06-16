import { Cart, CommercetoolsCartService, Payment } from '@commercetools/connect-payments-sdk';
import { Transaction } from '@commercetools/platform-sdk';
import { AdyenApi, wrapAdyenError } from '../clients/adyen.client';
import { CancelOrderRequestDTO, CancelOrderResponseDTO, CreateOrderResponseDTO } from '../dtos/adyen-payment.dto';
import { getCartIdFromContext } from '../libs/fastify/context/context';
import { log } from '../libs/logger';
import { CancelOrderConverter } from './converters/cancel-order.converter';
import { CreateOrderConverter } from './converters/create-order.converter';

export type AdyenOrderServiceOptions = {
  ctCartService: CommercetoolsCartService;
};

export class AdyenOrderService {
  private ctCartService: CommercetoolsCartService;
  private createOrderConverter: CreateOrderConverter;
  private cancelOrderConverter: CancelOrderConverter;

  constructor(opts: AdyenOrderServiceOptions) {
    this.ctCartService = opts.ctCartService;
    this.createOrderConverter = new CreateOrderConverter(this.ctCartService);
    this.cancelOrderConverter = new CancelOrderConverter();
  }

  async createOrder(): Promise<CreateOrderResponseDTO> {
    const ctCart = await this.ctCartService.getCart({ id: getCartIdFromContext() });
    const request = await this.createOrderConverter.convertRequest({ cart: ctCart });

    log.info('Creating Adyen order for multi payments', { cartId: ctCart.id });
    try {
      const response = await AdyenApi().OrdersApi.orders(request);
      log.info('Adyen order created for multi payments', { pspReference: response.pspReference });
      return response;
    } catch (e) {
      throw wrapAdyenError(e);
    }
  }

  async cancelOrder(opts: { data: CancelOrderRequestDTO }): Promise<CancelOrderResponseDTO> {
    const request = this.cancelOrderConverter.convertRequest({ data: opts.data });

    log.info('Cancelling Adyen order.', { pspReference: opts.data.pspReference });
    try {
      const response = await AdyenApi().OrdersApi.cancelOrder(request);
      log.info('Adyen order cancelled.', { pspReference: response.pspReference });
      return response;
    } catch (e) {
      throw wrapAdyenError(e);
    }
  }

  /**
   * Cancels any active Adyen orders found on the cart's payments.
   * A payment has an active order when it is approved (authorized/captured and not reverted)
   * and carries adyenOrderData + adyenOrderPspReference custom fields.
   * Called before creating a new session so the previous order does not conflict.
   * Failures are logged but do not abort session creation.
   */
  async cancelCartActiveOrders(cart: Cart): Promise<void> {
    if (!cart.paymentInfo || cart.paymentInfo.payments.length === 0) {
      return;
    }

    const activeOrders = this.getActiveOrders(cart);

    const cancellations = [...activeOrders.entries()].map(async ([pspReference, { orderData, paymentId }]) => {
      try {
        await this.cancelOrder({ data: { orderData, pspReference } });
      } catch (e) {
        log.error('Failed to cancel Adyen order before session creation — continuing anyway', {
          paymentId,
          pspReference,
          error: e,
        });
      }
    });

    await Promise.all(cancellations);
  }

  /**
   * Returns a map of distinct active Adyen orders found on the cart's payments, keyed by
   * adyenOrderPspReference. A payment has an active order when it is approved (authorized or
   * captured, not reverted) and carries both adyenOrderData and adyenOrderPspReference custom
   * fields. Payments sharing the same pspReference are deduplicated automatically by the Map.
   */
  private getActiveOrders(cart: Cart): Map<string, { orderData: string; paymentId: string }> {
    const activeOrders = new Map<string, { orderData: string; paymentId: string }>();
    for (const ref of cart.paymentInfo!.payments) {
      const payment = ref.obj;
      if (
        payment !== undefined &&
        isPaymentApproved(payment) &&
        payment.custom?.fields?.['adyenOrderData'] !== undefined &&
        payment.custom?.fields?.['adyenOrderPspReference'] !== undefined
      ) {
        const pspReference = payment.custom.fields['adyenOrderPspReference'] as string;
        activeOrders.set(pspReference, {
          orderData: payment.custom.fields['adyenOrderData'] as string,
          paymentId: payment.id,
        });
      }
    }
    return activeOrders;
  }
}

function isPaymentApproved(payment: Payment): boolean {
  const wasReverted = payment.transactions.some(
    (tx: Transaction) =>
      (tx.type === 'CancelAuthorization' || tx.type === 'Refund') && (tx.state === 'Success' || tx.state === 'Pending'),
  );
  if (wasReverted) return false;

  return payment.transactions.some(
    (tx: Transaction) =>
      (tx.state === 'Success' || tx.state === 'Pending') && (tx.type === 'Authorization' || tx.type === 'Charge'),
  );
}
