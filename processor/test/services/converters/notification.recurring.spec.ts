import { TokenizationCreatedDetailsNotificationRequest } from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/tokenizationCreatedDetailsNotificationRequest';
import { TokenizationAlreadyExistingDetailsNotificationRequest } from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/tokenizationAlreadyExistingDetailsNotificationRequest';

import { NotificationTokenizationDTO } from '../../../src/dtos/adyen-payment.dto';
import * as SavedPaymentsConfig from '../../../src/config/saved-payment-method.config';

import { NotificationTokenizationConverter } from '../../../src/services/converters/notification-recurring.converter';
import { UnsupportedNotificationError } from '../../../src/errors/adyen-api.error';

// TODO: SCC-3447: update unit-tests in accordance with the AdyenAPI integration calls.
describe('notification.tokenization.converter', () => {
  const converter = new NotificationTokenizationConverter();

  test('it should convert a notification of type "recurring.token.created"', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const shopperReference = 'some-shopper-reference';
    const storedPaymentMethodId = 'abcdefg';
    const paymentInterface = 'adyen-payment-interface';
    const interfaceAccount = 'adyen-interface-account';
    const methodType = 'scheme';

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

    jest.spyOn(SavedPaymentsConfig, 'getSavedPaymentsConfig').mockReturnValue({
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
        method: 'scheme',
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
      environment: TokenizationAlreadyExistingDetailsNotificationRequest.EnvironmentEnum.Test,
      eventId: 'cbaf6264-ee31-40cd-8cd5-00a398cd46d0',
      type: TokenizationAlreadyExistingDetailsNotificationRequest.TypeEnum.RecurringTokenAlreadyExisting,
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
        notificationEvent: TokenizationAlreadyExistingDetailsNotificationRequest.TypeEnum.RecurringTokenAlreadyExisting,
      }),
    );
  });
});
