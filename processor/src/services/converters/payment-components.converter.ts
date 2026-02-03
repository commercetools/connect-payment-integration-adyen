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
          type: 'afterpay', // afterpaytouch
        },
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
          type: 'fpx', // FPX Online banking Malaysia
        },
        {
          type: 'googlepay',
        },
        {
          type: 'ideal',
        },
        {
          type: 'ideal_wero',
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
        {
          type: 'clearpay',
        },
        {
          type: 'mbway',
        },
        {
          type: 'trustly',
        },
      ],
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
