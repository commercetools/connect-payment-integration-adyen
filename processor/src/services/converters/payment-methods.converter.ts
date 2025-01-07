import { config } from '../../config/config';
import { PaymentMethodsRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentMethodsRequest';
import { CommercetoolsCartService, CurrencyConverters } from '@commercetools/connect-payments-sdk';
import { convertPaymentMethodFromAdyenFormat } from './helper.converter';
import { getAllowedPaymentMethodsFromContext, getCartIdFromContext } from '../../libs/fastify/context/context';
import { PaymentMethodsRequestDTO, PaymentMethodsResponseDTO } from '../../dtos/adyen-payment.dto';
import { PaymentMethodsResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentMethodsResponse';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';

export class PaymentMethodsConverter {
  private ctCartService: CommercetoolsCartService;

  constructor(ctCartService: CommercetoolsCartService) {
    this.ctCartService = ctCartService;
  }

  public async convertRequest(opts: { data: PaymentMethodsRequestDTO }): Promise<PaymentMethodsRequest> {
    const cart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });
    const paymentAmount = await this.ctCartService.getPaymentAmount({
      cart,
    });

    return {
      ...opts.data,
      amount: {
        value: CurrencyConverters.convertWithMapping({
          mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
          amount: paymentAmount.centAmount,
          currencyCode: paymentAmount.currencyCode,
        }),
        currency: paymentAmount.currencyCode,
      },
      countryCode: cart.country,
      merchantAccount: config.adyenMerchantAccount,
    };
  }

  public convertResponse(opts: { data: PaymentMethodsResponse }): PaymentMethodsResponseDTO {
    const newData = { ...opts.data };
    const allowedPaymentMethods = getAllowedPaymentMethodsFromContext();

    if (allowedPaymentMethods.length > 0) {
      if (newData.paymentMethods && newData.paymentMethods.length > 0) {
        newData.paymentMethods = newData.paymentMethods.filter((pm) => {
          return pm.type && allowedPaymentMethods.includes(convertPaymentMethodFromAdyenFormat(pm.type));
        });
      }

      if (newData.storedPaymentMethods && newData.storedPaymentMethods.length > 0) {
        newData.storedPaymentMethods = newData.storedPaymentMethods.filter((pm) => {
          return pm.type && allowedPaymentMethods.includes(convertPaymentMethodFromAdyenFormat(pm.type));
        });
      }
    }

    return newData;
  }
}
