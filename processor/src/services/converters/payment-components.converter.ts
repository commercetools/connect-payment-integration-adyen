import { SupportedPaymentComponentsSchemaDTO } from '../../dtos/operations/payment-componets.dto';
import { SUPPORTED_ADYEN_PAYMENT_METHOD_TYPES } from '../../config/payment-method.config';
import { convertPaymentMethodFromAdyenFormat } from './helper.converter';

export class PaymentComponentsConverter {
  public convertResponse(): SupportedPaymentComponentsSchemaDTO {
    return {
      dropins: [
        {
          type: 'embedded',
        },
      ],
      components: SUPPORTED_ADYEN_PAYMENT_METHOD_TYPES.map((type) => ({
        type: convertPaymentMethodFromAdyenFormat(type),
      })),
      express: [
        {
          type: 'applepay',
        },
        {
          type: 'googlepay',
        },
        {
          type: 'paypal',
        },
      ],
    };
  }
}
