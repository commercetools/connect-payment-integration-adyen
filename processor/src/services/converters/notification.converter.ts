import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { NotificationRequestDTO } from '../../dtos/adyen-payment.dto';
import { TransactionData, Money, CurrencyConverters } from '@commercetools/connect-payments-sdk';
import { UnsupportedNotificationError } from '../../errors/adyen-api.error';
import { paymentMethodConfig } from '../../config/payment-method.config';
import { NotificationUpdatePayment } from '../types/service.type';
import { CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING } from '../../constants/currencies';

export class NotificationConverter {
  public convert(opts: { data: NotificationRequestDTO }): NotificationUpdatePayment {
    const item = opts.data.notificationItems[0].NotificationRequestItem;

    return {
      merchantReference: item.merchantReference,
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
      case NotificationRequestItem.EventCodeEnum.OfferClosed:
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
      case NotificationRequestItem.EventCodeEnum.CancelOrRefund: {
        const processedModification = item.additionalData?.['modification.action'];

        // HINT: This check is necessary because we add a cancel authorization request in coco, so if Adyen processes something else (refund)
        // we need to fail the initial cancel authorization created and create a new refund transaction object, which is why in the check we return both transaction items.
        // If the check is falsey and adyen actually performs a cancel operation, we simply update the cancel transaction we have in coco from 'pending' to 'success | failure' depending
        // on state returned by adyen
        if (processedModification !== 'cancel') {
          return [
            {
              type: 'CancelAuthorization',
              state: 'Failure',
              amount: this.populateAmount(item),
              interactionId: item.pspReference,
            },
            {
              type: this.populateCancelOrRefundTransactionType(item.additionalData),
              state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
              amount: this.populateAmount(item),
              interactionId: item.pspReference,
            },
          ];
        }

        return [
          {
            type: this.populateCancelOrRefundTransactionType(item.additionalData),
            state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
            amount: this.populateAmount(item),
            interactionId: item.pspReference,
          },
        ];
      }
      default:
        throw new UnsupportedNotificationError({ notificationEvent: item.eventCode.toString() });
    }
  }

  private populateCancelOrRefundTransactionType(additionalData: Record<string, string> | undefined): string {
    switch (additionalData?.['modification.action']) {
      case 'cancel':
        return 'CancelAuthorization';
      case 'refund':
        return 'Refund';
      default:
        return 'CancelAuthorization';
    }
  }

  private populateAmount(item: NotificationRequestItem): Money {
    const isoCorrectedCentAmount = CurrencyConverters.convertWithMapping({
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
