import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { CommercetoolsPaymentService, CurrencyConverters, Money, Payment } from '@commercetools/connect-payments-sdk';
import { CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING } from '../../constants/currencies';
import { paymentMethodConfig } from '../../config/payment-method.config';

export class PopulateTransactionData {
  constructor(private ctPaymentService: CommercetoolsPaymentService) {
    this.ctPaymentService = ctPaymentService;
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

  manageAuthorizationTransactionData = async (item: NotificationRequestItem) => [
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

  manageExpireTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Authorization',
      state: 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  manageOfferClosedTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Authorization',
      state: 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  manageCaptureTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Charge',
      state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure ',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  manageCaptureFailedTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Charge',
      state: 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  manageCancelAuthorizationTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'CancelAuthorization',
      state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  manageRefundTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Refund',
      state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  manageRefundFailedTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Refund',
      state: 'Failure',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  manageChargebackTransactionData = async (item: NotificationRequestItem) => [
    {
      type: 'Chargeback',
      state: 'Success',
      amount: this.populateAmount(item),
      interactionId: item.pspReference,
    },
  ];

  manageCancelOrRefundTransactionData = async (item: NotificationRequestItem) => {
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
}
