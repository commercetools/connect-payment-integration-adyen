import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { NotificationRequestDTO } from '../../dtos/adyen-payment.dto';
import { TransactionData, Money, MoneyConverters } from '@commercetools/connect-payments-sdk';
import { UnsupportedNotificationError } from '../../errors/adyen-api.error';
import { paymentMethodConfig } from '../../config/payment-method.config';
import { NotificationUpdatePayment } from '../types/service.type';
import { CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING } from '../../constants/currencies';

export class NotificationConverter {
  public convert(opts: { data: NotificationRequestDTO }): NotificationUpdatePayment {
    const item = opts.data.notificationItems[0].NotificationRequestItem;

    return {
      id: item.merchantReference,
      pspReference: item.originalReference || item.pspReference,
      paymentMethod: item.paymentMethod,
      transactions: this.populateTransactions(item),
    };
  }

  private populateTransactions(item: NotificationRequestItem): TransactionData[] {
    switch (item.eventCode) {
      case NotificationRequestItem.EventCodeEnum.Authorisation:
        return [
          {
            type: 'Authorization',
            state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
            amount: this.populateAmount(item),
            interactionId: item.pspReference,
          },
          ...(item.success === NotificationRequestItem.SuccessEnum.True && !this.isSeparateCaptureSupported(item)
            ? [
                {
                  type: 'Charge',
                  state: 'Success',
                  amount: this.populateAmount(item),
                  interactionId: item.pspReference,
                },
              ]
            : []),
        ];
      case NotificationRequestItem.EventCodeEnum.Expire:
        return [
          {
            type: 'Authorization',
            state: 'Failure',
            amount: this.populateAmount(item),
            interactionId: item.pspReference,
          },
        ];
      case NotificationRequestItem.EventCodeEnum.Capture:
        return [
          {
            type: 'Charge',
            state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
            amount: this.populateAmount(item),
            interactionId: item.pspReference,
          },
        ];
      case NotificationRequestItem.EventCodeEnum.CaptureFailed:
        return [
          {
            type: 'Charge',
            state: 'Failure',
            amount: this.populateAmount(item),
            interactionId: item.pspReference,
          },
        ];
      case NotificationRequestItem.EventCodeEnum.Cancellation:
        return [
          {
            type: 'CancelAuthorization',
            state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
            amount: this.populateAmount(item),
            interactionId: item.pspReference,
          },
        ];
      case NotificationRequestItem.EventCodeEnum.Refund:
        return [
          {
            type: 'Refund',
            state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
            amount: this.populateAmount(item),
            interactionId: item.pspReference,
          },
        ];
      case NotificationRequestItem.EventCodeEnum.RefundFailed:
        return [
          {
            type: 'Refund',
            state: 'Failure',
            amount: this.populateAmount(item),
            interactionId: item.pspReference,
          },
        ];
      case NotificationRequestItem.EventCodeEnum.Chargeback:
        return [
          {
            type: 'Chargeback',
            state: 'Success',
            amount: this.populateAmount(item),
            interactionId: item.pspReference,
          },
        ];
      default:
        throw new UnsupportedNotificationError({ notificationEvent: item.eventCode.toString() });
    }
  }

  private populateAmount(item: NotificationRequestItem): Money {
    const isoCorrectedCentAmount = MoneyConverters.convertWithMapping({
      mapping: CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING,
      amount: item.amount.value as number,
      currencyCode: item.amount.currency as string,
    });

    return {
      centAmount: isoCorrectedCentAmount,
      currencyCode: item.amount.currency as string,
    };
  }

  private isSeparateCaptureSupported(item: NotificationRequestItem): boolean {
    if (item.paymentMethod && paymentMethodConfig[item.paymentMethod]) {
      return paymentMethodConfig[item.paymentMethod].supportSeparateCapture;
    }

    return true;
  }
}
