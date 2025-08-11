import { TokenizationCreatedDetailsNotificationRequest } from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/tokenizationCreatedDetailsNotificationRequest';

import { PaymentMethodDraft } from '@commercetools/connect-payments-sdk';

import { NotificationTokenizationDTO } from '../../dtos/adyen-payment.dto';
import { UnsupportedNotificationError } from '../../errors/adyen-api.error';
import { getSavedPaymentsConfig } from '../../config/saved-payment-method.config';

export type NotificationTokenizationConverterResponse = {
  draft?: PaymentMethodDraft;
};

export class NotificationTokenizationConverter {
  public async convert(opts: {
    data: NotificationTokenizationDTO;
  }): Promise<NotificationTokenizationConverterResponse> {
    let response: NotificationTokenizationConverterResponse = {};

    if (opts.data.type === TokenizationCreatedDetailsNotificationRequest.TypeEnum.RecurringTokenCreated) {
      response.draft = await this.processRecurringTokenCreated(opts.data);
    } else {
      throw new UnsupportedNotificationError({ notificationEvent: opts.data.type });
    }

    return response;
  }

  private async processRecurringTokenCreated(
    data: TokenizationCreatedDetailsNotificationRequest,
  ): Promise<PaymentMethodDraft> {
    return {
      customer: {
        id: data.data.shopperReference,
        typeId: 'customer',
      },
      paymentInterface: getSavedPaymentsConfig().config.paymentInterface,
      interfaceAccount: getSavedPaymentsConfig().config.interfaceAccount,
      method: data.data.type,
      default: false,
      paymentMethodStatus: 'Active',
      token: {
        value: data.data.storedPaymentMethodId,
      },
    };
  }
}
