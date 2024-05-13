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

export type UnsupportedNotificationErrorData = {
  notificationEvent: string;
};

export class UnsupportedNotificationError extends Errorx {
  constructor(errorData: UnsupportedNotificationErrorData, additionalOpts?: ErrorxAdditionalOpts) {
    super({
      code: 'UnsupportedNotification',
      httpErrorStatus: 400,
      message: `Unsupported notification event: ${errorData.notificationEvent}`,
      skipLog: true,
      ...additionalOpts,
    });
  }
}

export class ApplePayPaymentSessionError extends Errorx {
  constructor(errorData: { status: number; message: string }, additionalOpts?: ErrorxAdditionalOpts) {
    super({
      code: `ApplePayPaymentSessionError`,
      httpErrorStatus: errorData.status,
      message: errorData.message,
      ...additionalOpts,
    });
  }
}
