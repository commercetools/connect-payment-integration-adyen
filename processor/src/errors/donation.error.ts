import { Errorx, ErrorxAdditionalOpts } from '@commercetools/connect-payments-sdk';

export class DonationNotEnabledError extends Errorx {
  constructor(additionalOpts?: ErrorxAdditionalOpts) {
    super({
      code: 'DonationNotEnabled',
      httpErrorStatus: 400,
      message: 'Adyen Giving is not enabled',
      ...additionalOpts,
    });
  }
}

export class PaymentNotEligibleError extends Errorx {
  constructor(reason: string, additionalOpts?: ErrorxAdditionalOpts) {
    super({
      code: 'PaymentNotEligible',
      httpErrorStatus: 400,
      message: `The payment is not eligible for a donation: ${reason}`,
      ...additionalOpts,
    });
  }
}

export class DonationNotAllowedError extends Errorx {
  constructor(reason: string, additionalOpts?: ErrorxAdditionalOpts) {
    super({
      code: 'DonationNotAllowed',
      httpErrorStatus: 400,
      message: `The donation is not allowed: ${reason}`,
      ...additionalOpts,
    });
  }
}
