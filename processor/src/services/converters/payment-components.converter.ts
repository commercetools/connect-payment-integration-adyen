import { SupportedPaymentComponentsSchemaDTO } from '../../dtos/operations/payment-componets.dto';

export class PaymentComponentsConverter {
  public convertResponse(): SupportedPaymentComponentsSchemaDTO {
    return {
      components: [
        {
          type: 'card',
        },
        {
          type: 'ideal',
        },
        {
          type: 'paypal',
        },
      ],
    };
  }
}
