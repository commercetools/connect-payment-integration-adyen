import { TokenizationCreatedDetailsNotificationRequest } from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/tokenizationCreatedDetailsNotificationRequest';

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
    } else {
      throw new UnsupportedNotificationError({ notificationEvent: opts.data.type });
    }

    return response;
  }

  private async processRecurringTokenCreated(
    notification: TokenizationCreatedDetailsNotificationRequest,
  ): Promise<CommercetoolsPaymentMethodTypes.SavePaymentMethodDraft> {
    const customersTokenDetailsFromAdyen = await AdyenApi().RecurringApi.getTokensForStoredPaymentDetails(
      notification.data.shopperReference,
      getConfig().adyenMerchantAccount,
    );

    const storedPaymentMethodResourceFromAdyen = customersTokenDetailsFromAdyen.storedPaymentMethods?.find(
      (spm) => notification.data.storedPaymentMethodId === spm.id,
    );

    const method = await this.mapNotificationPaymentMethodTypeToCTType(
      notification,
      storedPaymentMethodResourceFromAdyen,
    );

    let customFields: CustomFieldsDraft | undefined;

    if (getConfig().adyenStorePaymentMethodDetailsEnabled && storedPaymentMethodResourceFromAdyen) {
      customFields = await this.mapCustomFieldDetails(storedPaymentMethodResourceFromAdyen);
    }

    return {
      customerId: notification.data.shopperReference,
      method,
      paymentInterface: getStoredPaymentMethodsConfig().config.paymentInterface,
      interfaceAccount: getStoredPaymentMethodsConfig().config.interfaceAccount,
      token: notification.data.storedPaymentMethodId,
      customFields,
    };
  }

  private async mapCustomFieldDetails(
    storedPaymentMethodResource: StoredPaymentMethodResource,
  ): Promise<CustomFieldsDraft | undefined> {
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

  /**
   * The notification.data.type value is not "scheme" or "afterpaytouch" but instead it's for example "visapremiumdebit". Use the information from Adyen to get the correct type.
   */
  private async mapNotificationPaymentMethodTypeToCTType(
    notification: TokenizationCreatedDetailsNotificationRequest,
    storedPaymentMethodResource?: StoredPaymentMethodResource,
  ): Promise<string> {
    if (!storedPaymentMethodResource || !storedPaymentMethodResource.type) {
      log.warn(
        'Received no token detail information from Adyen that is required to properly map over the payment method type, falling back to the one from the notification',
      );

      return notification.data.type;
    }

    return convertPaymentMethodFromAdyenFormat(storedPaymentMethodResource.type);
  }
}
