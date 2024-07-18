/**
 * Specific configuration for payment methods that require special handling.
 * See https://docs.adyen.com/payment-methods for more information about each payment method.
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
  bancontactcard: {
    supportSeparateCapture: false,
  },
  eps: {
    supportSeparateCapture: false,
  },
  ideal: {
    supportSeparateCapture: false,
  },
};
