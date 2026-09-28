import "@adyen-css";
import { AdyenCheckout, AdyenCheckoutError } from "@adyen/adyen-web";
import { convertToAdyenLocale } from "../converters/locale.converter";
import { ProcessorApiClient } from "../api/processor-api.client";
import { DonationBuilder } from "./donation";
import {
  DonationBaseOptions,
  DonationComponentBuilder,
  DonationEnabler,
  DonationEnablerOptions,
} from "./donation-enabler";
import { DonationError, DonationErrorCode, toDonationError } from "./donation-error";

export class AdyenDonationEnabler implements DonationEnabler {
  private initOptions: DonationEnablerOptions;
  private apiClient: ProcessorApiClient;
  private paymentReference?: string;
  private donationBaseOptions: Promise<DonationBaseOptions> | null = null;

  constructor(options: DonationEnablerOptions) {
    this.initOptions = options;
    this.apiClient = new ProcessorApiClient({
      processorUrl: options.processorUrl,
      sessionId: options.sessionId,
    });
  }

  async createDonationBuilder(): Promise<DonationComponentBuilder> {
    if (!this.donationBaseOptions) {
      this.donationBaseOptions = this.init();
    }

    return new DonationBuilder(await this.donationBaseOptions);
  }

  private async init(): Promise<DonationBaseOptions> {
    const adyenLocale = convertToAdyenLocale(this.initOptions.locale || "en-US");

    let configJson: Awaited<ReturnType<ProcessorApiClient["getDonationConfig"]>>;
    try {
      configJson = await this.apiClient.getDonationConfig({
        locale: adyenLocale,
        withCountryCode: !this.initOptions.countryCode,
      });
    } catch (e) {
      const error = toDonationError(e, DonationErrorCode.InitializationFailed);
      console.error(error.code, error);
      throw error;
    }

    this.paymentReference = configJson.paymentReference;

    if (!configJson.donationCampaign) {
      throw new DonationError(
        DonationErrorCode.NoActiveCampaign,
        "There is no active donation campaign for this payment",
      );
    }

    if (!configJson.paidAmount || !configJson.paymentReference) {
      throw new DonationError(
        DonationErrorCode.InitializationFailed,
        "The donation configuration carries no paid amount or payment reference",
      );
    }

    const countryCode = this.initOptions.countryCode ?? configJson.countryCode;

    let adyenCheckout: Awaited<ReturnType<typeof AdyenCheckout>>;
    try {
      adyenCheckout = await AdyenCheckout({
        onError: (error: AdyenCheckoutError) => this.handleError(error),
        analytics: { enabled: true },
        locale: adyenLocale,
        environment: configJson.environment,
        clientKey: configJson.clientKey,
        countryCode,
      });
    } catch (e) {
      const error = toDonationError(e, DonationErrorCode.InitializationFailed);
      console.error(error.code, error);
      throw error;
    }

    return {
      adyenCheckout,
      sessionId: this.initOptions.sessionId,
      processorUrl: this.initOptions.processorUrl,
      countryCode,
      donationCampaign: configJson.donationCampaign,
      paidAmount: configJson.paidAmount,
      paymentReference: configJson.paymentReference,
      onComplete: this.initOptions.onComplete,
      reportError: (reason: unknown) => this.handleError(reason),
    };
  }

  /**
   * Single exit for everything that fails once the form is on screen, both what the Adyen core reports and
   * what the donation component catches itself.
   */
  private handleError(reason: unknown): void {
    const error = toDonationError(reason);
    console.error(error.code, error);
    this.initOptions.onError?.(error, { paymentReference: this.paymentReference });
  }
}
