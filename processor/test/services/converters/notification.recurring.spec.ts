import {
  TokenizationCreatedDetailsNotificationRequest,
  TokenizationUpdatedDetailsNotificationRequest,
} from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/models';

import { NotificationTokenizationDTO } from '../../../src/dtos/adyen-payment.dto';
import * as StoredPaymentMethodsConfig from '../../../src/config/stored-payment-methods.config';

import { NotificationTokenizationConverter } from '../../../src/services/converters/notification-recurring.converter';
import { UnsupportedNotificationError } from '../../../src/errors/adyen-api.error';
import { RecurringApi } from '@adyen/api-library/lib/src/services/checkout/recurringApi';

describe('notification.tokenization.converter', () => {
  const converter = new NotificationTokenizationConverter();

  test('it should convert a notification of type "recurring.token.created"', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const shopperReference = 'some-shopper-reference';
    const storedPaymentMethodId = 'abcdefg';
    const paymentInterface = 'adyen-payment-interface';
    const interfaceAccount = 'adyen-interface-account';
    const methodType = 'visapremiumdebit';

    const notification: NotificationTokenizationDTO = {
      createdAt: new Date(),
      environment: TokenizationCreatedDetailsNotificationRequest.EnvironmentEnum.Test,
      eventId: 'cbaf6264-ee31-40cd-8cd5-00a398cd46d0',
      type: TokenizationCreatedDetailsNotificationRequest.TypeEnum.RecurringTokenCreated,
      data: {
        merchantAccount: merchantReference,
        operation: 'operation text description',
        shopperReference: shopperReference,
        storedPaymentMethodId,
        type: methodType,
      },
    };

    jest.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
      merchantAccount: merchantReference,
      shopperReference,
      storedPaymentMethods: [
        {
          id: storedPaymentMethodId,
          type: 'scheme',
          lastFour: '1234',
          brand: 'visa',
          expiryMonth: '03',
          expiryYear: '30',
        },
      ],
    });

    jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
      enabled: true,
      config: {
        paymentInterface,
        interfaceAccount,
        supportedPaymentMethodTypes: {
          scheme: { oneOffPayments: true },
        },
      },
    });

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual({
      draft: {
        customerId: 'some-shopper-reference',
        interfaceAccount: 'adyen-interface-account',
        method: 'card',
        paymentInterface: 'adyen-payment-interface',
        token: 'abcdefg',
      },
    });
  });

  test('it should throw an "UnsupportedNotificationError" error if a unsupported notification is passed in', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const shopperReference = 'some-shopper-reference';
    const storedPaymentMethodId = 'abcdefg';
    const methodType = 'scheme';

    const notification: NotificationTokenizationDTO = {
      createdAt: new Date(),
      environment: TokenizationUpdatedDetailsNotificationRequest.EnvironmentEnum.Test,
      eventId: 'cbaf6264-ee31-40cd-8cd5-00a398cd46d0',
      type: TokenizationUpdatedDetailsNotificationRequest.TypeEnum.RecurringTokenUpdated,
      data: {
        merchantAccount: merchantReference,
        operation: 'operation text description',
        shopperReference: shopperReference,
        storedPaymentMethodId,
        type: methodType,
      },
    };

    // Act
    const result = converter.convert({ data: notification });

    // Assert
    expect(result).rejects.toThrow(
      new UnsupportedNotificationError({
        notificationEvent: TokenizationUpdatedDetailsNotificationRequest.TypeEnum.RecurringTokenUpdated,
      }),
    );
  });
});
