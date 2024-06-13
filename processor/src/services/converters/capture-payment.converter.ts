import { config } from '../../config/config';
import { PaymentCaptureRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentCaptureRequest';
import { CapturePaymentRequest } from '../types/operation.type';
import { LineItem } from '@adyen/api-library/lib/src/typings/checkout/lineItem';

export class CapturePaymentConverter {
  public convertRequest(opts: CapturePaymentRequest, lineItems: LineItem[] | undefined): PaymentCaptureRequest {
    return {
      merchantAccount: config.adyenMerchantAccount,
      reference: opts.payment.id,
      amount: {
        currency: opts.amount.currencyCode,
        value: opts.amount.centAmount,
      },
      lineItems,
    };
  }
}
