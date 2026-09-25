import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Payment } from '@commercetools/connect-payments-sdk';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { DonationsApi } from '@adyen/api-library/lib/src/services/checkout/donationsApi';
import { Donation } from '@adyen/api-library/lib/src/typings/checkout/donation';
import { DonationCampaign } from '@adyen/api-library/lib/src/typings/checkout/donationCampaign';
import { DonationPaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/donationPaymentResponse';
import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import * as Config from '../../src/config/config';
import { AdyenDonationState, AdyenPaymentDetailsTypeKey } from '../../src/custom-types/adyen-payment-details';
import { MakeDonationRequestDTO, NotificationDonationDTO } from '../../src/dtos/adyen-donation.dto';
import { paymentSDK } from '../../src/payment-sdk';
import { AdyenDonationService } from '../../src/services/adyen-donation.service';
import { mockGetCartResultShippingModeSimple } from '../utils/mock-cart-data';
import { mockGetPaymentResult } from '../utils/mock-payment-data';

const paymentWithDonationToken = (fields: Record<string, unknown> = {}): Payment => ({
  ...mockGetPaymentResult,
  custom: {
    type: { typeId: 'type', id: 'custom-type-id' },
    fields: { adyenDonationToken: 'a-donation-token', ...fields },
  },
});

const PAID_CURRENCY = mockGetPaymentResult.amountPlanned.currencyCode;

/** `null` mocks a merchant account with no active campaign. */
const mockActiveCampaign = (campaign: DonationCampaign | null = { id: 'campaign-id' }): void => {
  jest
    .spyOn(DonationsApi.prototype, 'donationCampaigns')
    .mockResolvedValue({ donationCampaigns: campaign ? [campaign] : [] });
};

const donationNotification = (overrides: Partial<NotificationRequestItem> = {}): NotificationDonationDTO => ({
  live: 'false',
  notificationItems: [
    {
      NotificationRequestItem: {
        amount: { currency: PAID_CURRENCY, value: 500 },
        originalReference: mockGetPaymentResult.interfaceId as string,
        eventCode: NotificationRequestItem.EventCodeEnum.Donation,
        eventDate: '2022-07-07T13:18:13+02:00',
        merchantAccountCode: 'CHARITY_DONATION_ACCOUNT',
        merchantReference: mockGetPaymentResult.id,
        paymentMethod: 'visa',
        pspReference: 'Z58FGTKBRCQ2WN27',
        success: NotificationRequestItem.SuccessEnum.True,
        ...overrides,
      } as NotificationRequestItem,
    },
  ],
});

describe('adyen-donation.service', () => {
  const donationService = new AdyenDonationService({
    ctCartService: paymentSDK.ctCartService,
    ctPaymentService: paymentSDK.ctPaymentService,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(Config, 'getConfig').mockReturnValue({ adyenGivingEnabled: true } as any);
    jest.spyOn(paymentSDK.ctCustomTypeService, 'getById').mockResolvedValue({
      id: 'custom-type-id',
      version: 1,
      key: AdyenPaymentDetailsTypeKey,
      name: { en: 'Adyen payment details' },
      resourceTypeIds: ['payment'],
      fieldDefinitions: [],
      createdAt: '2024-02-13T00:00:00.000Z',
      lastModifiedAt: '2024-02-13T00:00:00.000Z',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getDonationConfig', () => {
    const activeCampaign: DonationCampaign = {
      id: 'campaign-id',
      campaignName: 'Save the bees',
      donation: { currency: PAID_CURRENCY, type: 'fixedAmounts', values: [100, 300, 500] } as Donation,
    };

    test('returns the client side configuration and the active campaign', async () => {
      // Arrange
      const payment = paymentWithDonationToken();
      mockActiveCampaign(activeCampaign);
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);

      // Act
      const result = await donationService.getDonationConfig({ paymentId: payment.id, data: {} });

      // Assert
      expect(result).toEqual({
        clientKey: expect.any(String),
        environment: expect.any(String),
        paymentReference: payment.id,
        // The paid amount is reported in Adyen minor units, so the component can price the roundup options.
        paidAmount: { currency: PAID_CURRENCY, value: payment.amountPlanned.centAmount },
        donationCampaign: activeCampaign,
      });
    });

    test('asks Adyen for the campaigns of the currency of the payment', async () => {
      // Arrange
      const payment = paymentWithDonationToken();
      mockActiveCampaign(activeCampaign);
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);

      // Act
      await donationService.getDonationConfig({ paymentId: payment.id, data: { locale: 'en-US' } });

      // Assert
      expect(DonationsApi.prototype.donationCampaigns).toHaveBeenCalledWith(
        expect.objectContaining({ currency: PAID_CURRENCY, locale: 'en-US' }),
      );
    });

    test('returns no campaign when the merchant account runs none', async () => {
      // Arrange
      const payment = paymentWithDonationToken();
      mockActiveCampaign(null);
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);

      // Act
      const result = await donationService.getDonationConfig({ paymentId: payment.id, data: {} });

      // Assert — the enabler is the one that decides not to render anything.
      expect(result.donationCampaign).toBeUndefined();
    });

    test('resolves the country code from the cart only when it is asked for', async () => {
      // Arrange
      const payment = paymentWithDonationToken();
      mockActiveCampaign(activeCampaign);
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      jest
        .spyOn(DefaultCartService.prototype, 'getCartByPaymentId')
        .mockResolvedValue(mockGetCartResultShippingModeSimple());

      // Act
      const withoutCountryCode = await donationService.getDonationConfig({ paymentId: payment.id, data: {} });
      const withCountryCode = await donationService.getDonationConfig({
        paymentId: payment.id,
        data: { withCountryCode: true },
      });

      // Assert
      expect(withoutCountryCode.countryCode).toBeUndefined();
      expect(DefaultCartService.prototype.getCartByPaymentId).toHaveBeenCalledTimes(1);
      expect(withCountryCode.countryCode).toBe('US');
    });

    test('rejects when Adyen Giving is not enabled', async () => {
      // Arrange
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(Config, 'getConfig').mockReturnValue({ adyenGivingEnabled: false } as any);
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment');

      // Act & Assert
      await expect(donationService.getDonationConfig({ paymentId: 'payment-id', data: {} })).rejects.toThrow(
        'Adyen Giving is not enabled',
      );
      expect(DefaultPaymentService.prototype.getPayment).not.toHaveBeenCalled();
    });

    test('rejects when the payment carries no donation token', async () => {
      // Arrange
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
      jest.spyOn(DonationsApi.prototype, 'donationCampaigns');

      // Act & Assert
      await expect(donationService.getDonationConfig({ paymentId: mockGetPaymentResult.id, data: {} })).rejects.toThrow(
        'it carries no donation token',
      );
      expect(DonationsApi.prototype.donationCampaigns).not.toHaveBeenCalled();
    });
  });

  describe('makeDonation', () => {
    const donationRequest = { donationCampaignId: 'campaign-id', amount: { currency: PAID_CURRENCY, value: 500 } };

    test('stores the donation result on the payment', async () => {
      // Arrange
      const payment = paymentWithDonationToken();
      mockActiveCampaign();
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(payment);
      jest.spyOn(DonationsApi.prototype, 'donations').mockResolvedValueOnce({
        id: 'donation-id',
        status: DonationPaymentResponse.StatusEnum.Completed,
        amount: { currency: PAID_CURRENCY, value: 500 },
      });

      // Act
      const result = await donationService.makeDonation({ paymentId: payment.id, data: donationRequest });

      // Assert
      expect(result).toEqual({ id: 'donation-id', status: DonationPaymentResponse.StatusEnum.Completed });
      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith({
        id: payment.id,
        customFieldValues: {
          adyenDonationState: 'Success',
          adyenDonationAmount: { centAmount: 500, currencyCode: PAID_CURRENCY },
        },
      });
    });

    test('does not fail the donation when the payment cannot be updated', async () => {
      // Arrange
      const payment = paymentWithDonationToken();
      mockActiveCampaign();
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      jest
        .spyOn(DefaultPaymentService.prototype, 'updatePayment')
        .mockRejectedValue(new Error('commercetools unavailable'));
      jest.spyOn(DonationsApi.prototype, 'donations').mockResolvedValueOnce({
        id: 'donation-id',
        status: DonationPaymentResponse.StatusEnum.Completed,
      });

      // Act & Assert
      await expect(donationService.makeDonation({ paymentId: payment.id, data: donationRequest })).resolves.toEqual({
        id: 'donation-id',
        status: DonationPaymentResponse.StatusEnum.Completed,
      });
    });

    test('keeps the state pending when Adyen has not settled the donation yet', async () => {
      // Arrange
      const payment = paymentWithDonationToken();
      mockActiveCampaign();
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(payment);
      jest.spyOn(DonationsApi.prototype, 'donations').mockResolvedValueOnce({
        id: 'donation-id',
        status: DonationPaymentResponse.StatusEnum.Pending,
      });

      // Act
      await donationService.makeDonation({ paymentId: payment.id, data: donationRequest });

      // Assert
      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          customFieldValues: expect.objectContaining({ adyenDonationState: 'Pending' }),
        }),
      );
    });

    test('does not overwrite an outcome the webhook reported while the donation was being charged', async () => {
      // Arrange
      const payment = paymentWithDonationToken({ adyenDonationState: 'Success' });
      mockActiveCampaign();
      // The payment is donatable when the request comes in, and the webhook lands before the result is stored.
      jest
        .spyOn(DefaultPaymentService.prototype, 'getPayment')
        .mockResolvedValueOnce(paymentWithDonationToken())
        .mockResolvedValue(payment);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(payment);
      jest.spyOn(DonationsApi.prototype, 'donations').mockResolvedValueOnce({
        id: 'donation-id',
        status: DonationPaymentResponse.StatusEnum.Pending,
      });

      // Act
      await donationService.makeDonation({ paymentId: payment.id, data: donationRequest });

      // Assert
      expect(DefaultPaymentService.prototype.updatePayment).not.toHaveBeenCalled();
    });

    test('does not downgrade a recorded success when the donation call reports a failure', async () => {
      // Arrange
      const payment = paymentWithDonationToken({ adyenDonationState: 'Success' });
      mockActiveCampaign();
      jest
        .spyOn(DefaultPaymentService.prototype, 'getPayment')
        .mockResolvedValueOnce(paymentWithDonationToken())
        .mockResolvedValue(payment);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(payment);
      jest.spyOn(DonationsApi.prototype, 'donations').mockResolvedValueOnce({
        id: 'donation-id',
        status: DonationPaymentResponse.StatusEnum.Refused,
      });

      // Act
      await donationService.makeDonation({ paymentId: payment.id, data: donationRequest });

      // Assert
      expect(DefaultPaymentService.prototype.updatePayment).not.toHaveBeenCalled();
    });

    test('settles a pending state with the outcome of the donation call', async () => {
      // Arrange
      const payment = paymentWithDonationToken({ adyenDonationState: 'Pending' });
      mockActiveCampaign();
      jest
        .spyOn(DefaultPaymentService.prototype, 'getPayment')
        .mockResolvedValueOnce(paymentWithDonationToken())
        .mockResolvedValue(payment);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(payment);
      jest.spyOn(DonationsApi.prototype, 'donations').mockResolvedValueOnce({
        id: 'donation-id',
        status: DonationPaymentResponse.StatusEnum.Refused,
      });

      // Act
      await donationService.makeDonation({ paymentId: payment.id, data: donationRequest });

      // Assert
      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          customFieldValues: expect.objectContaining({ adyenDonationState: 'Failure' }),
        }),
      );
    });

    describe('campaign and amount validation', () => {
      const activeCampaign: DonationCampaign = { id: 'campaign-id' };
      const roundupCampaign: DonationCampaign = {
        id: 'campaign-id',
        donation: { currency: PAID_CURRENCY, type: 'roundup', maxRoundupAmount: 99 } as Donation,
      };
      const fixedAmountsCampaign: DonationCampaign = {
        id: 'campaign-id',
        donation: { currency: PAID_CURRENCY, type: 'fixedAmounts', values: [100, 300, 500] } as Donation,
      };

      const completedDonation = { id: 'donation-id', status: DonationPaymentResponse.StatusEnum.Completed };

      /** `null` stands for a merchant account running no campaign at all. */
      const attemptDonation = (campaign: DonationCampaign | null, data: MakeDonationRequestDTO) => {
        const payment = paymentWithDonationToken();
        mockActiveCampaign(campaign);
        jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
        jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(payment);
        jest.spyOn(DonationsApi.prototype, 'donations').mockResolvedValueOnce(completedDonation);

        return donationService.makeDonation({ paymentId: payment.id, data });
      };

      const donationOf = (value: number, currency = PAID_CURRENCY): MakeDonationRequestDTO => ({
        ...donationRequest,
        amount: { currency, value },
      });

      const expectRejected = async (attempt: Promise<unknown>): Promise<void> => {
        await expect(attempt).rejects.toThrow('The donation is not allowed');
        expect(DonationsApi.prototype.donations).not.toHaveBeenCalled();
      };

      test('rejects the donation when there is no active campaign', async () => {
        await expectRejected(attemptDonation(null, donationRequest));
      });

      test('rejects the donation when the campaign is not the active one', async () => {
        await expectRejected(attemptDonation({ id: 'another-campaign-id' }, donationRequest));
      });

      test('rejects the donation when the currency does not match the payment', async () => {
        await expectRejected(attemptDonation(activeCampaign, donationOf(500, 'JPY')));
      });

      test('rejects the donation when the amount is zero', async () => {
        await expectRejected(attemptDonation(activeCampaign, donationOf(0)));
      });

      test('rejects the donation when the amount is negative', async () => {
        await expectRejected(attemptDonation(activeCampaign, donationOf(-500)));
      });

      test('rejects the donation when the amount exceeds the maximum roundup amount of the campaign', async () => {
        await expectRejected(attemptDonation(roundupCampaign, donationOf(100)));
      });

      test('rejects the donation when the amount is not one of the fixed amounts of the campaign', async () => {
        await expectRejected(attemptDonation(fixedAmountsCampaign, donationOf(400)));
      });

      test('charges a roundup amount within the maximum of the campaign', async () => {
        await expect(attemptDonation(roundupCampaign, donationOf(99))).resolves.toEqual(completedDonation);
      });

      test('charges one of the fixed amounts of the campaign', async () => {
        await expect(attemptDonation(fixedAmountsCampaign, donationOf(300))).resolves.toEqual(completedDonation);
      });
    });
  });

  describe('a payment whose donation was already charged', () => {
    const donationRequest = { donationCampaignId: 'campaign-id', amount: { currency: PAID_CURRENCY, value: 500 } };

    /** Asserts that no campaign is offered for a payment in the given donation state. */
    const expectNoCampaignOffered = async (donationState: AdyenDonationState): Promise<void> => {
      const payment = paymentWithDonationToken({ adyenDonationState: donationState });
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      jest.spyOn(DonationsApi.prototype, 'donationCampaigns');

      await expect(donationService.getDonationConfig({ paymentId: payment.id, data: {} })).rejects.toThrow(
        'a donation has already been charged against it',
      );
      expect(DonationsApi.prototype.donationCampaigns).not.toHaveBeenCalled();
    };

    /** Asserts that a payment in the given donation state cannot be charged a second donation. */
    const expectNotDonatable = async (donationState: AdyenDonationState): Promise<void> => {
      const payment = paymentWithDonationToken({ adyenDonationState: donationState });
      mockActiveCampaign();
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      jest.spyOn(DonationsApi.prototype, 'donations');

      await expect(donationService.makeDonation({ paymentId: payment.id, data: donationRequest })).rejects.toThrow(
        'a donation has already been charged against it',
      );
      expect(DonationsApi.prototype.donations).not.toHaveBeenCalled();
    };

    test('is offered no campaign when the donation succeeded', async () => {
      await expectNoCampaignOffered('Success');
    });

    test('is offered no campaign when the donation is still pending', async () => {
      await expectNoCampaignOffered('Pending');
    });

    test('cannot be donated to again when the donation succeeded', async () => {
      await expectNotDonatable('Success');
    });

    test('cannot be donated to again when the donation is still pending', async () => {
      await expectNotDonatable('Pending');
    });

    test('can be donated to again when the previous donation failed, since nothing was charged', async () => {
      // Arrange
      const payment = paymentWithDonationToken({ adyenDonationState: 'Failure' });
      mockActiveCampaign();
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(payment);
      jest.spyOn(DonationsApi.prototype, 'donations').mockResolvedValueOnce({
        id: 'donation-id',
        status: DonationPaymentResponse.StatusEnum.Completed,
      });

      // Act & Assert
      await expect(donationService.makeDonation({ paymentId: payment.id, data: donationRequest })).resolves.toEqual({
        id: 'donation-id',
        status: DonationPaymentResponse.StatusEnum.Completed,
      });
    });
  });

  describe('processNotification', () => {
    test('stores the outcome of the donation on the funding payment', async () => {
      // Arrange
      const payment = paymentWithDonationToken({ adyenDonationState: 'Pending' });
      jest.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValueOnce([payment]);
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(payment);

      // Act
      await donationService.processNotification({ data: donationNotification() });

      // Assert
      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith({
        id: payment.id,
        customFieldValues: {
          adyenDonationState: 'Success',
          adyenDonationAmount: { centAmount: 500, currencyCode: PAID_CURRENCY },
        },
      });
    });

    test('falls back to the merchant reference when the funding payment has no matching interface id', async () => {
      // Arrange
      const payment = paymentWithDonationToken();
      jest.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValueOnce([]);
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(payment);

      // Act
      await donationService.processNotification({
        data: donationNotification({ success: NotificationRequestItem.SuccessEnum.False }),
      });

      // Assert
      expect(DefaultPaymentService.prototype.getPayment).toHaveBeenCalledWith({ id: payment.id });
      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          customFieldValues: expect.objectContaining({ adyenDonationState: 'Failure' }),
        }),
      );
    });

    test('does not downgrade a recorded success when a late webhook reports a failure', async () => {
      // Arrange
      const payment = paymentWithDonationToken({ adyenDonationState: 'Success' });
      jest.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValueOnce([payment]);
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(payment);

      // Act
      await donationService.processNotification({
        data: donationNotification({ success: NotificationRequestItem.SuccessEnum.False }),
      });

      // Assert
      expect(DefaultPaymentService.prototype.updatePayment).not.toHaveBeenCalled();
    });

    test('propagates a failure to update the payment so that Adyen retries the webhook', async () => {
      // Arrange
      const payment = paymentWithDonationToken();
      jest.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValueOnce([payment]);
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      jest
        .spyOn(DefaultPaymentService.prototype, 'updatePayment')
        .mockRejectedValue(new Error('commercetools unavailable'));

      // Act & Assert
      await expect(donationService.processNotification({ data: donationNotification() })).rejects.toThrow(
        'commercetools unavailable',
      );
    });

    test('accepts and ignores an event other than DONATION', async () => {
      // Arrange
      jest.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId');
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment');

      // Act
      await donationService.processNotification({
        data: donationNotification({ eventCode: NotificationRequestItem.EventCodeEnum.Authorisation }),
      });

      // Assert
      expect(DefaultPaymentService.prototype.findPaymentsByInterfaceId).not.toHaveBeenCalled();
      expect(DefaultPaymentService.prototype.updatePayment).not.toHaveBeenCalled();
    });
  });
});
