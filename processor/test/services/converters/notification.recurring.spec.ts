import { describe, expect, jest, test } from '@jest/globals';
import {
  TokenizationCreatedDetailsNotificationRequest,
  TokenizationUpdatedDetailsNotificationRequest,
} from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/models';

import { NotificationTokenizationDTO } from '../../../src/dtos/adyen-payment.dto';
import * as StoredPaymentMethodsConfig from '../../../src/config/stored-payment-methods.config';

import { NotificationTokenizationConverter } from '../../../src/services/converters/notification-recurring.converter';
import { UnsupportedNotificationError } from '../../../src/errors/adyen-api.error';
import { RecurringApi } from '@adyen/api-library/lib/src/services/checkout/recurringApi';
import * as Config from '../../../src/config/config';

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
          scheme: { oneOffPayments: true, recurringPayments: true },
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

  test('it should include SEPA-shaped custom fields (IBAN last-four) for an iDEAL-originated token', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const shopperReference = 'some-shopper-reference';
    const storedPaymentMethodId = 'G3W3X4J43Z828DV5';
    const paymentInterface = 'adyen-payment-interface';
    const interfaceAccount = 'adyen-interface-account';

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
        type: 'ideal',
      },
    };

    // Real shape of an iDEAL stored payment method resource from Adyen: `type` and `brand` both
    // stay "ideal", but it carries iban/ownerName since it's backed by a SEPA Direct Debit mandate.
    jest.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
      merchantAccount: merchantReference,
      shopperReference,
      storedPaymentMethods: [
        {
          id: storedPaymentMethodId,
          type: 'ideal',
          brand: 'ideal',
          iban: 'NL44RABO0123456789',
          ownerName: 'Pino the Bird',
        },
      ],
    });

    jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
      enabled: true,
      config: {
        paymentInterface,
        interfaceAccount,
        supportedPaymentMethodTypes: {
          ideal: { oneOffPayments: false, recurringPayments: true },
        },
      },
    });

    jest.spyOn(Config, 'getConfig').mockReturnValue({
      adyenMerchantAccount: merchantReference,
      adyenStorePaymentMethodDetailsEnabled: true,
    } as any);

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual({
      draft: {
        customerId: shopperReference,
        interfaceAccount,
        method: 'ideal',
        paymentInterface,
        token: storedPaymentMethodId,
        customFields: {
          type: { key: 'commercetools-checkout-sepa-details', typeId: 'type' },
          fields: {
            lastFour: '6789',
          },
        },
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
