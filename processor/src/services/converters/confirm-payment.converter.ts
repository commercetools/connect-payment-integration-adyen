import { ConfirmPaymentRequestDTO } from '../../dtos/adyen-payment.dto';
import { PaymentDetailsRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentDetailsRequest';

export class ConfirmPaymentConverter {
  constructor() {}

  public async convert(opts: { data: ConfirmPaymentRequestDTO }): Promise<PaymentDetailsRequest> {
    return {
      ...opts.data,
    };
  }
}
