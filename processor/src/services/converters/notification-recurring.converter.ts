import { TokenizationCreatedDetailsNotificationRequest } from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/tokenizationCreatedDetailsNotificationRequest';

import { CommercetoolsPaymentMethodTypes } from '@commercetools/connect-payments-sdk';

import { NotificationTokenizationDTO } from '../../dtos/adyen-payment.dto';
import { UnsupportedNotificationError } from '../../errors/adyen-api.error';
import { getSavedPaymentsConfig } from '../../config/saved-payment-method.config';
import { convertPaymentMethodFromAdyenFormat } from './helper.converter';
import { AdyenApi } from '../../clients/adyen.client';
import { getConfig } from '../../config/config';
import { log } from '../../libs/logger';

export type NotificationTokenizationConverterResponse = {
  draft?: CommercetoolsPaymentMethodTypes.SavePaymentMethodDraft;
};

export class NotificationTokenizationConverter {
  public async convert(opts: {
    data: NotificationTokenizationDTO;
  }): Promise<NotificationTokenizationConverterResponse> {
    const response: NotificationTokenizationConverterResponse = {};

    if (opts.data.type === TokenizationCreatedDetailsNotificationRequest.TypeEnum.RecurringTokenCreated) {
      response.draft = await this.processRecurringTokenCreated(opts.data);
    } else {
      throw new UnsupportedNotificationError({ notificationEvent: opts.data.type });
    }

    return response;
  }

  private async processRecurringTokenCreated(
    notification: TokenizationCreatedDetailsNotificationRequest,
  ): Promise<CommercetoolsPaymentMethodTypes.SavePaymentMethodDraft> {
    const method = await this.mapNotificationPaymentMethodTypeToCTType(notification);

    return {
      customerId: notification.data.shopperReference,
      method,
      paymentInterface: getSavedPaymentsConfig().config.paymentInterface,
      interfaceAccount: getSavedPaymentsConfig().config.interfaceAccount,
      token: notification.data.storedPaymentMethodId,
    };
  }

  /**
   * The notification.data.type value is not "scheme" or "afterpaytouch" but instead it's for example "visapremiumdebit".
   * So we need to fetch the values via the API before we can map it to CT values.
   */
  private async mapNotificationPaymentMethodTypeToCTType(
    notification: TokenizationCreatedDetailsNotificationRequest,
  ): Promise<string> {
    const customersTokenDetailsFromAdyen = await AdyenApi().RecurringApi.getTokensForStoredPaymentDetails(
      notification.data.shopperReference,
      getConfig().adyenMerchantAccount,
    );

    const detailFromAdyen = customersTokenDetailsFromAdyen.storedPaymentMethods?.find(
      (spm) => notification.data.storedPaymentMethodId === spm.id,
    );

    if (!detailFromAdyen || !detailFromAdyen.type) {
      log.warn(
        'Received no token detail information from Adyen that is required to properly map over the payment method type, falling back to the one from the notification',
      );

      return notification.data.type;
    }

    return convertPaymentMethodFromAdyenFormat(detailFromAdyen.type);
  }
}
