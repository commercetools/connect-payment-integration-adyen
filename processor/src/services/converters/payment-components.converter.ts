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
        {
          type: 'applepay',
        },
        {
          type: 'googlepay',
        },
        {
          type: 'klarna_paynow',
        },
        {
          type: 'klarna',
        },
        {
          type: 'klarna_account',
        },
      ],
    };
  }
}
