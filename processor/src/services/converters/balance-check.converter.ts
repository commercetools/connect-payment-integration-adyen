import { BalanceCheckRequest } from '@adyen/api-library/lib/src/typings/checkout/balanceCheckRequest';
import { CurrencyConverters } from '@commercetools/connect-payments-sdk';
import { config } from '../../config/config';
import { GiftCardBalanceRequestDTO } from '../../dtos/adyen-payment.dto';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';

type AmountPlanned = { centAmount: number; currencyCode: string };

export class BalanceCheckConverter {
  public convertRequest(opts: { data: GiftCardBalanceRequestDTO; amountPlanned: AmountPlanned }): BalanceCheckRequest {
    return {
      merchantAccount: config.adyenMerchantAccount,
      amount: {
        value: CurrencyConverters.convertWithMapping({
          mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
          amount: opts.amountPlanned.centAmount,
          currencyCode: opts.amountPlanned.currencyCode,
        }),
        currency: opts.amountPlanned.currencyCode,
      },
      paymentMethod: opts.data.paymentMethod,
    };
  }
}
