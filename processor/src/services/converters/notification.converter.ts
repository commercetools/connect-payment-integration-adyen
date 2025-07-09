import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { NotificationRequestDTO } from '../../dtos/adyen-payment.dto';
import { TransactionData, CommercetoolsPaymentService } from '@commercetools/connect-payments-sdk';
import { UnsupportedNotificationError } from '../../errors/adyen-api.error';
import { NotificationUpdatePayment } from '../types/service.type';
import { PopulateTransactionData } from './populate-transaction-data';

export class NotificationConverter extends PopulateTransactionData {
  private POPULATE_TRANSACTIONS_MAPPER: Partial<
    Record<NotificationRequestItem.EventCodeEnum, (item: NotificationRequestItem) => Promise<TransactionData[]>>
  > = {
    [NotificationRequestItem.EventCodeEnum.Authorisation]: this.manageAuthorizationTransactionData,
    [NotificationRequestItem.EventCodeEnum.Expire]: this.manageExpireTransactionData,
    [NotificationRequestItem.EventCodeEnum.OfferClosed]: this.manageOfferClosedTransactionData,
    [NotificationRequestItem.EventCodeEnum.Capture]: this.manageCaptureTransactionData,
    [NotificationRequestItem.EventCodeEnum.CaptureFailed]: this.manageCaptureFailedTransactionData,
    [NotificationRequestItem.EventCodeEnum.Cancellation]: this.manageCancelAuthorizationTransactionData,
    [NotificationRequestItem.EventCodeEnum.Refund]: this.manageRefundTransactionData,
    [NotificationRequestItem.EventCodeEnum.RefundFailed]: this.manageRefundFailedTransactionData,
    [NotificationRequestItem.EventCodeEnum.Chargeback]: this.manageChargebackTransactionData,
    [NotificationRequestItem.EventCodeEnum.CancelOrRefund]: this.manageCancelOrRefundTransactionData,
  };

  constructor(ctPaymentService: CommercetoolsPaymentService) {
    super(ctPaymentService);
  }

  public async convert(opts: { data: NotificationRequestDTO }): Promise<NotificationUpdatePayment> {
    const item = opts.data.notificationItems[0].NotificationRequestItem;

    return {
      merchantReference: item.merchantReference,
      pspReference: item.originalReference || item.pspReference,
      paymentMethod: item.paymentMethod,
      transactions: await this.populateTransactions(item),
    };
  }

  private async populateTransactions(item: NotificationRequestItem): Promise<TransactionData[]> {
    const transactionsMapper = this.POPULATE_TRANSACTIONS_MAPPER[item.eventCode];
    if (!transactionsMapper) {
      throw new UnsupportedNotificationError({ notificationEvent: item.eventCode.toString() });
    }
    return transactionsMapper(item);
  }
}
