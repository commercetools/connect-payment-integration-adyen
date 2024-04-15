import { ConfirmPaymentRequestDTO } from '../../dtos/adyen-payment.dto';
import { PaymentDetailsRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentDetailsRequest';

export class ConfirmPaymentConverter {
  public convertRequest(opts: { data: ConfirmPaymentRequestDTO }): PaymentDetailsRequest {
    return {
      ...opts.data,
    };
  }
}
