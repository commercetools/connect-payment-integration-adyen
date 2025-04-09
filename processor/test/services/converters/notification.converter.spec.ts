import { describe, test, expect, jest } from '@jest/globals';
import { NotificationConverter } from '../../../src/services/converters/notification.converter';
import { NotificationRequestDTO } from '../../../src/dtos/adyen-payment.dto';
import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { UnsupportedNotificationError } from '../../../src/errors/adyen-api.error';
import { paymentSDK } from '../../../src/payment-sdk';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { mockUpdatePaymentResult, mockGetPaymentResult } from '../../utils/mock-payment-data';

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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
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
    expect(result).toEqual({
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
    });
  });
});
