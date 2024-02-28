import { config } from '../../config/config';
import { PaymentCancelRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentCancelRequest';
import { CancelPaymentRequest } from '../types/operation.type';

export class CancelPaymentConverter {
  constructor() {}

  public convertRequest(opts: CancelPaymentRequest): PaymentCancelRequest {
    return {
      merchantAccount: config.adyenMerchantAccount,
      reference: opts.payment.id,
    };
  }
}
