import { config } from '../../config/config';
import { PaymentRefundRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRefundRequest';
import { RefundPaymentRequest } from '../types/operation.type';

export class RefundPaymentConverter {
  public convertRequest(opts: RefundPaymentRequest): PaymentRefundRequest {
    return {
      merchantAccount: config.adyenMerchantAccount,
      reference: opts.payment.id,
      amount: {
        currency: opts.amount.currencyCode,
        value: opts.amount.centAmount,
      },
    };
  }
}
