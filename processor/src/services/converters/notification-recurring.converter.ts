import {
  RecurringTokenStoreOperation,
  TokenizationAlreadyExistingDetailsNotificationRequest,
  TokenizationCreatedDetailsNotificationRequest,
} from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/models';

import { CommercetoolsPaymentMethodTypes } from '@commercetools/connect-payments-sdk';

import { NotificationTokenizationDTO } from '../../dtos/adyen-payment.dto';
import { UnsupportedNotificationError } from '../../errors/adyen-api.error';
import { getStoredPaymentMethodsConfig } from '../../config/stored-payment-methods.config';
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
    } else if (
      opts.data.type === TokenizationAlreadyExistingDetailsNotificationRequest.TypeEnum.RecurringTokenAlreadyExisting
    ) {
      response.draft = await this.processRecurringTokenAlreadyExists(opts.data);
    } else {
      throw new UnsupportedNotificationError({ notificationEvent: opts.data.type });
    }

    return response;
  }

  private async processRecurringTokenCreated(
    notification: TokenizationCreatedDetailsNotificationRequest,
  ): Promise<CommercetoolsPaymentMethodTypes.SavePaymentMethodDraft> {
    return await this.buildDraftFromNotificationData(notification.data);
  }

  private async processRecurringTokenAlreadyExists(
    notification: TokenizationAlreadyExistingDetailsNotificationRequest,
  ): Promise<CommercetoolsPaymentMethodTypes.SavePaymentMethodDraft> {
    return await this.buildDraftFromNotificationData(notification.data);
  }

  private async buildDraftFromNotificationData(
    recurringTokenOperationData: RecurringTokenStoreOperation,
  ): Promise<CommercetoolsPaymentMethodTypes.SavePaymentMethodDraft> {
    const method = await this.mapNotificationPaymentMethodTypeToCTType(recurringTokenOperationData);

    return {
      customerId: recurringTokenOperationData.shopperReference,
      method,
      paymentInterface: getStoredPaymentMethodsConfig().config.paymentInterface,
      interfaceAccount: getStoredPaymentMethodsConfig().config.interfaceAccount,
      token: recurringTokenOperationData.storedPaymentMethodId,
    };
  }

  /**
   * The notification.data.type value is not "scheme" or "afterpaytouch" but instead it's for example "visapremiumdebit".
   * So we need to fetch the values via the API before we can map it to CT values.
   */
  private async mapNotificationPaymentMethodTypeToCTType(
    recurringTokenOperationData: RecurringTokenStoreOperation,
  ): Promise<string> {
    const customersTokenDetailsFromAdyen = await AdyenApi().RecurringApi.getTokensForStoredPaymentDetails(
      recurringTokenOperationData.shopperReference,
      getConfig().adyenMerchantAccount,
    );

    const detailFromAdyen = customersTokenDetailsFromAdyen.storedPaymentMethods?.find(
      (spm) => recurringTokenOperationData.storedPaymentMethodId === spm.id,
    );

    if (!detailFromAdyen || !detailFromAdyen.type) {
      log.warn(
        'Received no token detail information from Adyen that is required to properly map over the payment method type, falling back to the one from the notification',
      );

      return recurringTokenOperationData.type;
    }

    return convertPaymentMethodFromAdyenFormat(detailFromAdyen.type);
  }
}
