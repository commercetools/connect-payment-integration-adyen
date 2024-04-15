import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { NotificationRequestDTO } from '../../dtos/adyen-payment.dto';
import { TransactionData, UpdatePayment, Money } from '@commercetools/connect-payments-sdk';
import { UnsupportedNotificationError } from '../../errors/adyen-api.error';

export class NotificationConverter {
  public convert(opts: { data: NotificationRequestDTO }): UpdatePayment {
    const item = opts.data.notificationItems[0].NotificationRequestItem;

    return {
      id: item.merchantReference,
      pspReference: item.originalReference || item.pspReference,
      transaction: this.populateTransaction(item),
    };
  }

  private populateTransaction(item: NotificationRequestItem): TransactionData {
    switch (item.eventCode) {
      case NotificationRequestItem.EventCodeEnum.Authorisation:
        return {
          type: 'Authorization',
          state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
          amount: this.populateAmount(item),
          interactionId: item.pspReference,
        };
      case NotificationRequestItem.EventCodeEnum.Capture:
        return {
          type: 'Charge',
          state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
          amount: this.populateAmount(item),
          interactionId: item.pspReference,
        };
      case NotificationRequestItem.EventCodeEnum.CaptureFailed:
        return {
          type: 'Charge',
          state: 'Failure',
          amount: this.populateAmount(item),
          interactionId: item.pspReference,
        };
      case NotificationRequestItem.EventCodeEnum.Cancellation:
        return {
          type: 'CancelAuthorization',
          state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
          amount: this.populateAmount(item),
          interactionId: item.pspReference,
        };
      case NotificationRequestItem.EventCodeEnum.Refund:
        return {
          type: 'Refund',
          state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
          amount: this.populateAmount(item),
          interactionId: item.pspReference,
        };
      case NotificationRequestItem.EventCodeEnum.RefundFailed:
        return {
          type: 'Refund',
          state: 'Failure',
          amount: this.populateAmount(item),
          interactionId: item.pspReference,
        };
      case NotificationRequestItem.EventCodeEnum.Chargeback:
        return {
          type: 'Chargeback',
          state: 'Success',
          amount: this.populateAmount(item),
          interactionId: item.pspReference,
        };
      default:
        throw new UnsupportedNotificationError({ notificationEvent: item.eventCode.toString() });
    }
  }

  private populateAmount(item: NotificationRequestItem): Money {
    return {
      centAmount: item.amount.value as number,
      currencyCode: item.amount.currency as string,
    };
  }
}
