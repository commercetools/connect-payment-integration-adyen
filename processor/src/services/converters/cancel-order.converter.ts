import { CancelOrderRequest } from '@adyen/api-library/lib/src/typings/checkout/cancelOrderRequest';
import { config } from '../../config/config';
import { CancelOrderRequestDTO } from '../../dtos/adyen-payment.dto';

export class CancelOrderConverter {
  public convertRequest(opts: { data: CancelOrderRequestDTO }): CancelOrderRequest {
    return {
      merchantAccount: config.adyenMerchantAccount,
      order: {
        orderData: opts.data.orderData,
        pspReference: opts.data.pspReference,
      },
    };
  }
}
