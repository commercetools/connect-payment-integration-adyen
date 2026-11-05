/**
 * Click to Pay is opt-in: it is only enabled when the merchant provides `clickToPayConfiguration`
 * in the card override (drop-in: `embedded.card`, web component: `card`).
 *
 * The shopper email is resolved at runtime, never from the static component config:
 * 1. `shopperEmail` passed by the merchant when building the component / drop-in
 * 2. the email derived from the cart by the processor
 * A `shopperEmail` set in the static config is ignored, as it would apply to every shopper.
 */
export const resolveClickToPayConfiguration = (
  cardOverride: Record<string, any> | undefined,
  emails: { merchantShopperEmail?: string; cartShopperEmail?: string },
): Record<string, unknown> => {
  const ctpConfig = cardOverride?.clickToPayConfiguration;
  if (!ctpConfig) return {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { shopperEmail: _ignored, ...rest } = ctpConfig;
  const shopperEmail = emails.merchantShopperEmail || emails.cartShopperEmail;
  return { clickToPayConfiguration: { ...rest, ...(shopperEmail && { shopperEmail }) } };
};
