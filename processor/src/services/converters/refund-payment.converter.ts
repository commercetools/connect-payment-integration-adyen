import { config } from '../../config/config';
import { PaymentRefundRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRefundRequest';
import { RefundPaymentRequest } from '../types/operation.type';
import { CurrencyConverters } from '@commercetools/connect-payments-sdk';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';

export class RefundPaymentConverter {
  public convertRequest(opts: RefundPaymentRequest): PaymentRefundRequest {
    return {
      merchantAccount: config.adyenMerchantAccount,
      reference: opts.merchantReference || opts.payment.id,
      amount: {
        currency: opts.amount.currencyCode,
        value: CurrencyConverters.convertWithMapping({
          mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
          amount: opts.amount.centAmount,
          currencyCode: opts.amount.currencyCode,
        }),
      },
    };
  }
}
