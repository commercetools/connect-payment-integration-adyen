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
