/**
 * Wallet payment method types recognized by the dev-utils UI, keyed by the type value the
 * enabler/processor use. Shared so every place that needs to whitelist which stored payment
 * method types are wallets (either for display or for an allow-list) stays in sync from a
 * single source.
 */
export const WALLET_METHODS: Record<string, { label: string }> = {
  googlepay: { label: 'G Pay' },
  applepay: { label: 'Apple Pay' },
};
