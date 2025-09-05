import { getConfig } from './config';

/**
 * Represents which payment methods are supported for tokenization. The key represents the type value of the payment method as defined by Adyen.
 */
export type SupportedStoredPaymentMethodsTypes = {
  [key: string]: {
    oneOffPayments: boolean;
  };
};

export type StoredPaymentMethodsConfig = {
  enabled: boolean; // indicates if tokenization feature is enabled
  config: {
    paymentInterface: string; // paymentInterface to set
    interfaceAccount?: string; // optional interfaceAccount to set
    supportedPaymentMethodTypes: SupportedStoredPaymentMethodsTypes;
  };
};

let storedPaymentMethodsConfigValidated: StoredPaymentMethodsConfig;

export const getStoredPaymentMethodsConfig = (): StoredPaymentMethodsConfig => {
  if (storedPaymentMethodsConfigValidated) {
    return storedPaymentMethodsConfigValidated;
  }

  storedPaymentMethodsConfigValidated = {
    enabled: getConfig().adyenStoredPaymentMethodsEnabled === 'true',
    config: {
      paymentInterface: getConfig().adyenStoredPaymentMethodsPaymentInterface,
      interfaceAccount: getConfig().adyenStoredPaymentMethodsInterfaceAccount,
      supportedPaymentMethodTypes: {
        scheme: {
          oneOffPayments: true,
        },
      },
    },
  };

  return storedPaymentMethodsConfigValidated;
};
