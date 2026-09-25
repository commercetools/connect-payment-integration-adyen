import { DonationCampaign } from '@adyen/api-library/lib/src/typings/checkout/donationCampaign';
import { DonationPaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/donationPaymentResponse';
import { Notification } from '@adyen/api-library/lib/src/typings/notification/notification';

export type DonationAmountDTO = {
  value: number;
  currency: string;
};

export type GetDonationConfigRequestDTO = {
  locale?: string;
  withCountryCode?: boolean;
};

export type GetDonationConfigResponseDTO = {
  clientKey: string;
  environment: string;
  countryCode?: string;
  /** Id of the payment the donation is charged against. */
  paymentReference: string;
  /** Amount of the original payment, in Adyen minor units. */
  paidAmount: DonationAmountDTO;
  /** A merchant account can have at most one active campaign. */
  donationCampaign?: DonationCampaign;
};

export type MakeDonationRequestDTO = {
  donationCampaignId: string;
  amount: DonationAmountDTO;
};

export type MakeDonationResponseDTO = {
  status?: DonationPaymentResponse.StatusEnum;
  id?: string;
};

export type NotificationDonationDTO = Notification;
