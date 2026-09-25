import { ProcessorApiError } from "../api/processor-api.client";

export const DonationErrorCode = {
  /** Adyen Giving is not enabled on the connector. */
  GivingNotEnabled: "giving_not_enabled",
  /** The payment of the checkout session carries no Adyen donation token. */
  PaymentNotEligible: "payment_not_eligible",
  /** Adyen returned no active campaign for the merchant account and currency of the payment. */
  NoActiveCampaign: "no_active_campaign",
  /** The donation configuration could not be fetched, or the Adyen web SDK could not be initialized. */
  InitializationFailed: "initialization_failed",
  /** Unexpected error. */
  General: "general",
} as const;

export type DonationErrorCode = (typeof DonationErrorCode)[keyof typeof DonationErrorCode];

export class DonationError extends Error {
  readonly code: DonationErrorCode;
  /** Redeclared: the enabler compiles against the ES2020 lib, where Error has no `cause`. */
  readonly cause?: unknown;

  constructor(code: DonationErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "DonationError";
    this.code = code;
    this.cause = options?.cause;
  }
}

/** Processor error codes mapped to host-facing codes; anything not listed keeps the caller's fallback code. */
const PROCESSOR_ERROR_CODES: Record<string, DonationErrorCode | undefined> = {
  DonationNotEnabled: DonationErrorCode.GivingNotEnabled,
  PaymentNotEligible: DonationErrorCode.PaymentNotEligible,
};

/** Wraps anything thrown into a {@link DonationError}, keeping the code when there already is one. */
export const toDonationError = (
  reason: unknown,
  fallbackCode: DonationErrorCode = DonationErrorCode.General,
): DonationError => {
  if (reason instanceof DonationError) return reason;

  const cause = (reason as { cause?: unknown })?.cause;
  if (cause instanceof DonationError) return cause;

  const code = (reason instanceof ProcessorApiError && PROCESSOR_ERROR_CODES[reason.code]) || fallbackCode;
  return new DonationError(code, reason instanceof Error ? reason.message : String(reason), { cause: reason });
};
