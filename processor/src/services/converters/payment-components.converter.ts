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
          type: 'applepay',
        },
        {
          type: 'bancontactcard',
        },
        {
          type: 'bancontactmobile',
        },
        {
          type: 'blik',
        },
        {
          type: 'card', // scheme
        },
        {
          type: 'eps',
        },
        {
          type: 'googlepay',
        },
        {
          type: 'ideal',
        },
        {
          type: 'klarna_billie', // klarna_b2b
        },
        {
          type: 'klarna_pay_later', // klarna
        },
        {
          type: 'klarna_pay_now', // klarna_paynow
        },
        {
          type: 'klarna_pay_overtime', // klarna_account
        },
        {
          type: 'mobilepay',
        },
        {
          type: 'paypal',
        },
        {
          type: 'przelewy24', // onlineBanking_PL
        },
        {
          type: 'sepadirectdebit',
        },
        {
          type: 'swish',
        },
        {
          type: 'twint',
        },
        {
          type: 'vipps',
        },
      ],
    };
  }
}
