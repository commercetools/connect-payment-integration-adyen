/**
 * Dev-only: the shopper email a merchant would pass to the enabler at runtime (Click to Pay).
 * It overrides the cart email. Entered in the checkout page before "Start Checkout";
 * `?shopperEmail=jane@example.com` on the URL pre-fills it.
 */
let shopperEmail = new URLSearchParams(window.location.search).get('shopperEmail')?.trim() ?? '';

export const setShopperEmail = (value: string): void => {
  shopperEmail = value.trim();
};

export const getInitialShopperEmail = (): string => shopperEmail;

export const getShopperEmail = (): { shopperEmail?: string } => (shopperEmail ? { shopperEmail } : {});
