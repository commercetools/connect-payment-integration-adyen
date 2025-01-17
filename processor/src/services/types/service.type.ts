import { TransactionData } from '@commercetools/connect-payments-sdk';
export type NotificationUpdatePayment = {
  merchantReference: string;
  pspReference?: string;
  transactions: TransactionData[];
  paymentMethod?: string;
};
