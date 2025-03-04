import { describe, test, expect } from '@jest/globals';
import { NotificationConverter } from '../../../src/services/converters/notification.converter';
import { NotificationRequestDTO } from '../../../src/dtos/adyen-payment.dto';
import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { UnsupportedNotificationError } from '../../../src/errors/adyen-api.error';

describe('notification.converter', () => {
  const converter = new NotificationConverter();

  test('convert a successful card payment notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert a successful ideal payment notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert a failure ideal payment notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert a expired payment notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert a successful card capture notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert a failed card capture notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert a successful card cancellation notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert a failed card cancellation notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert a successful card refund notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert a failed card refund notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert a refund failed notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert a chargeback notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert an offer closed notification', () => {
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
    const result = converter.convert({ data: notification });

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

  test('convert a non supported event notification', () => {
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
      converter.convert({ data: notification });
    } catch (error) {
      // Assert
      expect(error).toBeInstanceOf(UnsupportedNotificationError);
    }
  });
});
