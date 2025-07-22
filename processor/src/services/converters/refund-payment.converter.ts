import { config } from '../../config/config';
import { PaymentRefundRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRefundRequest';
import { RefundPaymentRequest } from '../types/operation.type';
import { CurrencyConverters, Errorx, Payment, Transaction } from '@commercetools/connect-payments-sdk';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';

export class RefundPaymentConverter {
  public convertRequest(opts: RefundPaymentRequest): PaymentRefundRequest {
    const capturePspReference = this.getCapturePspReference(opts.payment, opts.transactionId);
    return {
      merchantAccount: config.adyenMerchantAccount,
      reference: opts.merchantReference || opts.payment.id,
      amount: {
        currency: opts.amount.currencyCode,
        value: CurrencyConverters.convertWithMapping({
          mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
          amount: opts.amount.centAmount,
          currencyCode: opts.amount.currencyCode,
        }),
      },
      ...(capturePspReference && { capturePspReference }),
    };
  }

  private getTransaction(payment: Payment, transactionId: string): Transaction {
    const transaction = payment.transactions.find((tx) => tx.id === transactionId);
    if (!transaction) {
      throw new Errorx({
        httpErrorStatus: 400,
        code: 'InvalidInput',
        message: `Transaction with ID '${transactionId}' does not exist`,
      });
    }

    if (transaction.type !== 'Charge') {
      throw new Errorx({
        httpErrorStatus: 400,
        code: 'InvalidInput',
        message: `Transaction with ID '${transactionId}' must be of type 'Charge'`,
      });
    }

    return transaction;
  }

  private getCapturePspReference(payment: Payment, transactionId?: string): string | undefined {
    if (!transactionId || !this.isPaypalPayment(payment)) {
      return undefined;
    }

    const transaction = this.getTransaction(payment, transactionId);
    return transaction.interactionId;
  }

  private isPaypalPayment(payment: Payment): boolean {
    return payment.paymentMethodInfo?.method === 'paypal';
  }
}
