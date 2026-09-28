import { describe, test, expect } from '@jest/globals';
import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { NotificationDonationDTO } from '../../../src/dtos/adyen-donation.dto';
import { UnsupportedNotificationError } from '../../../src/errors/adyen-api.error';
import { NotificationDonationConverter } from '../../../src/services/converters/notification-donation.converter';

const buildNotification = (overrides: Partial<NotificationRequestItem> = {}): NotificationDonationDTO => ({
  live: 'false',
  notificationItems: [
    {
      NotificationRequestItem: {
        additionalData: {
          originalMerchantAccountCode: 'YOUR_MERCHANT_ACCOUNT',
        },
        amount: {
          currency: 'EUR',
          value: 500,
        },
        originalReference: 'V4HZ4RBFJGXXGN82',
        eventCode: NotificationRequestItem.EventCodeEnum.Donation,
        eventDate: '2022-07-07T13:18:13+02:00',
        merchantAccountCode: 'CHARITY_DONATION_ACCOUNT',
        merchantReference: 'payment-id',
        paymentMethod: 'visa',
        pspReference: 'Z58FGTKBRCQ2WN27',
        reason: '033899:1111:03/2030',
        success: NotificationRequestItem.SuccessEnum.True,
        ...overrides,
      } as NotificationRequestItem,
    },
  ],
});

describe('notification-donation.converter', () => {
  const converter = new NotificationDonationConverter();

  test('converts a successful donation notification', () => {
    const result = converter.convert({ data: buildNotification() });

    expect(result).toEqual({
      paymentId: 'payment-id',
      originalPspReference: 'V4HZ4RBFJGXXGN82',
      donationPspReference: 'Z58FGTKBRCQ2WN27',
      state: 'Success',
      amount: { centAmount: 500, currencyCode: 'EUR' },
    });
  });

  test('converts a failed donation notification', () => {
    const result = converter.convert({
      data: buildNotification({ success: NotificationRequestItem.SuccessEnum.False }),
    });

    expect(result.state).toBe('Failure');
  });

  test('corrects the amount of currencies whose Adyen exponent differs from the ISO one', () => {
    const result = converter.convert({
      data: buildNotification({ amount: { currency: 'ISK', value: 500 } }),
    });

    // Adyen reports ISK with 2 decimals, commercetools follows ISO 4217 and uses 0.
    expect(result.amount).toEqual({ centAmount: 5, currencyCode: 'ISK' });
  });

  test('rejects an event other than DONATION', () => {
    expect(() =>
      converter.convert({
        data: buildNotification({ eventCode: NotificationRequestItem.EventCodeEnum.Authorisation }),
      }),
    ).toThrow(UnsupportedNotificationError);
  });
});
