import { config } from '../../config/config';
import { PaymentRefundRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRefundRequest';
import { RefundPaymentRequest } from '../types/operation.type';
import { MoneyConverters } from '@commercetools/connect-payments-sdk';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';

export class RefundPaymentConverter {
  public convertRequest(opts: RefundPaymentRequest): PaymentRefundRequest {
    return {
      merchantAccount: config.adyenMerchantAccount,
      reference: opts.payment.id,
      amount: {
        currency: opts.amount.currencyCode,
        value: MoneyConverters.convertWithMapping(
          CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
          opts.amount.centAmount,
          opts.amount.currencyCode,
        ),
      },
    };
  }
}
