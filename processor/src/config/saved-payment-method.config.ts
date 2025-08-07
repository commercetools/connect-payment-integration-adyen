import { getConfig } from './config';

export type SavedPaymentMethodConfig = {
  enabled: boolean; // indicates if tokenization feature is enabled
  config: {
    paymentInterface: string; // paymentInterface to set
    interfaceAccount?: string; // optional interfaceAccount to set
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
    },
  };

  return savedPaymentConfigValidated;
};
