import { SupportedPaymentComponentsSchemaDTO } from '../../dtos/operations/payment-componets.dto';

export class PaymentComponentsConverter {
  public convertResponse(): SupportedPaymentComponentsSchemaDTO {
    return {
      dropins: [
        {
          type: 'embedded',
        },
      ],
      components: [
        {
          type: 'card', // scheme
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
          type: 'klarna_pay_now', // klarna_paynow
        },
        {
          type: 'klarna_pay_later', // klarna
        },
        {
          type: 'klarna_pay_overtime', // klarna_account
        },
        {
          type: 'eps',
        },
        {
          type: 'bancontactcard',
        },
        {
          type: 'bancontactmobile',
        },
        {
          type: 'twint',
        },
        {
          type: 'sepadirectdebit',
        },
        {
          type: 'klarna_billie', // klarna_b2b
        },
      ],
    };
  }
}
