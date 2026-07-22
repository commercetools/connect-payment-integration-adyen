import { describe, test, expect, jest } from '@jest/globals';
import { NotificationConverter } from '../../../src/services/converters/notification.converter';
import { NotificationRequestDTO } from '../../../src/dtos/adyen-payment.dto';
import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { UnsupportedNotificationError } from '../../../src/errors/adyen-api.error';
import { paymentSDK } from '../../../src/payment-sdk';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { mockUpdatePaymentResult, mockGetPaymentResult } from '../../utils/mock-payment-data';
import * as Config from '../../../src/config/config';

interface FlexibleConfig {
  [key: string]: unknown; // Adjust the type according to your config values
}

function setupMockConfig(keysAndValues: FlexibleConfig) {
  const mockConfig: FlexibleConfig = {};
  Object.keys(keysAndValues).forEach((key) => {
    mockConfig[key] = keysAndValues[key];
  });

  jest.spyOn(Config, 'getConfig').mockReturnValue(mockConfig as any);
}

describe('notification.converter', () => {
  const converter = new NotificationConverter(paymentSDK.ctPaymentService);

  test('convert a successful card payment notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'Authorization',
            state: 'Success',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a successful ideal payment notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'ideal';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {},
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'Authorization',
            state: 'Success',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
          {
            type: 'Charge',
            state: 'Success',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a failure ideal payment notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'ideal';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {},
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.False,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'Authorization',
            state: 'Failure',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a expired payment notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.Expire,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'Authorization',
            state: 'Failure',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a successful card capture notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.Capture,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'Charge',
            state: 'Success',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a capture notification with success=false', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.Capture,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.False,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'Charge',
            state: 'Failure',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a failed card capture notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.CaptureFailed,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.False,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'Charge',
            state: 'Failure',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a successful card cancellation notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.Cancellation,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'CancelAuthorization',
            state: 'Success',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a failed card cancellation notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.Cancellation,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.False,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'CancelAuthorization',
            state: 'Failure',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a successful card refund notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.Refund,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'Refund',
            state: 'Success',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a failed card refund notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.Refund,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.False,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'Refund',
            state: 'Failure',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a refund failed notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.RefundFailed,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.False,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'Refund',
            state: 'Failure',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a chargeback notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.Chargeback,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'Chargeback',
            state: 'Success',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert an offer closed notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.OfferClosed,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'Authorization',
            state: 'Failure',
            amount: {
              currencyCode: 'EUR',
              centAmount: 10000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  test('convert a non supported event notification', async () => {
    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              expiryDate: '12/2012',
              authCode: '1234',
              cardSummary: '7777',
            },
            amount: {
              currency: 'EUR',
              value: 10000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.Donation,
            eventDate: '2024-06-17T11:37:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference,
            paymentMethod,
            pspReference,
            success: NotificationRequestItem.SuccessEnum.False,
          },
        },
      ],
    };

    // Act
    try {
      await converter.convert({ data: notification });
    } catch (error) {
      // Assert
      expect(error).toBeInstanceOf(UnsupportedNotificationError);
    }
  });
  test('convert a cancelORrefund event notification (where modification.action === refund)', async () => {
    jest
      .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
      .mockResolvedValue([mockUpdatePaymentResult]);

    jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);

    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              'modification.action': 'refund',
            },
            amount: {
              currency: 'EUR',
              value: 1000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.CancelOrRefund,
            eventDate: '2021-01-01T01:00:00+01:00',
            merchantAccountCode: 'YOUR_MERCHANT_ACCOUNT',
            merchantReference,
            originalReference: pspReference,
            paymentMethod,
            pspReference,
            reason: '',
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'CancelAuthorization',
            state: 'Failure',
            amount: {
              currencyCode: 'EUR',
              centAmount: 1000,
            },
            interactionId: pspReference,
          },
          {
            type: 'Refund',
            state: 'Success',
            amount: {
              currencyCode: 'EUR',
              centAmount: 1000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });
  test('convert a cancelORrefund event notification (where modification.action === cancel)', async () => {
    jest
      .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
      .mockResolvedValue([mockUpdatePaymentResult]);

    jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);

    // Arrange
    const merchantReference = 'some-merchant-reference';
    const pspReference = 'some-psp-reference';
    const paymentMethod = 'visa';
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              'modification.action': 'cancel',
            },
            amount: {
              currency: 'EUR',
              value: 1000,
            },
            eventCode: NotificationRequestItem.EventCodeEnum.CancelOrRefund,
            eventDate: '2021-01-01T01:00:00+01:00',
            merchantAccountCode: 'YOUR_MERCHANT_ACCOUNT',
            merchantReference,
            originalReference: pspReference,
            paymentMethod,
            pspReference,
            reason: '',
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    };

    // Act
    const result = await converter.convert({ data: notification });

    // Assert
    expect(result).toEqual([
      {
        merchantReference,
        pspReference,
        paymentMethod,
        transactions: [
          {
            type: 'CancelAuthorization',
            state: 'Success',
            amount: {
              currencyCode: 'EUR',
              centAmount: 1000,
            },
            interactionId: pspReference,
          },
        ],
      },
    ]);
  });

  describe('store payment method details via custom fields', () => {
    test("should not return custom fields if it's disabled", async () => {
      // Arrange
      setupMockConfig({ adyenStorePaymentMethodDetailsEnabled: false });

      const merchantReference = 'some-merchant-reference';
      const pspReference = 'some-psp-reference';
      const paymentMethod = 'visa';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                expiryDate: '12/2012',
                authCode: '1234',
                cardSummary: '7777',
                paymentMethod: 'visa',
              },
              amount: {
                currency: 'EUR',
                value: 10000,
              },
              eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              paymentMethod,
              pspReference,
              success: NotificationRequestItem.SuccessEnum.True,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert
      expect(result[0].paymentMethodInfoCustomField).toBeUndefined();
    });

    test('should not return custom fields if the Notification is not of type Authorisation', async () => {
      // Arrange
      setupMockConfig({ adyenStorePaymentMethodDetailsEnabled: true });

      const merchantReference = 'some-merchant-reference';
      const pspReference = 'some-psp-reference';
      const paymentMethod = 'visa';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                expiryDate: '12/2012',
                authCode: '1234',
                cardSummary: '7777',
                paymentMethod: 'visa',
              },
              amount: {
                currency: 'EUR',
                value: 10000,
              },
              eventCode: NotificationRequestItem.EventCodeEnum.Capture,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              paymentMethod,
              pspReference,
              success: NotificationRequestItem.SuccessEnum.True,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert
      expect(result[0].paymentMethodInfoCustomField).toBeUndefined();
    });

    test('should not return custom fields if the Notification is not of success attribute is set to false', async () => {
      // Arrange
      setupMockConfig({ adyenStorePaymentMethodDetailsEnabled: true });

      const merchantReference = 'some-merchant-reference';
      const pspReference = 'some-psp-reference';
      const paymentMethod = 'visa';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                expiryDate: '12/2012',
                authCode: '1234',
                cardSummary: '7777',
                paymentMethod: 'visa',
              },
              amount: {
                currency: 'EUR',
                value: 10000,
              },
              eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              paymentMethod,
              pspReference,
              success: NotificationRequestItem.SuccessEnum.False,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert
      expect(result[0].paymentMethodInfoCustomField).toBeUndefined();
    });

    test('should not return custom fields if the Notification.paymentMethod attribute is undefined', async () => {
      // Arrange
      setupMockConfig({ adyenStorePaymentMethodDetailsEnabled: true });

      const merchantReference = 'some-merchant-reference';
      const pspReference = 'some-psp-reference';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                expiryDate: '12/2012',
                authCode: '1234',
                cardSummary: '7777',
                paymentMethod: 'visa',
              },
              amount: {
                currency: 'EUR',
                value: 10000,
              },
              eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              pspReference,
              success: NotificationRequestItem.SuccessEnum.True,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert
      expect(result[0].paymentMethodInfoCustomField).toBeUndefined();
    });

    test('should not return custom fields provided Notification.paymentMethod attribute contains a value for which no mapping exists', async () => {
      // Arrange
      setupMockConfig({ adyenStorePaymentMethodDetailsEnabled: true });

      const merchantReference = 'some-merchant-reference';
      const pspReference = 'some-psp-reference';
      const paymentMethod = 'unknown-payment-method';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                expiryDate: '12/2012',
                authCode: '1234',
                cardSummary: '7777',
                paymentMethod: 'visa',
              },
              amount: {
                currency: 'EUR',
                value: 10000,
              },
              eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              paymentMethod,
              pspReference,
              success: NotificationRequestItem.SuccessEnum.True,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert
      expect(result[0].paymentMethodInfoCustomField).toBeUndefined();
    });

    test('convert a successful card payment notification which includes paymentMethodInfo custom fields', async () => {
      // Arrange
      setupMockConfig({ adyenStorePaymentMethodDetailsEnabled: true });

      const merchantReference = 'some-merchant-reference';
      const pspReference = 'some-psp-reference';
      const paymentMethod = 'visa';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                expiryDate: '12/2012',
                authCode: '1234',
                cardSummary: '7777',
                paymentMethod: 'visa',
              },
              amount: {
                currency: 'EUR',
                value: 10000,
              },
              eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              paymentMethod,
              pspReference,
              success: NotificationRequestItem.SuccessEnum.True,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert
      expect(result).toEqual([
        {
          merchantReference,
          pspReference,
          paymentMethod,
          transactions: [
            {
              type: 'Authorization',
              state: 'Success',
              amount: {
                currencyCode: 'EUR',
                centAmount: 10000,
              },
              interactionId: pspReference,
            },
          ],
          paymentMethodInfoCustomField: {
            fields: {
              brand: 'Visa',
              expiryMonth: 12,
              expiryYear: 2012,
              lastFour: '7777',
            },
            type: {
              key: 'commercetools-checkout-card-details',
              typeId: 'type',
            },
          },
        },
      ]);
    });
  });

  describe('ORDER_CLOSED event', () => {
    test('returns [] when success=true (silent ignore)', async () => {
      // Arrange
      const merchantReference = 'some-merchant-reference';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                'order-1-pspReference': 'some-psp',
                'order-1-paymentAmount': 'EUR 50.00',
              },
              amount: { currency: 'EUR', value: 5000 },
              eventCode: NotificationRequestItem.EventCodeEnum.OrderClosed,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              pspReference: 'ORDER_PSP',
              success: NotificationRequestItem.SuccessEnum.True,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert
      expect(result).toEqual([]);
    });

    test('returns Refund when success=false and CT payment has a successful Charge transaction', async () => {
      // Arrange
      const mockPaymentWithCharge = {
        ...mockUpdatePaymentResult,
        interfaceId: 'GIFT_CARD_PSP',
        transactions: [
          {
            type: 'Charge',
            state: 'Success',
            id: 'tx-1',
            amount: { centAmount: 5000, currencyCode: 'EUR' },
          },
        ],
      };

      jest
        .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
        .mockResolvedValue([mockPaymentWithCharge] as any);

      const merchantReference = 'some-merchant-reference';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                'order-1-pspReference': 'GIFT_CARD_PSP',
                'order-1-paymentAmount': 'EUR 50.00',
                'order-1-paymentMethod': 'givex',
                'order-1-success': NotificationRequestItem.SuccessEnum.True,
              },
              amount: { currency: 'EUR', value: 5000 },
              eventCode: NotificationRequestItem.EventCodeEnum.OrderClosed,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              pspReference: 'ORDER_PSP',
              success: NotificationRequestItem.SuccessEnum.False,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert
      expect(result).toEqual([
        {
          merchantReference,
          pspReference: 'GIFT_CARD_PSP',
          transactions: [
            {
              type: 'Refund',
              state: 'Success',
              amount: { centAmount: 5000, currencyCode: 'EUR' },
              interactionId: 'ORDER_PSP',
            },
          ],
        },
      ]);
    });

    test('returns CancelAuthorization when success=false and CT payment has only Authorization (no Charge)', async () => {
      // Arrange
      const mockPaymentWithAuthOnly = {
        ...mockUpdatePaymentResult,
        interfaceId: 'GIFT_CARD_PSP',
        transactions: [
          {
            type: 'Authorization',
            state: 'Success',
            id: 'tx-1',
            amount: { centAmount: 5000, currencyCode: 'EUR' },
          },
        ],
      };

      jest
        .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
        .mockResolvedValue([mockPaymentWithAuthOnly] as any);

      const merchantReference = 'some-merchant-reference';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                'order-1-pspReference': 'GIFT_CARD_PSP',
                'order-1-paymentAmount': 'EUR 50.00',
                'order-1-paymentMethod': 'givex',
                'order-1-success': NotificationRequestItem.SuccessEnum.True,
              },
              amount: { currency: 'EUR', value: 5000 },
              eventCode: NotificationRequestItem.EventCodeEnum.OrderClosed,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              pspReference: 'ORDER_PSP',
              success: NotificationRequestItem.SuccessEnum.False,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert
      expect(result).toEqual([
        {
          merchantReference,
          pspReference: 'GIFT_CARD_PSP',
          transactions: [
            {
              type: 'CancelAuthorization',
              state: 'Success',
              amount: { centAmount: 5000, currencyCode: 'EUR' },
              interactionId: 'ORDER_PSP',
            },
          ],
        },
      ]);
    });

    test('returns [] when success=false but CT payment is not found', async () => {
      // Arrange
      jest.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValue([]);

      const merchantReference = 'some-merchant-reference';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                'order-1-pspReference': 'UNKNOWN_PSP',
                'order-1-paymentAmount': 'EUR 50.00',
                'order-1-success': NotificationRequestItem.SuccessEnum.True,
              },
              amount: { currency: 'EUR', value: 5000 },
              eventCode: NotificationRequestItem.EventCodeEnum.OrderClosed,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              pspReference: 'ORDER_PSP',
              success: NotificationRequestItem.SuccessEnum.False,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert
      expect(result).toEqual([]);
    });

    test('skips a partial payment leg that was never approved (e.g. the card leg failed in a gift card + card split payment)', async () => {
      // Arrange: gift card leg succeeded, card leg never got approved and triggered the order cancellation.
      const mockGiftCardPaymentWithCharge = {
        ...mockUpdatePaymentResult,
        interfaceId: 'GIFT_CARD_PSP',
        transactions: [
          {
            type: 'Charge',
            state: 'Success',
            id: 'tx-1',
            amount: { centAmount: 3000, currencyCode: 'EUR' },
          },
        ],
      };

      const findPaymentsByInterfaceIdSpy = jest
        .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
        .mockResolvedValue([mockGiftCardPaymentWithCharge] as any);

      const merchantReference = 'some-merchant-reference';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                'order-1-pspReference': 'GIFT_CARD_PSP',
                'order-1-paymentAmount': 'EUR 30.00',
                'order-1-paymentMethod': 'givex',
                'order-1-success': NotificationRequestItem.SuccessEnum.True,
                'order-2-pspReference': 'CARD_PSP',
                'order-2-paymentAmount': 'EUR 20.00',
                'order-2-paymentMethod': 'visa',
                'order-2-success': NotificationRequestItem.SuccessEnum.False,
              },
              amount: { currency: 'EUR', value: 5000 },
              eventCode: NotificationRequestItem.EventCodeEnum.OrderClosed,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              pspReference: 'ORDER_PSP',
              success: NotificationRequestItem.SuccessEnum.False,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert: only the approved gift card leg is reversed; the never-approved card leg is skipped
      // and never even looked up in commercetools.
      expect(result).toEqual([
        {
          merchantReference,
          pspReference: 'GIFT_CARD_PSP',
          transactions: [
            {
              type: 'Refund',
              state: 'Success',
              amount: { centAmount: 3000, currencyCode: 'EUR' },
              interactionId: 'ORDER_PSP',
            },
          ],
        },
      ]);
      expect(findPaymentsByInterfaceIdSpy).toHaveBeenCalledWith({ interfaceId: 'GIFT_CARD_PSP' });
      expect(findPaymentsByInterfaceIdSpy).not.toHaveBeenCalledWith({ interfaceId: 'CARD_PSP' });
    });

    test('falls back to the CT payment transactions when order-N-success is absent (not enabled in Adyen) and skips a leg with only a Failure', async () => {
      // Arrange: same scenario as above, but the merchant account does not have order-N-success
      // enabled, so Adyen never sends the flag at all. The card leg only has a Failure transaction
      // recorded in commercetools — no approved/pending Charge or Authorization — so we should still
      // detect it was never approved and skip it.
      const mockGiftCardPaymentWithCharge = {
        ...mockUpdatePaymentResult,
        interfaceId: 'GIFT_CARD_PSP',
        transactions: [
          {
            type: 'Charge',
            state: 'Success',
            id: 'tx-1',
            amount: { centAmount: 3000, currencyCode: 'EUR' },
          },
        ],
      };
      const mockCardPaymentWithFailureOnly = {
        ...mockUpdatePaymentResult,
        interfaceId: 'CARD_PSP',
        transactions: [
          {
            type: 'Authorization',
            state: 'Failure',
            id: 'tx-2',
            amount: { centAmount: 2000, currencyCode: 'EUR' },
          },
        ],
      };

      jest
        .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
        .mockResolvedValueOnce([mockGiftCardPaymentWithCharge] as any)
        .mockResolvedValueOnce([mockCardPaymentWithFailureOnly] as any);

      const merchantReference = 'some-merchant-reference';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                'order-1-pspReference': 'GIFT_CARD_PSP',
                'order-1-paymentAmount': 'EUR 30.00',
                'order-1-paymentMethod': 'givex',
                // no order-1-success / order-2-success — not enabled on this merchant account
                'order-2-pspReference': 'CARD_PSP',
                'order-2-paymentAmount': 'EUR 20.00',
                'order-2-paymentMethod': 'visa',
              },
              amount: { currency: 'EUR', value: 5000 },
              eventCode: NotificationRequestItem.EventCodeEnum.OrderClosed,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              pspReference: 'ORDER_PSP',
              success: NotificationRequestItem.SuccessEnum.False,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert: only the gift card leg (which has an approved Charge) is reversed.
      expect(result).toEqual([
        {
          merchantReference,
          pspReference: 'GIFT_CARD_PSP',
          transactions: [
            {
              type: 'Refund',
              state: 'Success',
              amount: { centAmount: 3000, currencyCode: 'EUR' },
              interactionId: 'ORDER_PSP',
            },
          ],
        },
      ]);
    });

    test('falls back to treating the leg as approved when order-N-success is absent and the CT payment has no Charge/Authorization at all', async () => {
      // Arrange: no success flag, and no signal either way in commercetools (edge case) — defaults
      // to approved so we don't silently drop a leg that might actually need reversing.
      const mockPaymentWithNoAuthOrCharge = {
        ...mockUpdatePaymentResult,
        interfaceId: 'GIFT_CARD_PSP',
        transactions: [],
      };

      jest
        .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
        .mockResolvedValue([mockPaymentWithNoAuthOrCharge] as any);

      const merchantReference = 'some-merchant-reference';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                'order-1-pspReference': 'GIFT_CARD_PSP',
                'order-1-paymentAmount': 'EUR 30.00',
                'order-1-paymentMethod': 'givex',
              },
              amount: { currency: 'EUR', value: 3000 },
              eventCode: NotificationRequestItem.EventCodeEnum.OrderClosed,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              pspReference: 'ORDER_PSP',
              success: NotificationRequestItem.SuccessEnum.False,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert: defaults to CancelAuthorization (no successful Charge found) rather than skipping.
      expect(result).toEqual([
        {
          merchantReference,
          pspReference: 'GIFT_CARD_PSP',
          transactions: [
            {
              type: 'CancelAuthorization',
              state: 'Success',
              amount: { centAmount: 3000, currencyCode: 'EUR' },
              interactionId: 'ORDER_PSP',
            },
          ],
        },
      ]);
    });

    test('returns multiple NotificationUpdatePayment objects for multiple partial payments', async () => {
      // Arrange
      const mockPaymentWithCharge = {
        ...mockUpdatePaymentResult,
        interfaceId: 'GIFT_CARD_PSP_1',
        transactions: [
          {
            type: 'Charge',
            state: 'Success',
            id: 'tx-1',
            amount: { centAmount: 3000, currencyCode: 'EUR' },
          },
        ],
      };
      const mockPaymentWithAuthOnly = {
        ...mockUpdatePaymentResult,
        interfaceId: 'GIFT_CARD_PSP_2',
        transactions: [
          {
            type: 'Authorization',
            state: 'Success',
            id: 'tx-2',
            amount: { centAmount: 2000, currencyCode: 'EUR' },
          },
        ],
      };

      jest
        .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
        .mockResolvedValueOnce([mockPaymentWithCharge] as any)
        .mockResolvedValueOnce([mockPaymentWithAuthOnly] as any);

      const merchantReference = 'some-merchant-reference';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                'order-1-pspReference': 'GIFT_CARD_PSP_1',
                'order-1-paymentAmount': 'EUR 30.00',
                'order-1-paymentMethod': 'givex',
                'order-1-success': NotificationRequestItem.SuccessEnum.True,
                'order-2-pspReference': 'GIFT_CARD_PSP_2',
                'order-2-paymentAmount': 'EUR 20.00',
                'order-2-paymentMethod': 'givex',
                'order-2-success': NotificationRequestItem.SuccessEnum.True,
              },
              amount: { currency: 'EUR', value: 5000 },
              eventCode: NotificationRequestItem.EventCodeEnum.OrderClosed,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              pspReference: 'ORDER_PSP',
              success: NotificationRequestItem.SuccessEnum.False,
            },
          },
        ],
      };

      // Act
      const result = await converter.convert({ data: notification });

      // Assert
      expect(result).toEqual([
        {
          merchantReference,
          pspReference: 'GIFT_CARD_PSP_1',
          transactions: [
            {
              type: 'Refund',
              state: 'Success',
              amount: { centAmount: 3000, currencyCode: 'EUR' },
              interactionId: 'ORDER_PSP',
            },
          ],
        },
        {
          merchantReference,
          pspReference: 'GIFT_CARD_PSP_2',
          transactions: [
            {
              type: 'CancelAuthorization',
              state: 'Success',
              amount: { centAmount: 2000, currencyCode: 'EUR' },
              interactionId: 'ORDER_PSP',
            },
          ],
        },
      ]);
    });
  });
});
