import { TokenizationCreatedDetailsNotificationRequest } from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/tokenizationCreatedDetailsNotificationRequest';

import { CommercetoolsPaymentMethodTypes } from '@commercetools/connect-payments-sdk';

import { NotificationTokenizationDTO } from '../../dtos/adyen-payment.dto';
import { UnsupportedNotificationError } from '../../errors/adyen-api.error';
import { getSavedPaymentsConfig } from '../../config/saved-payment-method.config';

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
    data: TokenizationCreatedDetailsNotificationRequest,
  ): Promise<CommercetoolsPaymentMethodTypes.SavePaymentMethodDraft> {
    return {
      customerId: data.data.shopperReference,
      method: data.data.type,
      paymentInterface: getSavedPaymentsConfig().config.paymentInterface,
      interfaceAccount: getSavedPaymentsConfig().config.interfaceAccount,
      token: data.data.storedPaymentMethodId,
    };
  }
}
