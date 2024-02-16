import { PaymentNotificationSchemaDTO } from '../../dtos/adyen-payment.dts';

export type ProcessNotification = {
  data: PaymentNotificationSchemaDTO;
};
