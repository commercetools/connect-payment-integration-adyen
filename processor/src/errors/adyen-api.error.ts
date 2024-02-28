import { Errorx, ErrorxAdditionalOpts } from '@commercetools/connect-payments-sdk';

export type AdyenApiErrorData = {
  status: number;
  errorCode: string;
  message: string;
  errorType?: string;
};

export class AdyenApiError extends Errorx {
  constructor(errorData: AdyenApiErrorData, additionalOpts?: ErrorxAdditionalOpts) {
    super({
      code: `AdyenError-${errorData.errorCode}`,
      httpErrorStatus: errorData.status,
      message: errorData.message,
      ...additionalOpts,
    });
  }
}
