/**
 * Specific configuration for payment methods that require special handling.
 * See https://docs.adyen.com/payment-methods for more information about each payment method.
 *
 * The key must point to the Adyen payment-method key structure.
 */
export type PaymentMethodConfig = {
  [key: string]: {
    /**
     * Whether the payment method supports separate capture.
     */
    supportSeparateCapture: boolean;
  };
};

export const paymentMethodConfig: PaymentMethodConfig = {
  bcmc: {
    supportSeparateCapture: false,
  },
  bcmc_mobile: {
    supportSeparateCapture: false,
  },
  blik: {
    supportSeparateCapture: false,
  },
  eps: {
    supportSeparateCapture: false,
  },
  ideal: {
    supportSeparateCapture: false,
  },
  onlineBanking_PL: {
    supportSeparateCapture: false,
  },
  swish: {
    supportSeparateCapture: false,
  },
};

// TODO: SCC-3447: do we need to pass this info to the enabler in order to allow/disallow certain stored web-components to be loaded?
export type SupportedSavedPaymentMethodTypes = {
  [key: string]: {
    oneOffPayments: boolean;
  };
};

/**
 * Represents which payment methods are supported for tokenization. The key represents the type value of the payment method as defined by Adyen.
 */
export const supportedSavedPaymentMethodTypes: SupportedSavedPaymentMethodTypes = {
  scheme: {
    oneOffPayments: true,
  },
};
