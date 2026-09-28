import { Donation, DonationCampaign, DonationProps, ICore } from "@adyen/adyen-web";
import {
  DonationBaseOptions,
  DonationCompletionReason,
  DonationComponent,
  DonationComponentBuilder,
  DonationComponentOptions,
  OnDonationComplete,
} from "./donation-enabler";
import { ProcessorApiClient } from "../api/processor-api.client";
import { DonationAmount } from "../api/processor-api.type";

export class DonationBuilder implements DonationComponentBuilder {
  private adyenCheckout: ICore;
  private processorUrl: string;
  private sessionId: string;
  private donationCampaign: DonationCampaign;
  private paidAmount: DonationAmount;
  private paymentReference: string;
  private onComplete?: OnDonationComplete;
  private reportError: (reason: unknown) => void;

  constructor(baseOptions: DonationBaseOptions) {
    this.adyenCheckout = baseOptions.adyenCheckout;
    this.processorUrl = baseOptions.processorUrl;
    this.sessionId = baseOptions.sessionId;
    this.donationCampaign = baseOptions.donationCampaign;
    this.paidAmount = baseOptions.paidAmount;
    this.paymentReference = baseOptions.paymentReference;
    this.onComplete = baseOptions.onComplete;
    this.reportError = baseOptions.reportError;
  }

  build(config: DonationComponentOptions = {}): DonationComponent {
    const component = new AdyenDonationComponent({
      donationOptions: config,
      onComplete: this.onComplete,
      reportError: this.reportError,
      campaign: this.donationCampaign,
      paidAmount: this.paidAmount,
      paymentReference: this.paymentReference,
      adyenCheckout: this.adyenCheckout,
      processorUrl: this.processorUrl,
      sessionId: this.sessionId,
    });
    component.init();
    return component;
  }
}

/** Wraps the Adyen Donation element in "direct" mode. */
export class AdyenDonationComponent implements DonationComponent {
  private adyenCheckout: ICore;
  private apiClient: ProcessorApiClient;
  private donationOptions: DonationComponentOptions;
  private onComplete?: OnDonationComplete;
  private reportError: (reason: unknown) => void;
  private campaign: DonationCampaign;
  private paidAmount: DonationAmount;
  private paymentReference: string;
  private component: Donation;
  private isDonating = false;

  constructor(opts: {
    donationOptions: DonationComponentOptions;
    onComplete?: OnDonationComplete;
    reportError: (reason: unknown) => void;
    campaign: DonationCampaign;
    paidAmount: DonationAmount;
    paymentReference: string;
    adyenCheckout: ICore;
    processorUrl: string;
    sessionId: string;
  }) {
    this.donationOptions = opts.donationOptions;
    this.onComplete = opts.onComplete;
    this.reportError = opts.reportError;
    this.campaign = opts.campaign;
    this.paidAmount = opts.paidAmount;
    this.paymentReference = opts.paymentReference;
    this.adyenCheckout = opts.adyenCheckout;
    this.apiClient = new ProcessorApiClient({
      processorUrl: opts.processorUrl,
      sessionId: opts.sessionId,
    });
  }

  init(): void {
    const { id, campaignName, donation, ...campaignContent } = this.campaign;

    const props = {
      ...campaignContent,
      donation,
      commercialTxAmount: this.paidAmount.value,
      showCancelButton: this.donationOptions.showCancelButton ?? true,
      onDonate: async ({ data }: { data: { amount: DonationAmount } }, component: Donation) => {
        if (this.isDonating) return;
        this.isDonating = true;

        try {
          const result = await this.apiClient.createDonation({
            donationCampaignId: id,
            amount: data.amount,
          });

          const didDonate = result.status === "completed" || result.status === "pending";
          this.isDonating = didDonate;
          component.setStatus(didDonate ? "success" : "error");

          this.handleComplete({ isSuccess: didDonate, reason: didDonate ? "donated" : "rejected" });
        } catch (e) {
          this.isDonating = false;
          component.setStatus("error");
          this.reportError(e);
        }
      },
      onCancel: () => {
        this.handleComplete({ isSuccess: false, reason: "cancelled" });
      },
    };

    this.component = new Donation(this.adyenCheckout, props as unknown as DonationProps);
  }

  async mount(selector: string): Promise<void> {
    this.component.mount(selector);
  }

  unmount(): void {
    this.component.unmount();
  }

  private handleComplete(opts: { isSuccess: boolean; reason: DonationCompletionReason }): void {
    this.onComplete?.({
      isSuccess: opts.isSuccess,
      reason: opts.reason,
      paymentReference: this.paymentReference,
    });
  }
}
