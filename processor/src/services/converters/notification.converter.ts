import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { NotificationRequestDTO } from '../../dtos/adyen-payment.dto';
import {
  TransactionData,
  Money,
  CurrencyConverters,
  CommercetoolsPaymentService,
  Payment,
  CustomFieldsDraft,
  GenerateCardDetailsCustomFieldsDraft,
} from '@commercetools/connect-payments-sdk';
import { GenerateGiftCardDetailsCustomFieldsDraft } from '../../custom-types/gift-card-details';
import { UnsupportedNotificationError } from '../../errors/adyen-api.error';
import { getPaymentMethodConfig, GIFT_CARD_BRANDS } from '../../config/payment-method.config';
import { NotificationUpdatePayment } from '../types/service.type';
import { CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING } from '../../constants/currencies';
import { convertAdyenCardBrandToCTFormat, convertAdyenGiftCardBrandToCTFormat } from './helper.converter';
import { getConfig } from '../../config/config';

export class NotificationConverter {
  private ctPaymentService: CommercetoolsPaymentService;

  constructor(ctPaymentService: CommercetoolsPaymentService) {
    this.ctPaymentService = ctPaymentService;
  }

  public async convert(opts: { data: NotificationRequestDTO }): Promise<NotificationUpdatePayment[]> {
    const item = opts.data.notificationItems[0].NotificationRequestItem;
    return this.populatePaymentUpdates(item);
  }

  private buildSingleUpdate(
    item: NotificationRequestItem,
    transactions: TransactionData[],
    paymentMethodInfoCustomField?: CustomFieldsDraft,
  ): NotificationUpdatePayment[] {
    return [
      {
        merchantReference: item.merchantReference,
        pspReference: item.originalReference || item.pspReference,
        paymentMethod: item.paymentMethod,
        transactions,
        paymentMethodInfoCustomField,
      },
    ];
  }

  private manageAuthorizationTransactionData = async (
    item: NotificationRequestItem,
  ): Promise<NotificationUpdatePayment[]> =>
    this.buildSingleUpdate(
      item,
      [
        {
          type: 'Authorization',
          state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
          amount: this.populateAmount(item),
          interactionId: item.pspReference,
        },
        ...(item.success === NotificationRequestItem.SuccessEnum.True && !this.isSeparateCaptureSupported(item)
          ? [{ type: 'Charge', state: 'Success', amount: this.populateAmount(item), interactionId: item.pspReference }]
          : []),
      ],
      this.convertNotificationItemToCustomType(item),
    );

  private manageExpireTransactionData = async (item: NotificationRequestItem): Promise<NotificationUpdatePayment[]> =>
    this.buildSingleUpdate(item, [
      { type: 'Authorization', state: 'Failure', amount: this.populateAmount(item), interactionId: item.pspReference },
    ]);

  private manageOfferClosedTransactionData = async (
    item: NotificationRequestItem,
  ): Promise<NotificationUpdatePayment[]> =>
    this.buildSingleUpdate(item, [
      { type: 'Authorization', state: 'Failure', amount: this.populateAmount(item), interactionId: item.pspReference },
    ]);

  private manageCaptureTransactionData = async (item: NotificationRequestItem): Promise<NotificationUpdatePayment[]> =>
    this.buildSingleUpdate(item, [
      {
        type: 'Charge',
        state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
        amount: this.populateAmount(item),
        interactionId: item.pspReference,
      },
    ]);

  private manageCaptureFailedTransactionData = async (
    item: NotificationRequestItem,
  ): Promise<NotificationUpdatePayment[]> =>
    this.buildSingleUpdate(item, [
      { type: 'Charge', state: 'Failure', amount: this.populateAmount(item), interactionId: item.pspReference },
    ]);

  private manageCancelAuthorizationTransactionData = async (
    item: NotificationRequestItem,
  ): Promise<NotificationUpdatePayment[]> =>
    this.buildSingleUpdate(item, [
      {
        type: 'CancelAuthorization',
        state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
        amount: this.populateAmount(item),
        interactionId: item.pspReference,
      },
    ]);

  private manageRefundTransactionData = async (item: NotificationRequestItem): Promise<NotificationUpdatePayment[]> =>
    this.buildSingleUpdate(item, [
      {
        type: 'Refund',
        state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
        amount: this.populateAmount(item),
        interactionId: item.pspReference,
      },
    ]);

  private manageRefundFailedTransactionData = async (
    item: NotificationRequestItem,
  ): Promise<NotificationUpdatePayment[]> =>
    this.buildSingleUpdate(item, [
      { type: 'Refund', state: 'Failure', amount: this.populateAmount(item), interactionId: item.pspReference },
    ]);

  private manageChargebackTransactionData = async (
    item: NotificationRequestItem,
  ): Promise<NotificationUpdatePayment[]> =>
    this.buildSingleUpdate(item, [
      { type: 'Chargeback', state: 'Success', amount: this.populateAmount(item), interactionId: item.pspReference },
    ]);

  private manageCancelOrRefundTransactionData = async (
    item: NotificationRequestItem,
  ): Promise<NotificationUpdatePayment[]> => {
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
    const transactions = isMismatchedType
      ? [
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
        ]
      : [
          {
            type: transactionType,
            state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure ',
            amount: this.populateAmount(item),
            interactionId: item.pspReference,
          },
        ];
    return this.buildSingleUpdate(item, transactions);
  };

  private manageOrderClosedTransactionData = async (
    item: NotificationRequestItem,
  ): Promise<NotificationUpdatePayment[]> => {
    // success: true — order closed after all payments completed.
    // Individual AUTHORISATION webhooks already processed each payment. Nothing to do.
    if (item.success === NotificationRequestItem.SuccessEnum.True) {
      return [];
    }

    // success: false — order expired or was cancelled. Adyen automatically refunds gift card partial
    // payments but does not send individual REFUND webhooks for them. We use ORDER_CLOSED as the
    // trigger to mark each partial payment as reversed in commercetools.
    const results: NotificationUpdatePayment[] = [];
    let n = 1;
    while (item.additionalData?.[`order-${n}-pspReference`]) {
      const partialPspReference = item.additionalData[`order-${n}-pspReference`] as string;
      const payments = await this.ctPaymentService.findPaymentsByInterfaceId({ interfaceId: partialPspReference });
      const ctPayment = payments[0];

      if (ctPayment) {
        const hasSuccessfulCharge = ctPayment.transactions.some((tx) => tx.type === 'Charge' && tx.state === 'Success');
        const transactionType = hasSuccessfulCharge ? 'Refund' : 'CancelAuthorization';
        const originalTx = ctPayment.transactions.find(
          (tx) => (tx.type === 'Charge' || tx.type === 'Authorization') && tx.state === 'Success',
        );

        results.push({
          merchantReference: item.merchantReference,
          pspReference: partialPspReference,
          transactions: [
            {
              type: transactionType,
              state: 'Success',
              amount: originalTx?.amount ?? this.populateAmount(item),
              interactionId: item.pspReference,
            },
          ],
        });
      }

      n++;
    }

    return results;
  };

  private POPULATE_TRANSACTIONS_MAPPER: Partial<
    Record<
      NotificationRequestItem.EventCodeEnum,
      (item: NotificationRequestItem) => Promise<NotificationUpdatePayment[]>
    >
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
    [NotificationRequestItem.EventCodeEnum.OrderClosed]: this.manageOrderClosedTransactionData,
  };

  private convertNotificationItemToCustomType(item: NotificationRequestItem): CustomFieldsDraft | undefined {
    if (!getConfig().adyenStorePaymentMethodDetailsEnabled) {
      return undefined;
    }

    const isAuthorisation = item.eventCode === NotificationRequestItem.EventCodeEnum.Authorisation;
    const isSuccess = item.success === NotificationRequestItem.SuccessEnum.True;
    const shoudGatherCustomFieldDraft = isAuthorisation && isSuccess;

    if (!shoudGatherCustomFieldDraft) {
      return undefined;
    }

    if (!item.paymentMethod) {
      return undefined;
    }

    const isSchemePayment = this.isSchemeCardBrand(item.paymentMethod);

    if (isSchemePayment) {
      return this.convertSchemePaymentToCustomField(item);
    }

    const isGiftCard = this.isGiftCardBrand(item.paymentMethod);
    if (isGiftCard) {
      return GenerateGiftCardDetailsCustomFieldsDraft({ brand: convertAdyenGiftCardBrandToCTFormat(item.paymentMethod) });
    }

    return undefined;
  }

  /**
   * Function to evaluate if the given text is one of the Adyen supported creditcard/scheme brands.
   *
   * @see https://docs.adyen.com/payment-methods/cards/custom-card-integration#supported-card-types
   *
   * @param text the text to validate against
   * @returns true if the given text is one of the Adyen supported creditcard/scheme brands
   */
  private isSchemeCardBrand(text: string): boolean {
    const schemeBrands = [
      'amex',
      'argencard',
      'bcmc',
      'bijcard',
      'cabal',
      'cartebancaire',
      'codensa',
      'cup',
      'dankort',
      'diners',
      'discover',
      'electron',
      'elo',
      'forbrugsforeningen',
      'hiper',
      'hipercard',
      'jcb',
      'karenmillen',
      'laser',
      'maestro',
      'maestrouk',
      'mc',
      'mcalphabankbonus',
      'mir',
      'naranja',
      'oasis',
      'rupay',
      'shopping',
      'solo',
      'troy',
      'uatp',
      'visa',
      'visaalphabankbonus',
      'visadankort',
      'warehouse',
    ];

    return schemeBrands.includes(text);
  }

  private isGiftCardBrand(text: string): boolean {
    return (GIFT_CARD_BRANDS as readonly string[]).includes(text);
  }

  private convertSchemePaymentToCustomField(item: NotificationRequestItem): CustomFieldsDraft {
    const lastFourDigits = item.additionalData?.cardSummary; // Needs to be enabled in "Additional data" settings in Adyen.
    const expiryDate = item.additionalData?.expiryDate; // Needs to be enabled in "Additional data" settings in Adyen. Returned as: '6/2016'.
    const brand = item.additionalData?.paymentMethod; // The paymentMethod property contains the brand of the card and not the paymentMethodType `scheme`. Instead its visa, amex, etc.

    let expiryMonth: string | undefined = undefined;
    let expiryYear: string | undefined = undefined;

    if (expiryDate) {
      const expireMonthAndYear = expiryDate.split('/');
      expiryMonth = expireMonthAndYear[0];
      expiryYear = expireMonthAndYear[1];
    }

    return GenerateCardDetailsCustomFieldsDraft({
      brand: convertAdyenCardBrandToCTFormat(brand),
      lastFour: lastFourDigits,
      expiryMonth: Number(expiryMonth),
      expiryYear: Number(expiryYear),
    });
  }

  private async populatePaymentUpdates(item: NotificationRequestItem): Promise<NotificationUpdatePayment[]> {
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
    const paymentMethodConfig = getPaymentMethodConfig();
    if (item.paymentMethod && paymentMethodConfig[item.paymentMethod]) {
      return paymentMethodConfig[item.paymentMethod].supportSeparateCapture;
    }

    return true;
  }
}
