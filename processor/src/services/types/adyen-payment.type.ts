import { PaymentNotificationSchemaDTO } from '../../dtos/adyen-payment.dto';

export type ProcessNotification = {
  data: PaymentNotificationSchemaDTO;
};
