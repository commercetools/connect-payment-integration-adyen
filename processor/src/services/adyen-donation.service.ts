import {
  CommercetoolsCartService,
  CommercetoolsPaymentService,
  CustomFieldsDraft,
  Errorx,
  CurrencyConverters,
  Money,
  Payment,
} from '@commercetools/connect-payments-sdk';
import { DonationCampaign } from '@adyen/api-library/lib/src/typings/checkout/donationCampaign';
import { DonationPaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/donationPaymentResponse';
import { AdyenApi, wrapAdyenError } from '../clients/adyen.client';
import { getConfig } from '../config/config';
import { CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING } from '../constants/currencies';
import { AdyenDonationState } from '../custom-types/adyen-payment-details';
import {
  MakeDonationRequestDTO,
  MakeDonationResponseDTO,
  GetDonationConfigRequestDTO,
  GetDonationConfigResponseDTO,
  NotificationDonationDTO,
} from '../dtos/adyen-donation.dto';
import { UnsupportedNotificationError } from '../errors/adyen-api.error';
import { DonationNotAllowedError, DonationNotEnabledError, PaymentNotEligibleError } from '../errors/donation.error';
import { log } from '../libs/logger';
import { MakeDonationConverter } from './converters/make-donation.converter';
import { DonationCampaignsConverter } from './converters/donation-campaigns.converter';
import {
  DonationNotificationUpdate,
  NotificationDonationConverter,
} from './converters/notification-donation.converter';
import {
  buildAdyenPaymentCustomFields,
  buildInterfaceInteraction,
  getAdyenPaymentCustomFields,
} from './helper.service';

const DONATION_STATUS_TO_STATE: Record<DonationPaymentResponse.StatusEnum, AdyenDonationState> = {
  [DonationPaymentResponse.StatusEnum.Completed]: 'Success',
  [DonationPaymentResponse.StatusEnum.Pending]: 'Pending',
  [DonationPaymentResponse.StatusEnum.Refused]: 'Failure',
};

export type AdyenDonationServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
};

/**
 * Adyen Giving (donations) service.
 */
export class AdyenDonationService {
  private ctPaymentService: CommercetoolsPaymentService;
  private donationCampaignsConverter: DonationCampaignsConverter;
  private makeDonationConverter: MakeDonationConverter;
  private notificationDonationConverter: NotificationDonationConverter;

  constructor(opts: AdyenDonationServiceOptions) {
    this.ctPaymentService = opts.ctPaymentService;
    this.donationCampaignsConverter = new DonationCampaignsConverter(opts.ctCartService);
    this.makeDonationConverter = new MakeDonationConverter();
    this.notificationDonationConverter = new NotificationDonationConverter();
  }

  public async getDonationConfig(opts: {
    paymentId: string;
    data: GetDonationConfigRequestDTO;
  }): Promise<GetDonationConfigResponseDTO> {
    this.assertAdyenGivingEnabled();

    const payment = await this.ctPaymentService.getPayment({ id: opts.paymentId });

    this.assertDonatable(payment);

    const donationCampaign = await this.getActiveCampaign({ payment, data: opts.data });

    return this.donationCampaignsConverter.convertResponse({ donationCampaign, data: opts.data, payment });
  }

  public async makeDonation(opts: {
    paymentId: string;
    data: MakeDonationRequestDTO;
  }): Promise<MakeDonationResponseDTO> {
    this.assertAdyenGivingEnabled();

    const payment = await this.ctPaymentService.getPayment({ id: opts.paymentId });
    this.assertDonatable(payment);

    const donationCampaign = await this.getActiveCampaign({ payment });
    this.assertDonationAllowed({ donationCampaign, data: opts.data, payment });

    const request = this.makeDonationConverter.convertRequest({ data: opts.data, payment });

    let response;
    try {
      response = await AdyenApi().DonationsApi.donations(request);
    } catch (e) {
      throw wrapAdyenError(e);
    }

    log.info('Donation processed.', {
      paymentId: payment.id,
      donationCampaignId: opts.data.donationCampaignId,
      donationId: response.id,
      status: response.status,
    });

    try {
      await this.storeDonationResult(
        payment.id,
        this.toDonationResult({ response, data: opts.data }),
        buildInterfaceInteraction('MakeDonation', request, response),
      );
    } catch (e) {
      // Best effort: the donation has already been charged, so this must not fail the shopper's request.
      // The DONATION webhook reports the same outcome and settles the payment anyway.
      log.error('Error storing the donation result on the payment', { error: e, paymentId: payment.id });
    }

    return this.makeDonationConverter.convertResponse({ response });
  }

  /**
   * Handles the `DONATION` webhook, which reports the final outcome of a donation charged through
   * {@link makeDonation}. Any other event is accepted and ignored.
   */
  public async processNotification(opts: { data: NotificationDonationDTO }): Promise<void> {
    log.info('Processing donation notification', { notification: JSON.stringify(opts.data) });

    let update: DonationNotificationUpdate;
    try {
      update = this.notificationDonationConverter.convert(opts);

      const payment = await this.getPaymentFromDonationNotification(update);
      await this.storeDonationResult(
        payment.id,
        { state: update.state, amount: update.amount },
        buildInterfaceInteraction('DonationNotification', opts.data, undefined),
      );
    } catch (e) {
      if (e instanceof UnsupportedNotificationError) {
        log.info('Unsupported donation notification received', { notification: JSON.stringify(opts.data) });
        return;
      } else if (e instanceof Errorx && e.code === 'ResourceNotFound') {
        log.info('Payment not found hence accepting the donation notification', {
          notification: JSON.stringify(opts.data),
        });
        return;
      }

      log.error('Error processing donation notification', { error: e });
      throw e;
    }
  }

  /**
   * The outcome of a donation call, as it is recorded on the commercetools payment. An unknown or missing
   * status is treated as `Pending`: the DONATION webhook is what settles it.
   */
  private toDonationResult(opts: { response: DonationPaymentResponse; data: MakeDonationRequestDTO }): {
    state: AdyenDonationState;
    amount: Money;
  } {
    const amount = opts.response.amount ?? opts.data.amount;

    return {
      state: (opts.response.status && DONATION_STATUS_TO_STATE[opts.response.status]) ?? 'Pending',
      amount: {
        centAmount: CurrencyConverters.convertWithMapping({
          mapping: CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING,
          amount: amount.value as number,
          currencyCode: amount.currency as string,
        }),
        currencyCode: amount.currency as string,
      },
    };
  }

  /** A merchant account can only take part in one active campaign at a time, for the currency of the payment. */
  private async getActiveCampaign(opts: {
    payment: Payment;
    data?: GetDonationConfigRequestDTO;
  }): Promise<DonationCampaign | undefined> {
    const request = this.donationCampaignsConverter.convertRequest({ data: opts.data ?? {}, payment: opts.payment });

    try {
      const response = await AdyenApi().DonationsApi.donationCampaigns(request);
      return response.donationCampaigns?.[0];
    } catch (e) {
      throw wrapAdyenError(e);
    }
  }

  private assertDonationAllowed(opts: {
    donationCampaign: DonationCampaign | undefined;
    data: MakeDonationRequestDTO;
    payment: Payment;
  }): void {
    const { donationCampaign, data, payment } = opts;

    if (!donationCampaign?.id) {
      throw new DonationNotAllowedError('there is no active donation campaign', {
        privateFields: { paymentId: payment.id },
      });
    }

    if (data.donationCampaignId !== donationCampaign.id) {
      throw new DonationNotAllowedError('the campaign is not the active one', {
        privateFields: { paymentId: payment.id, donationCampaignId: data.donationCampaignId },
      });
    }

    if (!data.amount || data.amount.currency !== payment.amountPlanned.currencyCode) {
      throw new DonationNotAllowedError('the currency does not match the currency of the payment', {
        privateFields: { paymentId: payment.id },
      });
    }

    if (!Number.isInteger(data.amount.value) || data.amount.value <= 0) {
      throw new DonationNotAllowedError('the amount must be a positive whole number of minor units', {
        privateFields: { paymentId: payment.id },
      });
    }

    const { donation } = donationCampaign;
    const amountValue = data.amount.value;

    if (donation?.type === 'fixedAmounts' && donation.values?.length && !donation.values.includes(amountValue)) {
      throw new DonationNotAllowedError('the amount is not one of the amounts of the campaign', {
        privateFields: { paymentId: payment.id, amount: amountValue },
      });
    }

    if (
      donation?.type === 'roundup' &&
      donation.maxRoundupAmount !== undefined &&
      amountValue > donation.maxRoundupAmount
    ) {
      throw new DonationNotAllowedError('the amount exceeds the maximum roundup amount of the campaign', {
        privateFields: { paymentId: payment.id, amount: amountValue },
      });
    }
  }

  private async getPaymentFromDonationNotification(data: DonationNotificationUpdate): Promise<Payment> {
    const interfaceId = data.originalPspReference;
    let payment!: Payment;

    if (interfaceId) {
      const results = await this.ctPaymentService.findPaymentsByInterfaceId({
        interfaceId,
      });

      if (results.length > 0) {
        payment = results[0];
      }
    }

    if (!payment) {
      return await this.ctPaymentService.getPayment({
        id: data.paymentId,
      });
    }

    return payment;
  }

  /**
   * Records the outcome of a donation on the funding payment. Both the donation call and the `DONATION` webhook
   * report the same outcome, so whichever arrives last simply rewrites the same values — except that an outcome
   * is only ever replaced by a more settled one, so a slow report cannot undo what is already recorded.
   */
  private async storeDonationResult(
    paymentId: string,
    result: { state: AdyenDonationState; amount: Money },
    pspInteractions?: CustomFieldsDraft[],
  ): Promise<void> {
    // Re-read: the webhook and the donation call race each other, so the result is compared against what is
    // currently stored rather than against what the caller last saw.
    const payment = await this.ctPaymentService.getPayment({ id: paymentId });
    const currentState = getAdyenPaymentCustomFields(payment).adyenDonationState;

    // Ordering guard: a `Pending` result never overwrites an outcome already settled, and a recorded `Success`
    // is never downgraded — the money has been charged, so a late `Failure` report is the stale one.
    // Best effort only: commercetools offers no compare-and-set here, so two writers that read before either
    // of them writes can still settle out of order. Only the two donation fields are written, so a lost update
    // costs the recorded state, never the donation token or the order data.
    const isStaleResult =
      (result.state === 'Pending' && currentState !== undefined && currentState !== 'Pending') ||
      (currentState === 'Success' && result.state !== 'Success');

    if (isStaleResult) {
      log.info('Donation result already settled, skipping the update.', {
        paymentId,
        currentState,
        state: result.state,
      });

      // The exchange with Adyen is still worth recording; with nothing to record there is nothing left to do.
      if (!pspInteractions) {
        return;
      }
    }

    // A stale result leaves the fields untouched, and only adds the interaction.
    const customFields = isStaleResult
      ? {}
      : await buildAdyenPaymentCustomFields(payment, {
          adyenDonationAmount: result.amount,
          adyenDonationState: result.state,
        });

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: payment.id,
      ...customFields,
      pspInteractions,
    });

    if (!isStaleResult) {
      log.info('Donation result stored on the payment.', {
        paymentId: updatedPayment.id,
        version: updatedPayment.version,
        donationState: result.state,
      });
    }
  }

  private assertAdyenGivingEnabled(): void {
    if (!getConfig().adyenGivingEnabled) {
      throw new DonationNotEnabledError();
    }
  }

  private assertDonatable(payment: Payment): void {
    const { adyenDonationToken, adyenDonationState } = getAdyenPaymentCustomFields(payment);

    if (!adyenDonationToken || !payment.interfaceId) {
      throw new PaymentNotEligibleError('it carries no donation token', {
        privateFields: { paymentId: payment.id },
      });
    }

    if (adyenDonationState === 'Success' || adyenDonationState === 'Pending') {
      throw new PaymentNotEligibleError('a donation has already been charged against it', {
        privateFields: { paymentId: payment.id, donationState: adyenDonationState },
      });
    }
  }
}
