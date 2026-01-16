import {
  RecurringTokenStoreOperation,
  TokenizationAlreadyExistingDetailsNotificationRequest,
  TokenizationCreatedDetailsNotificationRequest,
} from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/models';

import {
  CommercetoolsPaymentMethodTypes,
  CustomFieldsDraft,
  GenerateCardDetailsCustomFieldsDraft,
} from '@commercetools/connect-payments-sdk';

import { NotificationTokenizationDTO } from '../../dtos/adyen-payment.dto';
import { UnsupportedNotificationError } from '../../errors/adyen-api.error';
import { getStoredPaymentMethodsConfig } from '../../config/stored-payment-methods.config';
import { convertAdyenCardBrandToCTFormat, convertPaymentMethodFromAdyenFormat } from './helper.converter';
import { AdyenApi } from '../../clients/adyen.client';
import { getConfig } from '../../config/config';
import { log } from '../../libs/logger';
import { StoredPaymentMethodResource } from '@adyen/api-library/lib/src/typings/checkout/storedPaymentMethodResource';

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
    const tokenDetailsFromAdyen = await this.getAdyenTokenDetails(recurringTokenOperationData);
    const paymentMethodConvertedToCT = await this.mapNotificationPaymentMethodTypeToCTType(
      recurringTokenOperationData,
      tokenDetailsFromAdyen,
    );
    const customFields = this.getCustomFieldsForDraft(tokenDetailsFromAdyen);

    return {
      customerId: recurringTokenOperationData.shopperReference,
      method: paymentMethodConvertedToCT,
      paymentInterface: getStoredPaymentMethodsConfig().config.paymentInterface,
      interfaceAccount: getStoredPaymentMethodsConfig().config.interfaceAccount,
      token: recurringTokenOperationData.storedPaymentMethodId,
      customFields,
    };
  }

  private async getAdyenTokenDetails(
    recurringTokenOperationData: RecurringTokenStoreOperation,
  ): Promise<StoredPaymentMethodResource | undefined> {
    const customersTokenDetailsFromAdyen = await AdyenApi().RecurringApi.getTokensForStoredPaymentDetails(
      recurringTokenOperationData.shopperReference,
      getConfig().adyenMerchantAccount,
    );

    const storedPaymentMethodDetail = customersTokenDetailsFromAdyen.storedPaymentMethods?.find(
      (spm) => recurringTokenOperationData.storedPaymentMethodId === spm.id,
    );

    return storedPaymentMethodDetail;
  }

  /**
   * The notification.data.type value is not "scheme" or "afterpaytouch" but instead it's for example "visapremiumdebit".
   */
  private async mapNotificationPaymentMethodTypeToCTType(
    recurringTokenOperationData: RecurringTokenStoreOperation,
    storedPaymentMethodResource?: StoredPaymentMethodResource,
  ): Promise<string> {
    if (!storedPaymentMethodResource || !storedPaymentMethodResource.type) {
      log.warn(
        'Received no token detail information from Adyen that is required to properly map over the payment method type, falling back to the one from the notification',
      );

      return recurringTokenOperationData.type;
    }

    return convertPaymentMethodFromAdyenFormat(storedPaymentMethodResource.type);
  }

  private getCustomFieldsForDraft(
    storedPaymentMethodResource?: StoredPaymentMethodResource,
  ): CustomFieldsDraft | undefined {
    if (!getConfig().adyenStorePaymentMethodDetailsEnabled || !storedPaymentMethodResource) {
      return undefined;
    }

    return this.mapCustomFieldDetails(storedPaymentMethodResource);
  }

  private mapCustomFieldDetails(
    storedPaymentMethodResource: StoredPaymentMethodResource,
  ): CustomFieldsDraft | undefined {
    switch (storedPaymentMethodResource.type) {
      case 'scheme': {
        const lastFourDigits = storedPaymentMethodResource.lastFour;
        const expiryMonth = storedPaymentMethodResource.expiryMonth;
        const expiryYear = storedPaymentMethodResource.expiryYear;
        const brand = storedPaymentMethodResource.brand;

        return GenerateCardDetailsCustomFieldsDraft({
          brand: convertAdyenCardBrandToCTFormat(brand),
          lastFour: lastFourDigits,
          expiryMonth: Number(expiryMonth),
          expiryYear: Number(expiryYear),
        });
      }
      default: {
        return undefined;
      }
    }
  }
}
