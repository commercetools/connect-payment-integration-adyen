import { config } from '../../config/config';
import { PaymentReversalRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentReversalRequest';
import { ReversePaymentRequest } from '../types/operation.type';

export class ReversePaymentConverter {
  public convertRequest(opts: ReversePaymentRequest): PaymentReversalRequest {
    return {
      merchantAccount: config.adyenMerchantAccount,
      reference: opts.merchantReference || opts.payment.id,
    };
  }
}
