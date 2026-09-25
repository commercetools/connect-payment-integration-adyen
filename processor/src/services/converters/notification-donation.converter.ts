import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { CurrencyConverters, Money } from '@commercetools/connect-payments-sdk';
import { CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING } from '../../constants/currencies';
import { AdyenDonationState } from '../../custom-types/adyen-payment-details';
import { NotificationDonationDTO } from '../../dtos/adyen-donation.dto';
import { UnsupportedNotificationError } from '../../errors/adyen-api.error';

export type DonationNotificationUpdate = {
  paymentId: string;
  originalPspReference?: string;
  donationPspReference: string;
  state: AdyenDonationState;
  amount: Money;
};

export class NotificationDonationConverter {
  public convert(opts: { data: NotificationDonationDTO }): DonationNotificationUpdate {
    const item = opts.data.notificationItems[0].NotificationRequestItem;

    if (item.eventCode !== NotificationRequestItem.EventCodeEnum.Donation) {
      throw new UnsupportedNotificationError({ notificationEvent: item.eventCode.toString() });
    }

    return {
      paymentId: item.merchantReference,
      originalPspReference: item.originalReference,
      donationPspReference: item.pspReference,
      state: item.success === NotificationRequestItem.SuccessEnum.True ? 'Success' : 'Failure',
      amount: {
        centAmount: CurrencyConverters.convertWithMapping({
          mapping: CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING,
          amount: item.amount.value as number,
          currencyCode: item.amount.currency as string,
        }),
        currencyCode: item.amount.currency as string,
      },
    };
  }
}
