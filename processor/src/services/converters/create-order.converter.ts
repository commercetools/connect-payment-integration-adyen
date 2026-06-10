import { CreateOrderRequest } from '@adyen/api-library/lib/src/typings/checkout/createOrderRequest';
import { Cart, CommercetoolsCartService, CurrencyConverters } from '@commercetools/connect-payments-sdk';
import { config } from '../../config/config';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';

export class CreateOrderConverter {
  private ctCartService: CommercetoolsCartService;

  constructor(ctCartService: CommercetoolsCartService) {
    this.ctCartService = ctCartService;
  }

  public async convertRequest(opts: { cart: Cart }): Promise<CreateOrderRequest> {
    const amountPlanned = await this.ctCartService.getPlannedPaymentAmount({ cart: opts.cart });
    return {
      merchantAccount: config.adyenMerchantAccount,
      amount: {
        value: CurrencyConverters.convertWithMapping({
          mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
          amount: amountPlanned.centAmount,
          currencyCode: amountPlanned.currencyCode,
        }),
        currency: amountPlanned.currencyCode,
      },
      reference: opts.cart.id,
    };
  }
}
