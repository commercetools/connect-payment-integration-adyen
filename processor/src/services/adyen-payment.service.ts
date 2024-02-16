import { CommercetoolsCartService, CommercetoolsPaymentService } from '@commercetools/connect-payments-sdk';
import { NotificationConverter } from './converters/notification.converter';
import { ProcessNotification as ProcessNotificationRequest } from './types/adyen-payment.type';
import { hmacValidator } from '@adyen/api-library';
import { config } from '../config/config';

export type AdyenPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
  notificationConverter: NotificationConverter;
};

export class AdyenPaymentService {
  private ctCartService: CommercetoolsCartService;
  private ctPaymentService: CommercetoolsPaymentService;
  private notificationConverter: NotificationConverter;

  constructor(opts: AdyenPaymentServiceOptions) {
    this.ctCartService = opts.ctCartService;
    this.ctPaymentService = opts.ctPaymentService;
    this.notificationConverter = opts.notificationConverter;
  }

  public async processNotification(opts: ProcessNotificationRequest): Promise<void> {
    await this.validateHmac(opts);
    const updateData = await this.notificationConverter.convert(opts);
    await this.ctPaymentService.updatePayment(updateData);
  }

  private async validateHmac(opts: ProcessNotificationRequest): Promise<void> {
    if (!opts.data.notificationItems || opts.data.notificationItems.length === 0) {
      //TODO: throw an error 401
    }

    const validator = new hmacValidator();
    const item = opts.data.notificationItems[0].NotificationRequestItem;

    if (!validator.validateHMAC(item, config.adyenHMACKey)) {
      //TODO: throw an error 401
    }
  }
}
