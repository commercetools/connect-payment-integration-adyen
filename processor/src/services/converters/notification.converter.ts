import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { NotificationRequestDTO } from '../../dtos/adyen-payment.dto';
import {
  TransactionData,
  Money,
  CurrencyConverters,
  CommercetoolsPaymentService,
  Payment,
} from '@commercetools/connect-payments-sdk';
import { UnsupportedNotificationError } from '../../errors/adyen-api.error';
import { paymentMethodConfig } from '../../config/payment-method.config';
import { NotificationUpdatePayment } from '../types/service.type';
import { CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING } from '../../constants/currencies';

export class NotificationConverter {
  private ctPaymentService: CommercetoolsPaymentService;

  private manageAuthorizationTransactionData = async (item: NotificationRequestItem) => [
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

  private manageExpireTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Authorization',
      state: 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  private manageOfferClosedTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Authorization',
      state: 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  private manageCaptureTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Charge',
      state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  private manageCaptureFailedTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Charge',
      state: 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  private manageCancelAuthorizationTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'CancelAuthorization',
      state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  private manageRefundTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Refund',
      state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  private manageRefundFailedTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Refund',
      state: 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  private manageChargebackTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Chargeback',
      state: 'Success',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  private manageCancelOrRefundTransactionData = async (item: NotificationRequestItem) => {
    const action = item.additionalData?.['modification.action'];
    const interfaceId = item.originalReference || item.pspReference;
    const payment = await this.findPayment(interfaceId, item.merchantReference);
    if (!payment) return [];
    const transactionType = this.mapAdyenActionToCoCoTransactionType(action);
    const existingReverseTransaction = payment.transactions.find((tx) => tx.interactionId === item.pspReference);
    const isMismatchedType = transactionType !== existingReverseTransaction?.type;
    // HINT: This check is necessary because we add a transaction in coco depending on if the payment was authorized or captured previously, so if Adyen processes something else (refund)
    // we need to fail the initial transaction created and create a new transaction reflecting the operation taken by adyen.
    // If the check is falsey and adyen actually performs a cancel operation, we simply update the cancel transaction we have in coco from 'pending' to 'success | failure' depending
    // on state returned by adyen
    if (isMismatchedType) {
      return [
        {
          type: existingReverseTransaction?.type || 'CancelAuthorization',
          state: 'Failure',
          amount: this.populateAmount(item),
          interactionId: item.pspReference,
        },
        {
          type: transactionType,
          state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure ',
          amount: this.populateAmount(item),
          interactionId: item.pspReference,
        },
      ];
    }
    return [
      {
        type: transactionType,
        state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure ',
        amount: this.populateAmount(item),
        interactionId: item.pspReference,
      },
    ];
  };
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
    this.ctPaymentService = ctPaymentService;
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

  private async findPayment(interfaceId: string, merchantReference: string): Promise<Payment | null> {
    const payments = await this.ctPaymentService.findPaymentsByInterfaceId({ interfaceId });
    return payments.length > 0 ? payments[0] : await this.ctPaymentService.getPayment({ id: merchantReference });
  }

  private mapAdyenActionToCoCoTransactionType(action?: string): string {
    switch (action) {
      case 'cancel':
        return 'CancelAuthorization';
      case 'refund':
        return 'Refund';
      case 'capture':
        return 'Charge';
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
