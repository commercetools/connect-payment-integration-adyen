import { DonationCampaign, ICore } from "@adyen/adyen-web";
import { DonationAmount } from "../api/processor-api.type";
import { DonationError } from "./donation-error";

export type DonationCompletionReason = "donated" | "cancelled" | "rejected";

export type OnDonationComplete = (opts: {
  isSuccess: boolean;
  reason: DonationCompletionReason;
  paymentReference: string;
}) => void;

export type OnDonationError = (error: DonationError, context?: { paymentReference?: string }) => void;

export type DonationEnablerOptions = {
  processorUrl: string;
  sessionId: string;
  countryCode?: string; //if not provided, obtained from the cart
  locale?: string; // if not provided, default to en-US
  onComplete?: OnDonationComplete;
  onError?: OnDonationError;
};

export type DonationBaseOptions = {
  adyenCheckout: ICore;
  processorUrl: string;
  sessionId: string;
  countryCode?: string;
  donationCampaign: DonationCampaign;
  paidAmount: DonationAmount;
  paymentReference: string;
  onComplete?: OnDonationComplete;
  /** Reports a failure the same way the Adyen core does: logged, and handed to the enabler's `onError`. */
  reportError: (reason: unknown) => void;
};

export type DonationComponentOptions = {
  showCancelButton?: boolean;
};

export interface DonationComponent {
  mount(selector: string): Promise<void>;
  unmount(): void;
}

export interface DonationComponentBuilder {
  build(config?: DonationComponentOptions): DonationComponent;
}

export interface DonationEnabler {
  /** @throws {DonationError} */
  createDonationBuilder: () => Promise<DonationComponentBuilder | never>;
}
