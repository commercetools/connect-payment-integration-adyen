import { TransactionData } from '@commercetools/connect-payments-sdk';
export type NotificationUpdatePayment = {
  id: string;
  pspReference?: string;
  transactions: TransactionData[];
  paymentMethod?: string;
};
