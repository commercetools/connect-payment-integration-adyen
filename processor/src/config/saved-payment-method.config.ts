import { getConfig } from './config';

/**
 * Represents which payment methods are supported for tokenization. The key represents the type value of the payment method as defined by Adyen.
 */
export type SupportedSavedPaymentMethodTypes = {
  [key: string]: {
    oneOffPayments: boolean;
  };
};

export type SavedPaymentMethodConfig = {
  enabled: boolean; // indicates if tokenization feature is enabled
  config: {
    paymentInterface: string; // paymentInterface to set
    interfaceAccount?: string; // optional interfaceAccount to set
    supportedPaymentMethodTypes: SupportedSavedPaymentMethodTypes;
  };
};

let savedPaymentConfigValidated: SavedPaymentMethodConfig;

export const getSavedPaymentsConfig = (): SavedPaymentMethodConfig => {
  if (savedPaymentConfigValidated) {
    return savedPaymentConfigValidated;
  }

  savedPaymentConfigValidated = {
    enabled: getConfig().adyenSavedPaymentMethodsEnabled === 'true',
    config: {
      paymentInterface: getConfig().adyenSavedPaymentMethodsPaymentInterface,
      interfaceAccount: getConfig().adyenSavedPaymentMethodsInterfaceAccount,
      supportedPaymentMethodTypes: {
        scheme: {
          oneOffPayments: true,
        },
      },
    },
  };

  return savedPaymentConfigValidated;
};
