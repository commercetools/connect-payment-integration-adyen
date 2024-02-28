import { config } from '../../config/config';
import { PaymentCaptureRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentCaptureRequest';
import { CapturePaymentRequest } from '../types/operation.type';

export class CapturePaymentConverter {
  constructor() {}

  public convertRequest(opts: CapturePaymentRequest): PaymentCaptureRequest {
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
