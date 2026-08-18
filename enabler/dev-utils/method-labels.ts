/**
 * Non-card stored payment method types recognized by the dev-utils UI, keyed by the type value
 * the enabler/processor use. These get their own display tag instead of (or alongside) a card
 * brand badge, since not all of them are card-backed (wallets like Google Pay/Apple Pay are;
 * Klarna is not). Shared so every place that needs this — display tagging or an allow-list —
 * stays in sync from a single source.
 */
export const METHOD_LABELS: Record<string, { label: string }> = {
  googlepay: { label: 'G Pay' },
  applepay: { label: 'Apple Pay' },
  klarna_pay_now: { label: 'Klarna Pay Now' },
  klarna_pay_later: { label: 'Klarna Pay Later' },
  klarna_pay_overtime: { label: 'Klarna Pay Over Time' },
  afterpay: { label: 'Afterpay (AU & NZ)' },
  sepadirectdebit: { label: 'SEPA Direct Debit' },
};

export const METHODS_WITH_NO_CARDS: string[] = [
  'klarna_pay_now',
  'klarna_pay_later',
  'klarna_pay_overtime',
  'afterpay',
]
